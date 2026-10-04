// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { BasicInformation, RvcOperationalState } from 'matterbridge/matter/clusters';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import {
    Dyson360VacuumMode,
    Dyson360EyePowerMode,
    Dyson360HeuristPowerMode,
    Dyson360TimelineEvent,
    Dyson360CleaningProgramme,
    Dyson360DockState,
    Dyson360CleaningMode,
    Dyson360ZoneCleanStatus
} from './dyson-360-types.js';
import {
    DysonDevice360Base,
    Dyson360PowerLevelMap,
    Dyson360CleanSummaryResult,
    dyson360MapState
} from './dyson-device-360-base.js';
import { Dyson360CleaningStatus, DysonDevice360ZonesMixin } from './dyson-device-360-zones.js';
import {
    dysonRenderMap360Eye,
    dysonRenderMap360VisNav
} from './dyson-device-360-map.js';
import {
    Dyson360PersistentMapMetadataResponseV1,
    Dyson360PersistentMapMetadataResponseV2,
    Dyson360PersistentMapMetadataV2,
    Dyson360PersistentMapResponseV1
} from './dyson-360-cloud-types.js';
import { DysonMqtt360, DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { assertIsDefined, formatList, MS, plural } from './utils.js';
import { DysonDeviceConstructorParams } from './dyson-device-base.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { SimplePoll } from './simple-poll.js';
import { UpdateRvcOperationalState360 } from './endpoint-360.js';
import { Dyson360MappedFaults } from './dyson-device-360-faults.js';
import { DysonMqtt360JDM } from './dyson-mqtt-360-jdm.js';

/* eslint-disable max-len */

// Common instructions for compatibility warning messages
const DYSON360_COMPATIBILITY_COMMON =
`If you are willing to help add support, please follow the detailed instructions in the project README.md for contributing MQTT logs and Proxyman API traces:
    https://github.com/thoukydides/matterbridge-dyson-robot#reporting-issues
    (expand the "Reporting Issues with Unsupported or Recently Released Products" section)`;

// Device-specific compatibility warning messages
const DYSON360_COMPATIBILITY_HEURIST =
`Support for Dyson 360 Heurist (RB02) is incomplete.

The device is currently treated similarly to a Dyson 360 Eye, with partial updates for known MQTT differences. There is a high likelihood of warnings, errors, or missing functionality. Mapping and zone cleaning are not currently supported.

${DYSON360_COMPATIBILITY_COMMON}`;

const DYSON360_COMPATIBILITY_NUROVI_R3_SPOTSCRUB =
`Support for Dyson Spot+Scrub Ai / R3 Nurovi Spot+Scrub UV (RB05) is incomplete.

Experimental support has been added based on the details provided in issue #46:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/46

There is a high likelihood of warnings, errors, or missing functionality.

${DYSON360_COMPATIBILITY_COMMON}`;

const DYSON360_COMPATIBILITY_NUROVI_R1_R2 =
`Support for Dyson R1 Nurovi Dry / R2 Nurovi Wash+Dry (RB07) is incomplete.

The device is currently treated similarly to a Dyson Spot+Scrub Ai. There is a high likelihood of warnings, errors, or missing functionality.

${DYSON360_COMPATIBILITY_COMMON}`;

/* eslint-enable max-len */

// Spot+Scrub Ai status polling behaviour
const SPOTSCRUB_POLL_STATUS_MS              = 30  * MS; // 30 seconds
const SPOTSCRUB_POLL_LIVE_MAPS_CLEANING_MS  =  3 * MS;  //  3 seconds

// A Dyson 360 Eye device
export class DysonDevice360Eye extends DysonDevice360Base {
    static readonly model = { type: 'N223', number: 'RB01', name: '360 Eye' };

    override getBatteryPartNumber = () => '968734-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Polished,
        primaryColor:   BasicInformation.Color.Nickel // (or Fuchsia for Japan limited edition)
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360EyePowerMode.Quiet,        RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360EyePowerMode.Max,          RvcCleanMode360.MaxBoost,   'Max']
    ];

    override setPowerLevel = (powerLevel: Dyson360EyePowerMode) => this.mqtt.commandSetPowerMode(powerLevel);
    override getPowerLevel = () => this.mqtt.status.defaultVacuumPowerMode;

    // Retrieve details of a completed clean
    override async getCompletedClean(cleanId: string): Promise<Dyson360CleanSummaryResult> {
        const { logMapStyle } = this.config;
        if (!this.api || logMapStyle === 'Off') return 'Unavailable';

        // Retrieve details of the specified (or most recent) clean
        const history = await this.api.getCleaningHistory360V1();
        const clean = history.Entries.find(entry => entry.Clean === cleanId);
        if (!clean)                             return 'Not found';
        if (clean.IsInterim)                    return 'Not ready';
        const map = await this.api.getMapImage360V1(cleanId);

        // Render the Map
        return dysonRenderMap360Eye(this.log, logMapStyle, clean, map);
    }
}

