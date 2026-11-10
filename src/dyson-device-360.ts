// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { BasicInformation } from 'matterbridge/matter/clusters';
import {
    Dyson360VacuumMode,
    Dyson360EyePowerMode,
    Dyson360HeuristPowerMode,
    Dyson360TimelineEvent,
    Dyson360CleaningMode,
    Dyson360ZoneCleanStatus,
    Dyson360ZoneIcon
} from './dyson-360-types.js';
import {
    DysonDevice360Base,
    Dyson360PowerLevelMap,
    Dyson360CleanSummaryResult
} from './dyson-device-360-base.js';
import {
    Dyson360CleaningStatus,
    Dyson360CommonAreaTag,
    Dyson360CurrentZone,
    Dyson360ZoneFingerprints,
    DysonDevice360ZonesMixin
} from './dyson-device-360-zones.js';
import {
    dysonRenderMap360Eye,
    dysonRenderMap360VisNav
} from './dyson-device-360-map.js';
import {
    Dyson360PersistentMapMetadataResponseV1,
    Dyson360PersistentMapMetadataV1,
    Dyson360PersistentMapMetadataZoneV1,
    Dyson360PersistentMapResponseV1
} from './dyson-360-cloud-types.js';
import { DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { assertIsDefined } from './utils.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { DysonDevice360MopMixin } from './dyson-device-360-mop.js';
import { DysonDevice360JdmBase } from './dyson-device-360-jdm.js';
import { CommonAreaNamespaceTag } from 'matterbridge/matter';

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

const DYSON360_COMPATIBILITY_SPOTSCRUB =
`Support for Dyson Spot+Scrub Ai (RB05) is incomplete.

Experimental support has been added based on the details provided in issue #46:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/46

There is a high likelihood of warnings, errors, or missing functionality.

${DYSON360_COMPATIBILITY_COMMON}`;

const DYSON360_COMPATIBILITY_R2_NUROVI =
`Support for Dyson R2 Nurovi Wash+Dry (RB07) is incomplete.

Experimental support has been added based on the details provided in issues #50 and #53:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/50
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/53

There is a high likelihood of warnings, errors, or missing functionality.

${DYSON360_COMPATIBILITY_COMMON}`;

const DYSON360_COMPATIBILITY_R1R3_NUROVI =
`Support for Dyson R1 Nurovi Dry (RB07) and R3 Nurovi Spot+Scrub UV (RB05), is incomplete.

These devices are currently treated similarly to a Dyson Spot+Scrub Ai. There is a high likelihood of warnings, errors, or missing functionality.

${DYSON360_COMPATIBILITY_COMMON}`;

// Mapping of Dyson 360 Vis Nav area icons/names to Matter common areas
type LocationTypeMapping = Dyson360CommonAreaTag | [RegExp, Dyson360CommonAreaTag][];
const LOCATION_ICON_MAP: Record<Dyson360ZoneIcon, LocationTypeMapping> = {
    [Dyson360ZoneIcon.Balcony]:     CommonAreaNamespaceTag.Balcony.tag,
    [Dyson360ZoneIcon.Bathroom]:    CommonAreaNamespaceTag.Bathroom.tag,
    [Dyson360ZoneIcon.Bedroom]: [
        [/^Guest room$/i,           CommonAreaNamespaceTag.GuestBedroom.tag],
        [/^/,                       CommonAreaNamespaceTag.Bedroom.tag]
    ],
    [Dyson360ZoneIcon.DiningRoom]:  CommonAreaNamespaceTag.Dining.tag,
    [Dyson360ZoneIcon.Hallway]:     CommonAreaNamespaceTag.Hallway.tag,
    [Dyson360ZoneIcon.Kitchen]:     CommonAreaNamespaceTag.Kitchen.tag,
    [Dyson360ZoneIcon.LivingRoom]:  CommonAreaNamespaceTag.LivingRoom.tag,
    [Dyson360ZoneIcon.MainBedroom]: CommonAreaNamespaceTag.PrimaryBedroom.tag,
    [Dyson360ZoneIcon.Study]:       CommonAreaNamespaceTag.Study.tag,
    [Dyson360ZoneIcon.Toilet]:      CommonAreaNamespaceTag.Toilet.tag,
    [Dyson360ZoneIcon.UtilityRoom]: CommonAreaNamespaceTag.UtilityRoom.tag,
    [Dyson360ZoneIcon.Work]:        CommonAreaNamespaceTag.Office.tag,
    [Dyson360ZoneIcon.Custom]:      null
};

/* eslint-enable max-len */

// =============================================================================
// Dyson 360 robot vacuum family...

// A Dyson 360 Eye device
export class DysonDevice360Eye extends DysonDevice360Base {
    static override readonly model = { type: 'N223', number: 'RB01', name: '360 Eye' };

    override getBatteryPartNumber = () => '968734-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Polished,
        primaryColor:   BasicInformation.Color.Nickel // (or Fuchsia for Japan limited edition)
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360EyePowerMode.Quiet,    'Quiet',    ['Quiet', 'Night', 'LowEnergy', 'LowNoise', 'Min']],
        [Dyson360EyePowerMode.Max,      'Max',      ['Max',   'Day',   'DeepClean']]
    ];

    override setPowerLevel = (powerLevel: Dyson360EyePowerMode) => this.mqtt.commandSetPowerMode(powerLevel);
    override getDefaultPowerLevel = () => this.mqtt.status.defaultVacuumPowerMode;
    override getCurrentPowerLevel = () => this.mqtt.status.currentVacuumPowerMode;

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

