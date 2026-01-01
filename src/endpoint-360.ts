// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    bridgedNode,
    DeviceTypeDefinition,
    powerSource,
    roboticVacuumCleaner
} from 'matterbridge';
import { AtLeastOne } from 'matterbridge/matter';
import {
    OperationalState,
    PowerSource,
    RvcCleanMode,
    RvcRunMode,
    RvcOperationalState,
    ServiceArea
} from 'matterbridge/matter/clusters';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    BatteryPowerSourceOptions,
    createBatteryPowerSourceClusterServer,
    createRvcCleanModeClusterServer,
    createRvcOperationalStateClusterServer,
    createRvcRunModeClusterServer,
    createServiceAreaClusterServer,
    RvcCleanModeOptions
} from './endpoint-360-rvc.js';
import {
    EndpointBase,
    EndpointOptionsBase,
    formatEnumLog
} from './endpoint-base.js';
import { ifValueChanged } from './decorator-changed.js';
import { assertIsDefined, formatList, formatSeconds, MS, plural } from './utils.js';
import { AN, AV, RI } from './logger-options.js';
import {
    Behavior360,
    BehaviorDevice360,
    EndpointCommands360,
    RvcCleanMode360,
    RvcRunMode360
} from './endpoint-360-behavior.js';

// Device-specific endpoint configuration
export interface EndpointOptions360 extends EndpointOptionsBase {
    powerSource:    BatteryPowerSourceOptions;
    rvcCleanMode:   RvcCleanModeOptions;
    supportsMaps:   boolean;
}

// Updates to the Power Source cluster attributes
export interface UpdatePowerSource360 {
    activeBatChargeFaults:  PowerSource.BatChargeFault[];
    activeBatFaults:        PowerSource.BatFault[];
    batChargeLevel:         PowerSource.BatChargeLevel;
    batChargeState:         PowerSource.BatChargeState;
    batPercentRemaining:    number | null; // ×2, e.g. 200 for 100%
    status:                 PowerSource.PowerSourceStatus;
}

// Updates to the RVC Operational State cluster
export interface UpdateRvcOperationalState360 {
    isActive:               boolean;
    operationalError:       RvcOperationalState.ErrorStateStruct;
    operationalState:       RvcOperationalState.OperationalState;
}

// Updates to the Service Area cluster
export interface UpdateServiceArea360 {
    currentArea:            number | null;
    progress:               ServiceArea.Progress[];
    selectedAreas:          number[];
    supportedAreas:         ServiceArea.Area[];
    supportedMaps:          ServiceArea.Map[];
}

// A Matterbridge endpoint with robot vacuum cleaner clusters
export class Endpoint360 extends EndpointBase {

    // Command handlers
    readonly behaviorDevice360: BehaviorDevice360;

    // Start time of the most recent activity
    startActive = 0;

    // Construct a new endpoint
    constructor(
        log:                AnsiLogger,
        config:             Config,
        readonly options:   EndpointOptions360
    ) {
        const definition: AtLeastOne<DeviceTypeDefinition> =
            [roboticVacuumCleaner, bridgedNode, powerSource];
        super(log, config, options, definition);

        // Create the device-specific clusters
        createBatteryPowerSourceClusterServer(this, options.powerSource);
        createRvcRunModeClusterServer(this);
        createRvcCleanModeClusterServer(this, options.rvcCleanMode);
        createRvcOperationalStateClusterServer(this);
        if (options.supportsMaps) createServiceAreaClusterServer(this);

        // Add a command handler behavior
        this.behaviorDevice360 = new BehaviorDevice360(this.log);
        this.behaviors.require(Behavior360, { device: this.behaviorDevice360 });
    }

    // Set a command handler
    setCommandHandler360<Command extends keyof EndpointCommands360>(
        command: Command,
        handler: EndpointCommands360[Command]
    ): this {
        this.behaviorDevice360.setCommandHandler(command, handler);
        return this;
    }

