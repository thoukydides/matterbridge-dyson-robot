// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360ZoneCleanStatus,
    Dyson360ZoneIcon,
    Dyson360ZoneStatus,
    Dyson360ZoneType
} from './dyson-360-types.js';
import { CommonAreaNamespaceTag } from 'matterbridge/matter';
import { dyson360MapState, DysonDevice360Base } from './dyson-device-360-base.js';
import { AbstractConstructor, assertIsDefined, MS } from './utils.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { SelectAreaError } from './error-360.js';
import { Endpoint360, EndpointOptions360, formatAreaName } from './endpoint-360.js';
import { DysonDevice360Command, DysonDevice360CommandHandlers } from './dyson-device-360-commands.js';
import { logError } from './log-error.js';
import { isDeepStrictEqual } from 'node:util';
import {
    Dyson360PersistentMapMetadataV1,
    Dyson360PersistentMapMetadataV2
} from './dyson-360-cloud-types.js';
import { RvcRunMode360 } from './endpoint-360-behavior.js';

// Mapping of Dyson area icons/names to Matter common areas
type LocationType = number | null;
type LocationTypeMapping = LocationType | [RegExp, LocationType][];
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

// Mapping of Dyson zone cleaning status to Matter Service Area cleaning status
const PROGRESS_MAP: Record<Dyson360ZoneCleanStatus, ServiceArea.OperationalStatus> = {
    [Dyson360ZoneCleanStatus.NotRequested]: ServiceArea.OperationalStatus.Skipped,
    [Dyson360ZoneCleanStatus.Unable]:       ServiceArea.OperationalStatus.Skipped,
    [Dyson360ZoneCleanStatus.Pending]:      ServiceArea.OperationalStatus.Pending,
    [Dyson360ZoneCleanStatus.InProgress]:   ServiceArea.OperationalStatus.Operating,
    [Dyson360ZoneCleanStatus.Complete]:     ServiceArea.OperationalStatus.Completed
};
function mapProgress(status: Dyson360ZoneCleanStatus, isCleaning: boolean): ServiceArea.OperationalStatus {
    let result = PROGRESS_MAP[status];
    const ACTIVE_STATUS = [ServiceArea.OperationalStatus.Pending, ServiceArea.OperationalStatus.Operating];
    if (!isCleaning && ACTIVE_STATUS.includes(result)) result = ServiceArea.OperationalStatus.Skipped;
    return result;
}

// Zone type within the persistent map metadata
type PersistentMapMetadata = Dyson360PersistentMapMetadataV1 | Dyson360PersistentMapMetadataV2;
type PersistentMapMetadataZone = PersistentMapMetadata['zones'][number];

// Zone cleaning status with its associated persistent map identifier
export interface Dyson360CleaningStatusFields {
    mapId:          string;
    mapVersion?:    string;
    zoneStatus:     Dyson360ZoneStatus[];
}
export type Dyson360CleaningStatus =
    ({ cleaningMode: Dyson360CleaningMode.Global         } & Partial<Dyson360CleaningStatusFields>)
  | ({ cleaningMode: Dyson360CleaningMode.ZoneConfigured } &         Dyson360CleaningStatusFields );

// Return the cleaning programme with zone cleaning commands to enable overrides
export interface DysonDevice360ZoneCommand extends DysonDevice360Command {
    cleaningProgramme:  Dyson360CleaningProgramme;
}

// Interval between map update checks without zonesDefinitionLastUpdatedDate
const MAP_REFRESH_INTERVAL_MS = 5 * 60 * MS; // 5 minutes