// -----------------------------------------------------------------------------

// A Dyson 360 Heurist device
export class DysonDevice360Heurist extends DysonDevice360Base {
    static override readonly model = { type: '276', number: 'RB02', name: '360 Heurist' };

    override getBatteryPartNumber = () => '970049-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360HeuristPowerMode.Quiet,    'Quiet',    ['Quiet',     'Night', 'LowEnergy', 'LowNoise', 'Min']],
        [Dyson360HeuristPowerMode.High,     'High',     ['DeepClean', 'Day']],
        [Dyson360HeuristPowerMode.Max,      'Max',      ['Max',       'Day']]
    ];

    override setPowerLevel = (powerLevel: Dyson360HeuristPowerMode) => this.mqtt.commandSetPowerMode(powerLevel);
    override getDefaultPowerLevel = () => this.mqtt.status.defaultVacuumPowerMode;
    override getCurrentPowerLevel = () => this.mqtt.status.currentVacuumPowerMode;

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_HEURIST; }
}

// -----------------------------------------------------------------------------

// A Dyson 360 Vis Nav device
export class DysonDevice360VisNav
    extends DysonDevice360ZonesMixin<Dyson360PersistentMapMetadataV1, typeof DysonDevice360Base>
    (DysonDevice360Base) {
    static override readonly model = { type: '277', number: 'RB03', name: '360 Vis Nav' };

    override getBatteryPartNumber = () => '967864-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerLevelMaps = (): Dyson360PowerLevelMap[] => [
        [Dyson360VacuumMode.Auto,   'Auto',   ['Auto',  'Day']],
        [Dyson360VacuumMode.Quick,  'Quick',  ['Quick', 'Day',   'LowEnergy']],
        [Dyson360VacuumMode.Quiet,  'Quiet',  ['Quiet', 'Night', 'LowEnergy', 'LowNoise', 'Min']],
        [Dyson360VacuumMode.Boost,  'Boost',  ['Max',   'Day',   'DeepClean']]
    ];

    override setPowerLevel = (powerLevel: Dyson360VacuumMode) => this.mqtt.commandSetCleaningStrategy(powerLevel);
    override getDefaultPowerLevel = () => this.mqtt.status.defaultCleaningStrategy;
    override getCurrentPowerLevel = () => this.mqtt.status.currentCleaningStrategy;

    // Update cluster attributes when the MQTT status is updated
    override async updateClusterAttributes(
        status: DysonMqttStatus<DysonMqttStatus360>
    ): Promise<void> {
        await super.updateClusterAttributes(status);

        // Update the Service Area cluster when the zone status changes
        const { currentCleaningMode: cleaningMode, cleaningProgramme, state, zoneStatus } = status;
        let cleaningStatus: Dyson360CleaningStatus | undefined;
        let currentZone: Dyson360CurrentZone | undefined;
        if (state.startsWith('FULL_CLEAN_')) {
            assertIsDefined(cleaningMode);
            const { persistentMapId: mapId, zonesDefinitionVersion: mapVersion, zoneId } = status;
            if (cleaningMode === Dyson360CleaningMode.Global) {
                // No zone status for global cleans
                cleaningStatus = { cleaningMode };
            } else if (zoneStatus) {
                // Live zone status available (but persistent map might not)
                if (mapId) cleaningStatus = { cleaningMode, mapId, mapVersion, zoneStatus };
            } else if (cleaningProgramme && 'orderedZones' in cleaningProgramme) {
                // No live zone status, so synthesise from cleaning programme
                const zones = new Set([
                    ...cleaningProgramme.unorderedZones,
                    ...(cleaningProgramme.orderedZones ?? [])
                ]);
                cleaningStatus = {
                    cleaningMode,
                    mapId:      cleaningProgramme.persistentMapId,
                    mapVersion: cleaningProgramme.zonesDefinitionLastUpdatedDate ?? undefined,
                    zoneStatus: [...zones].map(zoneId => ({ zoneId, cleanStatus: Dyson360ZoneCleanStatus.Pending }))
                };
                this.log.debug(`ZONE STATUS FROM PROGRAM: ${JSON.stringify(cleaningStatus)}`);
            }

            // The robot's current zone might be known regardless of clean type
            if (mapId && zoneId) currentZone = { mapId, mapVersion, zoneId };
        }
        await this.updateZoneStatus(cleaningStatus, currentZone);
    }

    // Retrieve the latest persistent map metadata
    override getPersistentMapMetadata(): Promise<Dyson360PersistentMapMetadataResponseV1> | undefined {
        return this.api?.getPersistentMapMetadata360V1();
    }

    // Generate fingerprints for a Dyson zone
    override getZoneFingerprints(zone: Dyson360PersistentMapMetadataZoneV1): Dyson360ZoneFingerprints {
        const fingerprints = super.getZoneFingerprints(zone);
        if (zone.icon !== Dyson360ZoneIcon.Custom) fingerprints.icon = zone.icon;
        return fingerprints;
    }

    // Use explicit table to map 360 Vis Nav zone icon to Matter common area tag
    override getZoneCommonAreaTag(zone: Dyson360PersistentMapMetadataZoneV1): Dyson360CommonAreaTag {
        const mapping = LOCATION_ICON_MAP[zone.icon];
        if (!Array.isArray(mapping)) return mapping;
        const match = mapping.find(([re]) => re.test(zone.name));
        return match ? match[1] : null;
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

// =============================================================================
// Dyson Spot+Scrub Ai and Nurovi robot vacuum families...

// A Dyson Spot+Scrub Ai device
export class DysonDevice360SpotScrub extends DysonDevice360MopMixin(DysonDevice360JdmBase) {
    static override readonly model = { type: 'RB05', number: 'RB05', variants: ['A', 'E'], name: 'Spot+Scrub Ai' };

    override getBatteryPartNumber = () => '975571-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Matte,
        primaryColor:   BasicInformation.Color.Black
    });

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_SPOTSCRUB; }
}

