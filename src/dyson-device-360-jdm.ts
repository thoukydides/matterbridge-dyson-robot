// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { RvcOperationalState } from 'matterbridge/matter/clusters';
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
import { DysonMqtt360, DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { assertIsDefined, formatList, MS, plural } from './utils.js';
import { DysonDeviceConstructorParams } from './dyson-device-base.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { PeriodicOp } from './periodic-op.js';
import { DysonMqtt360JDM } from './dyson-mqtt-360-jdm.js';
import { Endpoint360, EndpointOptions360, UpdateRvcOperationalState360 } from './endpoint-360.js';
import { Dyson360MappedFaults } from './dyson-device-360-faults.js';
import { DysonDevice360CommandHandlers } from './dyson-device-360-commands.js';

// Spot+Scrub Ai status polling behaviour
const POLL_STATUS_MS                =  30 * MS; // 30 seconds
const POLL_STATUS_RAPID_MS          =   1 * MS; //  1 second
const POLL_LIVE_MAPS_CLEANING_MS    = 3.5 * MS; // 3½ seconds

// Common base class for Dyson post-360 robot vacuum devices (excluding mop)
export abstract class DysonDevice360JDMBase extends DysonDevice360ZonesMixin(DysonDevice360Base) {

    // The MQTT client and status update listener with JDM endpoints
    static readonly mqttConstructor = DysonMqtt360JDM;

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360VacuumMode.Auto,   RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VacuumMode.Quick,  RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VacuumMode.Quiet,  RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VacuumMode.Boost,  RvcCleanMode360.MaxBoost,   'Boost']
    ];

    override setPowerLevel = (powerLevel: Dyson360VacuumMode) => this.mqtt.commandSetCleaningStrategy(powerLevel);
    override getDefaultPowerLevel = () => this.mqtt.status.defaultCleaningStrategy;
    override getCurrentPowerLevel = () => this.mqtt.status.currentCleaningStrategy;

    // Add dock emptying dustbin capability
    getEndpointOptions(): EndpointOptions360 {
        const endpointOptions = super.getEndpointOptions();
        endpointOptions.rvcOperationalState.supportsEmptyingDustBin = true;
        return endpointOptions;
    }

    // Polled updates
    pollStatus:     PeriodicOp;
    pollCleaning:   PeriodicOp;

    // Construct a new Dyson device instance
    constructor(...args: DysonDeviceConstructorParams<DysonMqtt360>) {
        super(...args);

        // Enable online fault code lookup
        this.faultMapper.lookupOnline = faultCode => this.findFaultOnline(faultCode);

        // Poll device status via MQTT
        this.pollStatus = new PeriodicOp(this.log, {
            name:           'Current status poll',
            interval:       POLL_STATUS_MS,
            intervalRapid:  POLL_STATUS_RAPID_MS,
            op:             () => {
                if (this.mqtt.status.reachable) {
                    return this.mqtt.publish('REQUEST-CURRENT-STATE', {});
                }
            }}
        );

        // Use the live map to update the zone status
        this.pollCleaning = new PeriodicOp(this.log, {
            name:           'Live cleaning maps poll',
            interval:       POLL_LIVE_MAPS_CLEANING_MS,
            op:             async () => {
                if (!this.api) return; // (mock devices do not support this)
                const cleaningMode = this.mqtt.status.currentCleaningMode;
                assertIsDefined(cleaningMode);
                const live = await this.api.getLiveMapsCleaning360V1();
                const zoneStatus = live.zones.map(({ id, cleanStatus }) => ({ zoneId: id, cleanStatus }));
                await this.updateZoneStatus({ mapId: live.id, cleaningMode, zoneStatus });
            }}
        );
    }

    // Attach command handlers to the endpoint
    override attachCommandHandlers(endpoint: Endpoint360): DysonDevice360CommandHandlers {
        const handlers = super.attachCommandHandlers(endpoint);
        handlers.rapidPollRequest = this.pollStatus.requestRapid.bind(this.pollStatus);
        return handlers;
    }

    // Update cluster attributes when the MQTT status is updated
    override async updateClusterAttributes(status: DysonMqttStatus<DysonMqttStatus360>): Promise<void> {
        await super.updateClusterAttributes(status);

        // Start or stop live map polling when cleaning
        const { runMode } = dyson360MapState(status.state);
        if (runMode === RvcRunMode360.Cleaning) this.pollCleaning.start();
        else                                    this.pollCleaning.stop();

        // Update the Service Area cluster when not polling the live map
        if (!this.pollCleaning.isActive) await this.updateZoneStatus();
    }

    // Attempt to convert selected areas into a Dyson cleaning programme
    override async makeCleaningProgramme(areaIds: number[]): Promise<DysonDevice360ZoneCommand> {
        const programme = await super.makeCleaningProgramme(areaIds);
        const { command, cleaningProgramme } = programme;

        // Select and order the zones before the clean is started
        const map = this.mapFromMatter.values().find(m => m.id === cleaningProgramme.persistentMapId) as
            Dyson360PersistentMapMetadataV2 | undefined;
        assertIsDefined(map);
        let changed = false;
        for (const zone of map.zones) {
            const isSelected = cleaningProgramme.unorderedZones?.includes(zone.id) ?? false;
            if (zone.isSelected === isSelected) continue;
            zone.isSelected = isSelected;
            changed = true;
        }
        const preCommand = async (): Promise<void> => {
            if (changed) {
                this.log.info('Updating persistent map with zone selection');
                await this.api?.setPersistentMapMetadata360V2(cleaningProgramme.persistentMapId, map.zones);
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
            },
            cleaningProgramme
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
    }

    // Stop the device when Matterbridge is shutting down
    override async stop(): Promise<void> {
        this.pollStatus.stop();
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