// Mixin to add zone cleaning to a Dyson robot vacuum device
export function DysonDevice360ZonesMixin<TBase extends AbstractConstructor<DysonDevice360Base>>(Base: TBase) {
    abstract class DysonDevice360WithZones extends Base {

        // The current attribute values for the Service Area cluster
        supportedMaps:  ServiceArea.Map[]   = [];
        supportedAreas: ServiceArea.Area[]  = [];

        // Map of current Matter identifiers to latest Dyson maps and zones
        mapFromMatter   = new Map<number, PersistentMapMetadata>();
        zoneFromMatter  = new Map<number, [PersistentMapMetadata, PersistentMapMetadataZone]>();

        // Map of Dyson maps and zones to Matter identifiers (inc. obsolete)
        mapToMatter     = new Map<string, number>();
        zoneToMatter    = new Map<string, number>();

        // The next map and area identifiers to allocate
        nextMapId       = 1;
        nextAreaId      = 1;

        // When were the maps last updated (in milliseconds since the epoch)
        lastMapFetch    = 0;

        // Cache of zone cleaning status (for use when not cleaning)
        zoneStatusCache?: Dyson360CleaningStatus;

        // Mixin constructor
        constructor(...args: any[]) {
            super(...args as ConstructorParameters<TBase>);

            // Perform an initial fetch of the persistent maps
            void (async () => {
                try { await this.updateMaps(); } catch (err) { logError(this.log, 'Retrieving maps', err); }
            })();
        }

        // Attach command handlers to the endpoint
        override attachCommandHandlers(endpoint: Endpoint360): DysonDevice360CommandHandlers {
            const handlers = super.attachCommandHandlers(endpoint);
            handlers.attachSelectAreasHandler(
                this.makeCleaningProgramme.bind(this),
                (areaId: number) => formatAreaName(this.supportedMaps, this.supportedAreas, areaId)
            );
            return handlers;
        }

        // Add map capability
        getEndpointOptions(): EndpointOptions360 {
            const endpointOptions = super.getEndpointOptions();
            endpointOptions.supportsMaps = true;
            return endpointOptions;
        }

        // Update the Service Area cluster when the zone status changes
        async updateZoneStatus(cleaningStatus?: Dyson360CleaningStatus): Promise<void> {
            const { state, persistentMapId, zonesDefinitionVersion, zoneId } = this.mqtt.status;
            const { runMode } = dyson360MapState(state);

            // Update the zone status cache depending on the robot's state
            if (runMode === RvcRunMode360.Mapping) {
                // Avoid stale status during mapping
                this.zoneStatusCache = undefined;
            } else if (cleaningStatus) {
                // Cache provided status (even if clean has already finished)
                this.zoneStatusCache = cleaningStatus;
            } else if (runMode === RvcRunMode360.Cleaning) {
                // No usable data yet for the clean in progress
                this.log.info('Cleaning status not yet available for current clean');
                return;
            } else {
                // Idle with nothing new; use cached status from last clean
            }

            // If the current zone is known then map it to a Matter area
            let currentArea: number | null = null;
            if (persistentMapId && zoneId && await this.checkMap(persistentMapId, zonesDefinitionVersion)) {
                currentArea = this.findAreaId(persistentMapId, zoneId);
            }

            // If zone cleaning then attempt to set the areas and progress
            const progress:         ServiceArea.Progress[] = [];
            const selectedAreas:    number[]               = [];
            if (this.zoneStatusCache?.cleaningMode === Dyson360CleaningMode.ZoneConfigured) {
                const { mapId, mapVersion, zoneStatus } = this.zoneStatusCache;
                if (await this.checkMap(mapId, mapVersion)) {
                    for (const { zoneId, cleanStatus } of zoneStatus) {
                        if (cleanStatus === Dyson360ZoneCleanStatus.NotRequested) continue;

                        // Map the zone to a Matter area
                        const areaId = this.findAreaId(mapId, zoneId);
                        if (!areaId) continue;

                        // Add this zone to both the selected areas and progress
                        selectedAreas.push(areaId);
                        const status = mapProgress(cleanStatus, runMode === RvcRunMode360.Cleaning);
                        progress.push({ areaId, status });

                        // Current location is zone being cleaned unless known
                        if (cleanStatus === Dyson360ZoneCleanStatus.InProgress) currentArea ??= areaId;
                    }
                }
            }

            // Update the Service Area cluster attributes
            await this.endpoint?.updateServiceArea({
                currentArea,
                progress,
                selectedAreas,
                supportedAreas: this.supportedAreas,
                supportedMaps:  this.supportedMaps
            });
        }

        // Attempt to convert selected areas into a Dyson cleaning programme
        async makeCleaningProgramme(areaIds: number[]): Promise<DysonDevice360ZoneCommand> {
            // Ensure that the latest maps are being used
            if (await this.updateMaps()) {
                // New maps retrieved, so update the supported maps and areas
                await this.endpoint?.updateServiceArea({
                    currentArea:    null,
                    progress:       [],
                    selectedAreas:  [],
                    supportedAreas: this.supportedAreas,
                    supportedMaps:  this.supportedMaps
                });
            }

            // Map the Matter area identifiers to Dyson map and zone identifiers
            const maps = new Set<PersistentMapMetadata>();
            const unorderedZones: string[] = [];
            for (const areaId of areaIds) {
                const zone = this.zoneFromMatter.get(areaId);
                if (!zone) throw new SelectAreaError.UnsupportedArea(`${areaId} is not a supported area`);
                maps.add(zone[0]);
                unorderedZones.push(zone[1].id);
            }
            if (maps.size !== 1) throw new SelectAreaError.InvalidSet('Areas must all be from the same map');
            const [map] = maps;
            assertIsDefined(map);

            // Build the cleaning programme
            const cleaningProgramme: Dyson360CleaningProgramme = {
                orderedZones:                   [],
                persistentMapId:                map.id,
                unorderedZones,
                zonesDefinitionLastUpdatedDate: 'zonesDefinitionLastUpdatedDate' in map
                                                ? map.zonesDefinitionLastUpdatedDate : null
            };
            return {
                description:    'ZoneClean',
                command:        () => this.mqtt.commandAction('START', cleaningProgramme),
                condition:      () => true,
                cleaningProgramme
            };
        }

        // Check whether the persistent maps have changed and update if necessary
        async checkMap(persistentMapId: string, rvcVersion?: string): Promise<boolean> {
            const findMap = (): PersistentMapMetadata | undefined =>
                [...this.mapFromMatter.values()].find(({ id }) => id === persistentMapId);
            const getMapVersion = (map: PersistentMapMetadata): string | undefined => {
                if (!('zonesDefinitionLastUpdatedDate' in map)) return undefined;
                return map.zonesDefinitionLastUpdatedDate ?? ''; // sorts before all dates
            };
            const isFreshEnough = (map: PersistentMapMetadata): boolean => {
                const myVersion = getMapVersion(map);
                return myVersion === undefined
                    ? Date.now() - this.lastMapFetch < MAP_REFRESH_INTERVAL_MS
                    : !rvcVersion || rvcVersion <= myVersion;
            };

            // First check whether the matching map and version is already known
            let map = findMap();
            if (map && isFreshEnough(map)) {
                const myVersion = getMapVersion(map);
                if (myVersion !== undefined && rvcVersion && rvcVersion < myVersion) {
                    this.log.info(`RVC map ${persistentMapId} is out of date (${rvcVersion} < ${myVersion})`);
                }
                return true;
            }

            // Retrieve the latest maps and then check again
            await this.updateMaps();
            map = findMap();
            if (map) {
                // Tolerate but warn of version mismatches
                const myVersion = getMapVersion(map);
                if (myVersion !== undefined && rvcVersion) {
                    if (rvcVersion < myVersion) {
                        this.log.info(`RVC map ${persistentMapId} is out of date (${rvcVersion} < ${myVersion})`);
                    } else if (myVersion < rvcVersion) {
                        this.log.warn(`RVC map ${persistentMapId} is more recent than cloud (${rvcVersion} > ${myVersion})`);
                    }
                }
                return true;
            }
            if (this.api) this.log.warn(`RVC map ${persistentMapId} does not exist`);
            return false;
        }

        // Retrieve the latest persistent maps
        async updateMaps(): Promise<boolean> {
            // Retrieve the latest persistent map metadata
            const metadata = await this.getPersistentMapMetadata();
            if (!metadata) return false;
            this.lastMapFetch = Date.now();

            // Check for any changes
            let changed = false;
            const oldMetadata = [...this.mapFromMatter.values()];
            for (const map of metadata) {
                const oldMap = oldMetadata.find(({ id }) => id === map.id);
                if (this.hasMapChanged(map, oldMap)) {
                    changed = true;
                    this.log.info(`Map ${map.id} ${oldMap ? 'updated' : 'added'}`);
                }
            }
            for (const map of oldMetadata) {
                if (!metadata.some(({ id }) => id === map.id)) {
                    changed = true;
                    this.log.info(`Map ${map.id} deleted`);
                }
            }

            // Rebuild the Matter maps and areas if changed
            if (changed) this.rebuildMatterMaps(metadata);
            return changed;
        }

        // Retrieve the latest persistent map metadata
        abstract getPersistentMapMetadata(): Promise<PersistentMapMetadata[]> | undefined;

        // Check whether there are Matter-relevant changes to a map
        hasMapChanged(a: PersistentMapMetadata, b?: PersistentMapMetadata): boolean {
            const signature = (map: PersistentMapMetadata) => {
                // Sort zones by their ID to ensure consistent comparison
                const { name, id } = map;
                const zones = [...map.zones].sort((a, b) => a.id.localeCompare(b.id));
                return 'zoneProperties' in map ? { id, name, zones, zoneProperties: map.zoneProperties } : { id, name, zones };
            };
            return !b || !isDeepStrictEqual(signature(a), signature(b));
        }

        // Rebuild the Matter mapping for maps and zones
        rebuildMatterMaps(maps: PersistentMapMetadata[]): void {
            // Discard any previous mappings
            this.mapFromMatter.clear();
            this.zoneFromMatter.clear();
            this.supportedMaps = [];
            this.supportedAreas = [];

            // Process each map and zone to build new mappings
            for (const map of maps) {
                // Create a Matter map entry
                const mapId = this.makeMapId(map);
                const supportedMap: ServiceArea.Map = {
                    mapId,
                    name:   map.name?.substring(0, 64) ?? ''
                };
                this.supportedMaps.push(supportedMap);
                this.mapFromMatter.set(mapId, map);

                // Create a Matter area entry for each zone
                for (const zone of map.zones) {
                    const areaId = this.makeAreaId(map, zone);
                    const supportedArea: ServiceArea.Area = {
                        mapId,
                        areaId,
                        areaInfo: {
                            locationInfo: {
                                locationName:   zone.name.substring(0, 128),
                                floorNumber:    null,
                                areaType:       this.makeLocationAreaType(zone)
                            },
                            landmarkInfo: null
                        }
                    };
                    this.supportedAreas.push(supportedArea);
                    this.zoneFromMatter.set(areaId, [map, zone]);
                }
            }
        }

        // Lookup or create a Matter map identifier for a Dyson map
        makeMapId(map: PersistentMapMetadata): number {
            const mapKey = map.id;
            const mapId = this.mapToMatter.get(mapKey) ?? this.nextMapId++;
            this.mapToMatter.set(mapKey, mapId);
            return mapId;
        }

        // Lookup or create a Matter area identifier for a Dyson zone
        makeAreaId(map: PersistentMapMetadata, zone: PersistentMapMetadataZone): number {
            let zoneKey = `${map.id}|${zone.name}`;
            // Custom zones might not be unique, so distinguish by area too
            const isCustom = 'type' in zone
                ? zone.type === Dyson360ZoneType.Custom
                : zone.icon === Dyson360ZoneIcon.Custom;
            if (isCustom) zoneKey += `|${zone.area}`;
            const areaId = this.zoneToMatter.get(zoneKey) ?? this.nextAreaId++;
            this.zoneToMatter.set(zoneKey, areaId);
            return areaId;
        }

        // Attempt to map Dyson map and zone identifiers to a Matter area identifier
        findAreaId(persistentMapId: string, zoneId: string): number | null {
            for (const [areaId, [map, zone]] of this.zoneFromMatter.entries()) {
                if ((map.id === persistentMapId) && (zone.id === zoneId)) {
                    return areaId;
                }
            }
            return null;
        }

        // Map a Dyson zone to a Matter common area tag
        makeLocationAreaType(zone: PersistentMapMetadataZone): LocationType {
            if ('type' in zone) {
                // Spot+Scrub Ai zone types match Matter location types
                const type = zone.type.toLowerCase();
                const key = Object.keys(CommonAreaNamespaceTag).find(k => k.toLowerCase() === type);
                return key ? CommonAreaNamespaceTag[key as keyof typeof CommonAreaNamespaceTag].tag : null;
            } else {
                // Use an explicit mapping table for 360 Vis Nav zone icons
                const mapping = LOCATION_ICON_MAP[zone.icon];
                if (!Array.isArray(mapping)) return mapping;
                const match = mapping.find(([re]) => re.test(zone.name));
                return match ? match[1] : null;
            }
        }
    }
    return DysonDevice360WithZones;
}