// -----------------------------------------------------------------------------

// Common base class for Dyson Nurovi family devices
export abstract class DysonDevice360NuroviBase extends DysonDevice360JdmBase {

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Matte,
        primaryColor:   BasicInformation.Color.White
    });
}

// -----------------------------------------------------------------------------

// A Dyson R1 Nurovi Dry device (no mop)
export class DysonDevice360R1NuroviDry extends DysonDevice360NuroviBase {
    static override readonly model = { type: 'RB07', number: 'RB07', variants: [''], name: 'R1 Nurovi Dry' };
    override getBatteryPartNumber = () => '976331-01';

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_R1R3_NUROVI; }
}

// A Dyson R2 Nurovi Wash+Dry device
export class DysonDevice360R2NuroviWashDry extends DysonDevice360MopMixin(DysonDevice360NuroviBase) {
    static override readonly model = { type: 'RB07', number: 'RB07', variants: ['A'], name: 'R2 Nurovi Wash+Dry' };
    override getBatteryPartNumber = () => '976331-01';

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_R2_NUROVI; }
}

// A Dyson R3 Nurovi Spot+Scrub UV device
export class DysonDevice360R3NuroviSpotScrub extends DysonDevice360MopMixin(DysonDevice360NuroviBase) {
    static override readonly model = { type: 'RB05', number: 'RB05', variants: ['B', 'F'], name: 'R3 Nurovi Spot+Scrub UV' };
    override getBatteryPartNumber = () => '975571-01';

    override get compatibilityWarning() { return DYSON360_COMPATIBILITY_R1R3_NUROVI; }
}

// =============================================================================

// List of constructors for Dyson robot vacuum devices
export const DYSON_DEVICE_TYPES_360 = [
    DysonDevice360Eye,
    DysonDevice360Heurist,
    DysonDevice360VisNav,
    DysonDevice360SpotScrub,
    DysonDevice360R3NuroviSpotScrub,
    DysonDevice360R1NuroviDry,
    DysonDevice360R2NuroviWashDry
] as const;