// A Dyson 360 Heurist device
export class DysonDevice360Heurist extends DysonDevice360Base {
    static readonly model = { type: '276', number: 'RB02', name: '360 Heurist' };

    override getBatteryPartNumber = () => '970049-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360HeuristPowerMode.Quiet,    RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360HeuristPowerMode.High,     RvcCleanMode360.High,       'High'],
        [Dyson360HeuristPowerMode.Max,      RvcCleanMode360.MaxBoost,   'Max']
    ];

    override setPowerLevel = (powerLevel: Dyson360HeuristPowerMode) => this.mqtt.commandSetPowerMode(powerLevel);
    override getPowerLevel = () => this.mqtt.status.defaultVacuumPowerMode;

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_HEURIST; }
}

// A Dyson 360 Vis Nav device
export class DysonDevice360VisNav extends DysonDevice360ZonesMixin(DysonDevice360Base) {
    static readonly model = { type: '277', number: 'RB03', name: '360 Vis Nav' };

    override getBatteryPartNumber = () => '967864-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360VacuumMode.Auto,     RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VacuumMode.Quick,    RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VacuumMode.Quiet,    RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VacuumMode.Boost,    RvcCleanMode360.MaxBoost,   'Boost']
    ];

    override setPowerLevel = (powerLevel: Dyson360VacuumMode) => this.mqtt.commandSetCleaningStrategy(powerLevel);
    override getPowerLevel = () => this.mqtt.status.defaultCleaningStrategy;

    // Update cluster attributes when the MQTT status is updated
    override async updateClusterAttributes(
        status: DysonMqttStatus<DysonMqttStatus360>
    ): Promise<void> {
        await super.updateClusterAttributes(status);

        // Update the Service Area cluster when the zone status changes
        const { currentCleaningMode: cleaningMode, cleaningProgramme, state, zoneStatus } = status;
        let cleaningStatus: Dyson360CleaningStatus | undefined;
        if (state.startsWith('FULL_CLEAN_')) {
            assertIsDefined(cleaningMode);
            if (cleaningMode === Dyson360CleaningMode.Global) {
                // No map or zone for global cleans
                cleaningStatus = { cleaningMode };
            } else if (zoneStatus) {
                // Live zone status available
                const { persistentMapId: mapId, zonesDefinitionVersion: mapVersion } = status;
                assertIsDefined(mapId);
                cleaningStatus = { cleaningMode, mapId, mapVersion, zoneStatus };
            } else if (cleaningProgramme) {
                // No live zone status, so synthesise from cleaning programme
                const zones = new Set([
                    ...(cleaningProgramme.orderedZones ?? []),
                    ...(cleaningProgramme.orderedZones ?? [])
                ]);
                cleaningStatus = {
                    cleaningMode,
                    mapId:      cleaningProgramme.persistentMapId,
                    mapVersion: cleaningProgramme.zonesDefinitionLastUpdatedDate ?? undefined,
                    zoneStatus: [...zones].map(zoneId => ({ zoneId, cleanStatus: Dyson360ZoneCleanStatus.Pending }))
                };
            }
        }
        await this.updateZoneStatus(cleaningStatus);
    }

    // Retrieve the latest persistent map metadata
    override getPersistentMapMetadata(): Promise<Dyson360PersistentMapMetadataResponseV1> | undefined {
        return this.api?.getPersistentMapMetadata360V1();
    }

    // Retrieve details of a completed clean
    override async getCompletedClean(cleanId: string): Promise<Dyson360CleanSummaryResult> {
        const { logMapStyle } = this.config;
        if (!this.api || logMapStyle === 'Off') return 'Unavailable';

        // Retrieve details of the specified (or most recent) clean
        const history = await this.api.getCleanMaps360V1();
        const clean = history.find(entry => entry.cleanId === cleanId);
        if (!clean)                             return 'Not found';
        const interim = clean.cleanTimeline.at(-1)?.eventName !== Dyson360TimelineEvent.RunEnded;
        if (interim)                            return 'Not ready';
        let persistentMap: Dyson360PersistentMapResponseV1 | undefined;
        if (clean.persistentMap) persistentMap = await this.api.getPersistentMap360V1(clean.persistentMap.id);

        // Render the map
        return dysonRenderMap360VisNav(this.log, logMapStyle, clean, persistentMap);
    }
}

// Dyson Nurovi family of devices (including Spot+Scrub Ai)
abstract class DysonDevice360NuroviBase extends DysonDevice360ZonesMixin(DysonDevice360Base) {

