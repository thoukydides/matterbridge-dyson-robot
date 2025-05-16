// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    DysonDevice,
    DysonDeviceConstructorParams
} from './dyson-device-base.js';
import { DysonMqtt360, DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { EntityName } from './config-types.js';
import { assertIsDefined, tryListener } from './utils.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { MatterbridgeEndpoint } from 'matterbridge';
import { BasicInformation } from 'matterbridge/matter/clusters';
import { ifValueChanged } from './decorator-changed.js';
import { RvcCleanModeLabels } from './endpoint-360-rvc.js';
import {
    Endpoint360,
    EndpointOptions360,
    UpdatePowerSource360,
    UpdateRvcOperationalState360
} from './endpoint-360.js';
import { PLUGIN_URL, VENDOR_NAME } from './settings.js';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { Dyson360PowerMode, Dyson360State } from './dyson-360-types.js';
import {
    Dyson360MappedFaults,
    mapDyson360Faults
} from './dyson-device-360-faults.js';
import { assert } from 'console';
import { attachDevice360CommandHandlers } from './dyson-device-360-commands.js';

// Mapping of robot vacuum state to Matter equivalents
type StateMapColumns = [
    keyof typeof RvcRunMode360,
    keyof typeof RvcOperationalState.OperationalState,
    boolean
]
const STATE_MAP: Record<Dyson360State, StateMapColumns> = {
    //                                      RunMode         OperationalState    isDocked
    [Dyson360State.FaultCallHelpline]:      ['Idle',        'Error',            false],
    [Dyson360State.FaultContactHelpline]:   ['Idle',        'Error',            false],
    [Dyson360State.FaultCritical]:          ['Idle',        'Error',            false],
    [Dyson360State.FaultGettingInfo]:       ['Idle',        'Error',            false],
    [Dyson360State.FaultLost]:              ['Idle',        'Error',            false],
    [Dyson360State.FaultOnDock]:            ['Idle',        'Error',            true],
    [Dyson360State.FaultOnDockCharged]:     ['Idle',        'Error',            true],
    [Dyson360State.FaultOnDockCharging]:    ['Idle',        'Error',            true],
    [Dyson360State.FaultReplaceOnDock]:     ['Idle',        'Error',            false],
    [Dyson360State.FaultReturnToDock]:      ['Idle',        'Error',            false],
    [Dyson360State.FaultRunningDiagnostic]: ['Idle',        'Error',            false],
    [Dyson360State.FaultUserRecoverable]:   ['Idle',        'Error',            false],
    [Dyson360State.FullCleanAbandoned]:     ['Idle',        'SeekingCharger',   false],
    [Dyson360State.FullCleanAborted]:       ['Idle',        'SeekingCharger',   false],
    [Dyson360State.FullCleanCharging]:      ['Cleaning',    'Charging',         true],
    [Dyson360State.FullCleanDiscovering]:   ['Cleaning',    'Running',          false],
    [Dyson360State.FullCleanFinished]:      ['Idle',        'SeekingCharger',   false],
    [Dyson360State.FullCleanInitiated]:     ['Cleaning',    'Running',          false],
    [Dyson360State.FullCleanNeedsCharge]:   ['Cleaning',    'SeekingCharger',   false],
    [Dyson360State.FullCleanPaused]:        ['Cleaning',    'Paused',           false],
    [Dyson360State.FullCleanRunning]:       ['Cleaning',    'Running',          false],
    [Dyson360State.FullCleanTraversing]:    ['Cleaning',    'Running',          false],
    [Dyson360State.InactiveCharged]:        ['Idle',        'Docked',           true],
    [Dyson360State.InactiveCharging]:       ['Idle',        'Charging',         true],
    [Dyson360State.InactiveDischarging]:    ['Idle',        'Stopped',          false],
    [Dyson360State.MappingAborted]:         ['Idle',        'SeekingCharger',   false],
    [Dyson360State.MappingCharging]:        ['Mapping',     'Charging',         true],
    [Dyson360State.MappingFinished]:        ['Idle',        'SeekingCharger',   false],
    [Dyson360State.MappingInitiated]:       ['Mapping',     'Running',          false],
    [Dyson360State.MappingNeedsCharge]:     ['Mapping',     'SeekingCharger',   false],
    [Dyson360State.MappingPaused]:          ['Mapping',     'Paused',           false],
    [Dyson360State.MappingRunning]:         ['Mapping',     'Running',          false]
};
function mapState(state: Dyson360State): {
    runMode:            RvcRunMode360,
    operationalState:   RvcOperationalState.OperationalState,
    isDocked:           boolean
} {
    const [runMode, operationState, isDocked] = STATE_MAP[state];
    return {
        runMode:            RvcRunMode360[runMode],
        operationalState:   RvcOperationalState.OperationalState[operationState],
        isDocked
    };
}

// Mapping of robot power mode to its corresponding Matter Clean Mode and label
export type PowerModeMap = [Dyson360PowerMode, ...RvcCleanModeLabels[number]];

// Thresholds for battery levels
const BATTERY_THRESHOLD_CRITICAL = 10;
const BATTERY_THRESHOLD_WARNING  = 25;
const BATTERY_THRESHOLD_FULL     = 100;

// A Dyson robot vacuum device
export abstract class DysonDevice360Base extends DysonDevice<DysonMqtt360> {

    // The MQTT client and status update listener
    static readonly mqttConstructor = DysonMqtt360;
    mqttListener:   () => void;

    // The RVC device endpoint
    endpoint?:      Endpoint360;

    // Construct a new Dyson device instance
    constructor(...args: DysonDeviceConstructorParams<DysonMqtt360>) {
        super(...args);

        // Prepare a listener for MQTT updates
        this.mqttListener = tryListener(this.mqtt, () =>
            this.updateClusterAttributes(this.mqtt.status));
    }

    // Create the endpoint for this device
    makeEndpoint(): Endpoint360 {
        const rvcCleanModeLabels: RvcCleanModeLabels =
            this.getPowerModeMaps().map(([, mode, label]) => [mode, label]);

        // Static configuration of the RVC clusters
        const endpointOptions: EndpointOptions360 = {
            uniqueStorageKey:       this.uniqueId,
            matterbridgeDeviceName: this.deviceName,
            deviceBasicInformation: {
                nodeLabel:          this.deviceName,
                partNumber:         this.modelNumber,
                productAppearance:  this.getProductAppearance(),
                productLabel:       this.modelNumber,
                productName:        this.modelName,
                productUrl:         PLUGIN_URL,
                serialNumber:       this.serialNumber,
                uniqueId:           this.uniqueId,
                vendorName:         VENDOR_NAME
            },
            powerSource: {
                batteryPartNumber:  this.getBatteryPartNumber()
            },
            rvcCleanMode: {
                labels:             rvcCleanModeLabels
            }
        };

        // Create the endpoint and attach a command handler
        const endpoint = new Endpoint360(this.log, this.config, endpointOptions);
        attachDevice360CommandHandlers(this.log, this.mqtt, endpoint,
                                       this.cleanModeToPowerMode.bind(this));
        return endpoint;
    }

    // List of endpoint function names and descriptions to validate
    override getEntities(): { name: EntityName, description: string }[] {
        return []; // Single endpoint, so no entity selection
    }

    // Retrieve the root device endpoints after validation
    override getEndpoints(_validatedNames: EntityName[]): MatterbridgeEndpoint[] {
        return [this.endpoint ??= this.makeEndpoint()];
    }

    // Start the device after the endpoints are active
    override async start(): Promise<void> {
        this.mqtt.on('status', this.mqttListener);
        await this.updateClusterAttributes(this.mqtt.status);
    }

    // Stop the device when Matterbridge is shutting down
    override async stop(): Promise<void> {
        this.mqtt.off('status', this.mqttListener);
        await super.stop();
    }

    // Model-specific information
    abstract getBatteryPartNumber(): string;
    abstract getProductAppearance(): BasicInformation.ProductAppearance;
    abstract getPowerModeMaps(): PowerModeMap[];

    // Map an RVC Clean Mode to its corresponding Dyson power mode
    cleanModeToPowerMode(cleanMode: RvcCleanMode360): Dyson360PowerMode {
        const map = this.getPowerModeMaps().find(([, m]) => m === cleanMode);
        assertIsDefined(map);
        return map[0];
    }

    // Map a Dyson power mode to its corresponding RVC Clean Mode
    powerModeToCleanMode(powerMode: Dyson360PowerMode): RvcCleanMode360 {
        const map = this.getPowerModeMaps().find(([m]) => m === powerMode);
        assertIsDefined(map);
        return map[1];
    }

    // Update cluster attributes when the MQTT status is updated
    @ifValueChanged
    async updateClusterAttributes(status: DysonMqttStatus<DysonMqttStatus360>): Promise<void> {
        assertIsDefined(this.endpoint);

        // Map the state to cluster attribute values
        const faults = mapDyson360Faults(this.log, status.state, status.faults);
        const cleanMode         = this.powerModeToCleanMode(status.currentVacuumPowerMode);
        const { runMode }       = mapState(status.state);
        const operationalState  = this.mapOperationalState(status, faults);
        const batteryStatus     = this.mapBatteryStatus(status, faults);

        // Update all of the clusters
        await Promise.all([
            this.endpoint.updateReachable(status.reachable),
            this.endpoint.updateRvcCleanMode(cleanMode),
            this.endpoint.updateRvcRunMode(runMode),
            this.endpoint.updateRvcOperationalState(operationalState),
            this.endpoint.updatePowerSource(batteryStatus)
        ]);
    }

    // Convert the battery status to Power Source cluster attributes
    mapBatteryStatus(
        status: DysonMqttStatus<DysonMqttStatus360>,
        faults: Dyson360MappedFaults
    ): UpdatePowerSource360 {
        const { operationalState, isDocked } = mapState(status.state);
        const { batteryChargeLevel } = status;
        const { activeBatFaults, activeBatChargeFaults } = faults;
        return {
            activeBatFaults,
            activeBatChargeFaults:  isDocked ? activeBatChargeFaults : [],
            batPercentRemaining:    batteryChargeLevel * 2, // ×2, e.g. 200 for 100%
            batChargeLevel:         PowerSource.BatChargeLevel[
                batteryChargeLevel < BATTERY_THRESHOLD_CRITICAL ? 'Critical'
                : batteryChargeLevel < BATTERY_THRESHOLD_WARNING ? 'Warning' : 'Ok'],
            batChargeState:         PowerSource.BatChargeState[
                (operationalState === RvcOperationalState.OperationalState.Charging) ? 'IsCharging'
                : batteryChargeLevel < BATTERY_THRESHOLD_FULL ? 'IsNotCharging' : 'IsAtFullCharge'],
            status:                 PowerSource.PowerSourceStatus.Active
        };
    }

    // Convert the status to RVC Operational State cluster attributes
    mapOperationalState(
        status: DysonMqttStatus<DysonMqttStatus360>,
        faults: Dyson360MappedFaults
    ): UpdateRvcOperationalState360 {
        const mappedState = mapState(status.state);
        const isActive = mappedState.runMode !== RvcRunMode360.Idle;

        // Ensure consistent Operational State and Operational Error
        const { operationalError } = faults;
        let { operationalState } = mapState(status.state);
        if (operationalError.errorStateId !== RvcOperationalState.ErrorState.NoError) {
            // Force Error state if an error is being reported
            operationalState = RvcOperationalState.OperationalState.Error;
        } else {
            // Otherwise the state should not have been mapped to Error
            assert(operationalState !== RvcOperationalState.OperationalState.Error);
        }

        return { isActive, operationalState, operationalError };
    }
}