    // Update the Power Source cluster attributes when required
    @ifValueChanged
    async updatePowerSource(attributes: UpdatePowerSource360): Promise<void> {
        const { status, batPercentRemaining, batChargeLevel, batChargeState,
            activeBatChargeFaults, activeBatFaults } = attributes;
        const clusterId = PowerSource.Cluster.id;
        const logBattery = [
            formatEnumLog(PowerSource.BatChargeLevel,      batChargeLevel),
            formatEnumLog(PowerSource.PowerSourceStatus,   status),
            formatEnumLog(PowerSource.BatChargeState,      batChargeState)
        ];
        if (batPercentRemaining !== null) logBattery.unshift(`${AV}${batPercentRemaining / 2}${RI}%`);
        if (activeBatFaults.length) {
            const faults = activeBatFaults.map(v => formatEnumLog(PowerSource.BatFault, v));
            logBattery.push(`${AN}${plural(faults.length, 'battery fault', false)}${RI} [${formatList(faults)}${RI}]`);
        }
        if (activeBatChargeFaults.length) {
            const faults = activeBatChargeFaults.map(v => formatEnumLog(PowerSource.BatChargeFault, v));
            logBattery.push(`${AN}${plural(faults.length, 'charge fault', false)}${RI} [${formatList(faults)}${RI}]`);
        }
        this.log.info(`${AN}Battery status${RI}: ${formatList(logBattery)}`);
        await this.updateAttribute(clusterId, 'status',                 status,                 this.log);
        await this.updateAttribute(clusterId, 'batPercentRemaining',    batPercentRemaining,    this.log);
        await this.updateAttribute(clusterId, 'batChargeLevel',         batChargeLevel,         this.log);
        await this.updateAttribute(clusterId, 'batChargeState',         batChargeState,         this.log);
        await this.updateAttribute(clusterId, 'activeBatChargeFaults',  activeBatChargeFaults,  this.log);
        await this.updateAttribute(clusterId, 'activeBatFaults',        activeBatFaults,        this.log);

        // Trigger BatFaultChange event if activeBatFaults has changed
        const prevActiveBatFaults = (this.changed.prevValues.get('activeBatFaults') ?? []) as PowerSource.BatFault[];
        if (this.changed.isChanged('activeBatFaults', activeBatFaults)) {
            const payload: PowerSource.BatFaultChangeEvent = {
                current:    activeBatFaults,
                previous:   prevActiveBatFaults
            };
            this.log.info(`${AN}Battery Fault Change event${RI}`);
            await this.triggerEvent(clusterId, 'batFaultChange', payload, this.log);
        }

        // Trigger BatChargeFaultChange event if activeBatChargeFaults has changed
        const prevActiveBatChargeFaults = (this.changed.prevValues.get('activeBatChargeFaults') ?? []) as PowerSource.BatChargeFault[];
        if (this.changed.isChanged('activeBatChargeFaults', activeBatChargeFaults)) {
            const payload: PowerSource.BatChargeFaultChangeEvent = {
                current:    activeBatChargeFaults,
                previous:   prevActiveBatChargeFaults
            };
            this.log.info(`${AN}Battery Charge Fault Change event${RI}`);
            await this.triggerEvent(clusterId, 'batChargeFaultChange', payload, this.log);
        }
    }

    // Update the RVC Run Mode cluster attributes when required
    @ifValueChanged
    async updateRvcRunMode(runMode: RvcRunMode360): Promise<void> {
        const clusterId = RvcRunMode.Cluster.id;
        this.log.info(`${AN}RVC Run Mode${RI}: ${formatEnumLog(RvcRunMode360, runMode)}`);
        await this.updateAttribute(clusterId, 'currentMode', runMode, this.log);
    }

    // Update the RVC Clean Mode cluster attributes when required
    @ifValueChanged
    async updateRvcCleanMode(cleanMode: RvcCleanMode360): Promise<void> {
        const clusterId = RvcCleanMode.Cluster.id;
        this.log.info(`${AN}RVC Clean Mode${RI}: ${formatEnumLog(RvcCleanMode360, cleanMode)}`);
        await this.updateAttribute(clusterId, 'currentMode', cleanMode, this.log);
    }