    // The MQTT client and status update listener
    static readonly mqttConstructor = DysonMqtt360JDM;

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360VacuumMode.Auto,     RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VacuumMode.Quick,    RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VacuumMode.Quiet,    RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VacuumMode.Boost,    RvcCleanMode360.MaxBoost,   'Boost']
    ];

    override setPowerLevel = (powerLevel: Dyson360VacuumMode) => this.mqtt.commandSetCleaningStrategy(powerLevel);
    override getPowerLevel = () => this.mqtt.status.defaultCleaningStrategy;

    // Polled updates
    pollStatus:             SimplePoll;
    pollCleaning:           SimplePoll;

    // Construct a new Dyson device instance
    constructor(...args: DysonDeviceConstructorParams<DysonMqtt360>) {
        super(...args);

        // Enable online fault code lookup
        this.faultMapper.lookupOnline = faultCode => this.findFaultOnline(faultCode);

        // Poll device status via MQTT
        this.pollStatus = new SimplePoll(this.log, 'Current status poll', SPOTSCRUB_POLL_STATUS_MS, () => {
            if (this.mqtt.status.reachable) void (async () => {
                await this.mqtt.publish('REQUEST-CURRENT-STATE', {});
            })();
        });

        // Use the live map to update the zone status
        this.pollCleaning = new SimplePoll(this.log, 'Live cleaning maps poll', SPOTSCRUB_POLL_LIVE_MAPS_CLEANING_MS, async () => {
            if (!this.api) return; // (mock devices do not support this)
            const cleaningMode = this.mqtt.status.currentCleaningMode;
            assertIsDefined(cleaningMode);
            const live = await this.api.getLiveMapsCleaning360V1();
            const zoneStatus = live.zones.map(({ id, cleanStatus }) => ({ zoneId: id, cleanStatus }));
            await this.updateZoneStatus({ mapId: live.id, cleaningMode, zoneStatus });
        });
    }

    // Update cluster attributes when the MQTT status is updated
    override async updateClusterAttributes(
        status: DysonMqttStatus<DysonMqttStatus360>
    ): Promise<void> {
        await super.updateClusterAttributes(status);

        // Start or stop live map polling when cleaning
        const { runMode } = dyson360MapState(status.state);
        if (runMode === RvcRunMode360.Cleaning) this.pollCleaning.start();
        else                                    this.pollCleaning.stop();

        // Update the Service Area cluster when not polling the live map
        if (!this.pollCleaning.isActive) await this.updateZoneStatus();
    }

    // Attempt to convert selected areas into a Dyson cleaning programme
    override async makeCleaningProgramme(areaIds: number[]): Promise<Dyson360CleaningProgramme> {
        const cleaningProgramme = await super.makeCleaningProgramme(areaIds);

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
        if (changed) {
            this.log.info('Updating persistent map with zone selection');
            await this.api?.setPersistentMapMetadata360V2(cleaningProgramme.persistentMapId, map.zones);
        } else {
            this.log.info('Zone selection does not require any change to the persistent map');
        }

        // Return the cleaning programme to start the clean via MQTT
        return cleaningProgramme;
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
    override mapOperationalState(
        status: DysonMqttStatus<DysonMqttStatus360>,
        faults: Dyson360MappedFaults
    ): UpdateRvcOperationalState360 {
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

// A Dyson Spot+Scrub Ai or R3 Nurovi Spot+Scrub UV device
export class DysonDevice360NuroviR3SpotScrub extends DysonDevice360NuroviBase {
    static readonly model = { type: 'RB05', number: 'RB05', name: 'Spot+Scrub Ai / R3 Nurovi Spot+Scrub UV' };

    override getBatteryPartNumber = () => '975571-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Matte,
        primaryColor:   BasicInformation.Color.Black
    });

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_NUROVI_R3_SPOTSCRUB; }
}

// A Dyson R1 Nurovi Dry / R2 Nurovi Wash+Dry device
export class DysonDevice360NuroviR1R2 extends DysonDevice360NuroviBase {
    static readonly model = { type: 'RB07', number: 'RB07', name: 'R1 Nurovi Dry / R2 Nurovi Wash+Dry' };

    override getBatteryPartNumber = () => '976331-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Matte,
        primaryColor:   BasicInformation.Color.White
    });

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_NUROVI_R1_R2; }
}

// List of constructors for Dyson robot vacuum devices
export const DYSON_DEVICE_TYPES_360 = [
    DysonDevice360Eye,
    DysonDevice360Heurist,
    DysonDevice360VisNav,
    DysonDevice360NuroviR3SpotScrub,
    DysonDevice360NuroviR1R2
] as const;