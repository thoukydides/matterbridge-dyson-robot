// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import {
    Dyson360DockState,
    Dyson360VacuumMode
} from './dyson-360-types.js';
import {
    DysonDevice360Base,
    Dyson360PowerLevelMap,
    dyson360MapState
} from './dyson-device-360-base.js';
import { DysonDevice360ZoneCommand, DysonDevice360ZonesMixin } from './dyson-device-360-zones.js';
import {
    Dyson360PersistentMapMetadataResponseV2,
    Dyson360PersistentMapMetadataV2
} from './dyson-360-cloud-types.js';
import { DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { assertIsDefined, formatList, formatMilliseconds, MS, plural, tryListener } from './utils.js';
import { DysonDeviceConstructorParams } from './dyson-device-base.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { PeriodicOp } from './periodic-op.js';
import { DysonMqtt360Jdm, DysonMqtt360JdmEventArgs } from './dyson-mqtt-360-jdm.js';
import { Endpoint360, EndpointOptions360, UpdatePowerSource360, UpdateRvcOperationalState360 } from './endpoint-360.js';
import { Dyson360MappedFaults } from './dyson-device-360-faults.js';
import { DysonDevice360CommandHandlers } from './dyson-device-360-commands.js';
import { ifValueChanged } from './decorator-changed.js';
import { Dyson360JdmPropValues } from './dyson-360-jdm-props-types.js';
import { Dyson360JdmBoolean } from './dyson-360-jdm-types.js';
import { DysonCloudStatusCodeError } from './dyson-cloud-error.js';

// Spot+Scrub Ai status polling behaviour
const POLL_STATUS_MS                =  30 * MS; // 30 seconds
const POLL_STATUS_RAPID_MS          =   1 * MS; //  1 second
const POLL_LIVE_MAPS_CLEANING_MS    = 3.5 * MS; // 3½ seconds

// Delay transitions to INACTIVE_* to mask incorrect state reports
const MASK_INACTIVE_TRANSITION_MS   =   2 * MS; //  2 seconds

// Common base class for Dyson post-360 robot vacuum devices (excluding mop)
export abstract class DysonDevice360JdmBase extends DysonDevice360ZonesMixin(DysonDevice360Base<DysonMqtt360Jdm>) {

    // The MQTT client and status update listener with JDM endpoints
    static override readonly mqttConstructor = DysonMqtt360Jdm;

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360VacuumMode.Auto,   RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VacuumMode.Quick,  RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VacuumMode.Quiet,  RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VacuumMode.Boost,  RvcCleanMode360.MaxBoost,   'Boost']
    ];

    override setPowerLevel = (powerLevel: Dyson360VacuumMode) => this.mqtt.commandSetCleaningStrategy(powerLevel);
    override getDefaultPowerLevel = () => this.mqtt.status.defaultCleaningStrategy;
    override getCurrentPowerLevel = () => this.mqtt.status.currentCleaningStrategy;

    // Status update listener
    mqttJdmPropListener: (...args: DysonMqtt360JdmEventArgs) => void;

    // Add dock emptying dustbin capability
    override getEndpointOptions(): EndpointOptions360 {
        const endpointOptions = super.getEndpointOptions();
        endpointOptions.rvcOperationalState.supportsEmptyingDustBin = true;
        return endpointOptions;
    }

    // Polled updates
    pollStatus:     PeriodicOp;
    pollCleaning:   PeriodicOp;

    // Transition to inactive debouncing
    inactiveStart:  number | undefined = 0;

    // Construct a new Dyson device instance
    constructor(...args: DysonDeviceConstructorParams<DysonMqtt360Jdm>) {
        super(...args);

        // Enable online fault code lookup
        this.faultMapper.lookupOnline = faultCode => this.findFaultOnline(faultCode);

        // Prepare listener for MQTT JDM updates
        this.mqttJdmPropListener = tryListener(this.mqtt, (event, ..._rest) => {
            if (event === 'jdm_props_updated') this.updateJdmProps(this.mqtt.jdmProps);
        });

        // Poll device status via MQTT
        this.pollStatus = new PeriodicOp(this.log, {
            name:           'Current status poll',
            interval:       POLL_STATUS_MS,
            intervalRapid:  POLL_STATUS_RAPID_MS,
            op:             this.pollStatusOp.bind(this)
        });

        // Use the live map to update the zone status
        this.pollCleaning = new PeriodicOp(this.log, {
            name:           'Live cleaning maps poll',
            interval:       POLL_LIVE_MAPS_CLEANING_MS,
            op:             this.pollCleaningOp.bind(this)
        });
    }

    // Attach command handlers to the endpoint
    override attachCommandHandlers(endpoint: Endpoint360): DysonDevice360CommandHandlers {
        const handlers = super.attachCommandHandlers(endpoint);
        handlers.rapidPollRequest = this.pollStatus.requestRapid.bind(this.pollStatus);
        return handlers;
    }

    // Poll device status via MQTT
    async pollStatusOp(): Promise<void> {
        if (this.mqtt.status.reachable) {
            await this.mqtt.publish('REQUEST-CURRENT-STATE', {});
        }
    }

    // Use the live map to update the zone status
    async pollCleaningOp(): Promise<void> {
        if (!this.api) return; // (mock devices do not support this)
        try {
            const cleaningMode = this.mqtt.status.currentCleaningMode;
            assertIsDefined(cleaningMode);
            const live = await this.api.getLiveMapsCleaning360V1();
            const zoneStatus = live.zones.map(({ id, cleanStatus }) => ({ zoneId: id, cleanStatus }));
            await this.updateZoneStatus({ mapId: live.id, cleaningMode, zoneStatus });
        } catch (err) {
            // Live map is only available about 7 seconds after the clean starts
            if (!(err instanceof DysonCloudStatusCodeError && err.statusCode === 404)) throw err;
        }
    }

    // Update cluster attributes when the MQTT status is updated
    override async updateClusterAttributes(status: DysonMqttStatus<DysonMqttStatus360>): Promise<void> {
        const { runMode } = dyson360MapState(status.state);

        // Suppress INACTIVE_DISCHARGING between mop wash and start of clean
        if (runMode === RvcRunMode360.Idle) {
            if (status.state.startsWith('INACTIVE_')) {
                // Delay treating a new INACTIVE_* state as real
                this.inactiveStart ??= Date.now();
                const remainingDelay = this.inactiveStart + MASK_INACTIVE_TRANSITION_MS - Date.now();
                if (status.state.startsWith('INACTIVE_') && 0 < remainingDelay) {
                    this.log.info(`Delaying transition to ${status.state} for ${formatMilliseconds(remainingDelay)}`);
                    return;
                }
            } else {
                // No delay if transitioning via *_(ABANDONED|ABORTED|FINISHED)
                this.inactiveStart = 0;
            }
        } else if (runMode === RvcRunMode360.Cleaning) {
            // Prime the inactive transition suppression from active cleaning
            this.inactiveStart = undefined;
        }

        // Update the standard clusters
        await super.updateClusterAttributes(status);

        // Start or stop live map polling when cleaning
        if (status.state.startsWith('FULL_CLEAN_')) this.pollCleaning.start();
        else                                        this.pollCleaning.stop();

        // Update the Service Area cluster when not polling the live map
        if (!this.pollCleaning.isActive) await this.updateZoneStatus();
    }

    // Convert the battery status to Power Source cluster attributes
    override mapBatteryStatus(status: DysonMqttStatus<DysonMqttStatus360>, faults: Dyson360MappedFaults): UpdatePowerSource360 {
        const batteryStatus = super.mapBatteryStatus(status, faults);

        // Override the state-derived charging status based on JDM properties
        if (this.mqtt.jdmProps.charge_state === Dyson360JdmBoolean.True) {
            batteryStatus.batChargeState = PowerSource.BatChargeState.IsCharging;
        }
        return batteryStatus;
    }

    // Monitor MQTT JDM property status changes
    @ifValueChanged
    updateJdmProps(_props: Dyson360JdmPropValues): void {
        // HERE - log props.work_mode with related values
    }

    // Attempt to convert selected areas into a Dyson cleaning programme
    override async makeCleaningProgramme(areaIds: number[]): Promise<DysonDevice360ZoneCommand> {
        const programme = await super.makeCleaningProgramme(areaIds);
        const { command, cleaningProgramme } = programme;
        const preCommand = async (): Promise<void> => {
            const { persistentMapId } = cleaningProgramme;
            const map = this.mapFromMatter.values().find(m => m.id === persistentMapId) as Dyson360PersistentMapMetadataV2 | undefined;
            assertIsDefined(map);

            // Select and order the zones before the clean is started
            let zoneSelectionChanged = false;
            for (const zone of map.zones) {
                const isSelected = cleaningProgramme.unorderedZones.includes(zone.id);
                if (zone.isSelected === isSelected) continue;
                zone.isSelected = isSelected;
                zoneSelectionChanged = true;
            }
            if (zoneSelectionChanged) {
                this.log.info('Updating persistent map with zone selection');
                await this.api?.setPersistentMapMetadata360V2(persistentMapId, map.zones);
            } else {
                this.log.info('Zone selection does not require any change to the persistent map');
            }
        };

        // Return the cleaning programme to start the clean via MQTT
        return {
            ...programme,
            command:    async () => {
                await preCommand();
                await command();
            }
        };
    }

    // Retrieve the latest persistent map metadata
    override getPersistentMapMetadata(): Promise<Dyson360PersistentMapMetadataResponseV2> | undefined {
        return this.api?.getPersistentMapMetadata360V2();
    }

    // Spot+Scrub Ai does not publish status updates, so poll periodically
    override async start(): Promise<void> {
        await super.start();
        this.pollStatus.start();
        this.mqtt.on('event', this.mqttJdmPropListener);
    }

    // Stop the device when Matterbridge is shutting down
    override async stop(): Promise<void> {
        this.pollStatus.stop();
        this.pollCleaning.stop();
        this.mqtt.off('event', this.mqttJdmPropListener);
        await super.stop();
    }

    // Convert the status to RVC Operational State cluster attributes
    override mapOperationalState(status: DysonMqttStatus<DysonMqttStatus360>, faults: Dyson360MappedFaults): UpdateRvcOperationalState360 {
        const state = super.mapOperationalState(status, faults);

        // Override the Operational State if the dock is busy
        const DOCK_STATE_MAP: Record<Dyson360DockState, keyof typeof RvcOperationalState.OperationalState | undefined> = {
            [Dyson360DockState.CollectingDust]: 'EmptyingDustBin',
            [Dyson360DockState.WashingMop]:     'CleaningMop',
            [Dyson360DockState.DryingMop]:      'CleaningMop',
            [Dyson360DockState.Idle]:           undefined
        };
        const mappedDockState = status.dockState && DOCK_STATE_MAP[status.dockState];
        if (mappedDockState) state.operationalState = RvcOperationalState.OperationalState[mappedDockState];
        return state;
    }

    // Attempt an online lookup of a fault code
    async findFaultOnline(faultCode: string): Promise<string | undefined> {
        // Retrieve the support information for this fault code from the API
        if (!this.api) return; // (mock devices do not support this)
        const details = await this.api.getFaultDetails360V1(faultCode);
        if (!details.length) throw new Error('No online product support result');
        if (!details.some(d => d.codes.includes(faultCode))) {
            this.log.error('Online product support does not appear to be for the requested fault code');
        }

        // Log detailed support information
        this.log.warn(`Online product support for fault ${faultCode}...`);
        for (const entry of details) {
            const codes = `${plural(entry.codes.length, 'fault code', false)} ${formatList(entry.codes)}`;
            let description = `[${entry.severity}] "${entry.title}" (${codes})`;
            if (entry.nextActionRequired) description += `- ${entry.nextActionRequired}`;
            this.log.warn(`${description}: "${entry.description}"`);
        }

        // Use the combined titles as the fault description
        return formatList(details.map(d => d.title));
    }
}