    // Update the RVC Operational State cluster attributes when required
    @ifValueChanged
    async updateRvcOperationalState(attributes: UpdateRvcOperationalState360): Promise<void> {
        const { operationalState, operationalError, isActive } = attributes;
        const clusterId = RvcOperationalState.Cluster.id;
        this.log.info(`${AN}RVC Operational State${RI}: ${formatEnumLog(RvcOperationalState.OperationalState, operationalState)}`);
        await this.updateAttribute(clusterId, 'operationalState', operationalState, this.log);
        await this.updateAttribute(clusterId, 'operationalError', operationalError, this.log);

        // Trigger OperationCompletion event when changing from active to idle
        const { errorStateId, errorStateLabel, errorStateDetails } = operationalError;
        const isError = errorStateId !== RvcOperationalState.ErrorState.NoError;
        if (this.changed.isChanged('isActive', isActive)) {
            if (isActive) {
                this.log.info(`(${AN}RVC Operation Started${RI})`);
                this.startActive = Date.now();
            } else if (this.startActive) {
                const totalOperationalTime = Math.round((Date.now() - this.startActive) / MS);
                this.log.info(`${AN}RVC Operation Completion event${RI} in ${AV}${formatSeconds(totalOperationalTime)}${RI}`);
                const payload: OperationalState.OperationCompletionEvent = {
                    completionErrorCode:    errorStateId,
                    totalOperationalTime
                };
                await this.triggerEvent(clusterId, 'operationCompletion', payload, this.log);
            }
        }

        // Trigger OperationalError event if there is a new error
        if (this.changed.isChanged('operationalError', operationalError)) {
            if (isError) {
                const errorName = RvcOperationalState.ErrorState[errorStateId];
                let logMessage = `${AN}RVC Operational Error event${RI}:`
                               + ` ${errorName ? `${AV}${errorName}${RI} (${AV}${errorStateId}${RI})` : `${AV}${errorStateId}${RI}`}`;
                if (errorStateLabel)   logMessage += ` [${AV}${errorStateLabel}${RI}]`;
                if (errorStateDetails) logMessage += `: ${AV}${errorStateDetails}${RI}`;
                this.log.info(logMessage);
                const payload: RvcOperationalState.OperationalErrorEvent = {
                    errorState: operationalError
                };
                await this.triggerEvent(clusterId, 'operationalError', payload, this.log);
            } else {
                this.log.info(`${AN}RVC Operational Error${RI}: ${AV}Error cleared${RI}`);
            }
        }
    }

    // Update the Service Area cluster attributes when required
    @ifValueChanged
    async updateServiceArea(attributes: UpdateServiceArea360): Promise<void> {
        if (!this.options.supportsMaps) return;
        const { currentArea, progress, selectedAreas, supportedAreas, supportedMaps } = attributes;
        const clusterId = ServiceArea.Cluster.id;
        const areaName = (areaId: number | null): string => formatAreaName(supportedMaps, supportedAreas, areaId);
        const progressStatus = progress.map(({ areaId, status }) =>
            `${areaName(areaId)}: ${AV}${ServiceArea.OperationalStatus[status]}${RI} (${AV}${status}${RI})`);
        const logMessage = `${AN}Service Area${RI}:`
                         + ` ${AV}${plural(supportedMaps.length, 'map')}${RI}, ${AV}${plural(supportedAreas.length, 'area')}${RI},`
                         + ` selected [${selectedAreas.map(areaName).join(', ')}],`
                         + ` @ ${areaName(currentArea)}, status [${progressStatus.join(', ')}]`;
        this.log.info(logMessage);
        await this.updateAttribute(clusterId, 'supportedMaps',  supportedMaps,  this.log);
        await this.updateAttribute(clusterId, 'supportedAreas', supportedAreas, this.log);
        await this.updateAttribute(clusterId, 'currentArea',    currentArea,    this.log);
        await this.updateAttribute(clusterId, 'progress',       progress,       this.log);
        await this.updateAttribute(clusterId, 'selectedAreas',  selectedAreas,  this.log);
    }
}

// Format a Service Area area identifier for logging
export function formatAreaName(
    supportedMaps:  ServiceArea.Map[],
    supportedAreas: ServiceArea.Area[],
    areaId:         number | null
): string {
    if (areaId === null) return `${AV}n/a${RI}`;
    const area = supportedAreas.find(a => a.areaId === areaId);
    assertIsDefined(area);
    assertIsDefined(area.areaInfo.locationInfo);
    const map = supportedMaps.find(m => m.mapId === area.mapId);
    assertIsDefined(map);
    const name = `${map.name}:${area.areaInfo.locationInfo.locationName}`.replaceAll(/\s+/g, '_');
    return `${AV}${name}${RI} (${AV}${area.mapId}:${areaId}${RI})`;
}