// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360CleaningProgrammeZones,
    Dyson360ZoneCleanStatus,
    Dyson360ZoneStatus
} from './dyson-360-types.js';
import { dyson360MapState, DysonDevice360Base } from './dyson-device-360-base.js';
import { AbstractConstructor, assertIsDefined, MS, plural } from './utils.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { SelectAreaError } from './error-360.js';
import { Endpoint360, EndpointOptions360, formatAreaName } from './endpoint-360.js';
import {
    DysonDevice360Command,
    DysonDevice360CommandHandlers
} from './dyson-device-360-commands.js';
import { logError } from './log-error.js';
import { isDeepStrictEqual } from 'node:util';
import { RvcRunMode360 } from './endpoint-360-behavior.js';
import { DysonMqtt360Msg } from './dyson-mqtt-360.js';
import { setTimeout } from 'node:timers/promises';
import { Semtag } from 'matterbridge/matter/types';
import { Dyson360PersistentMapMetadataZoneBase } from './dyson-360-cloud-types.js';

// Mapping of Dyson area icons/names to Matter common areas
export type Dyson360CommonAreaTag = Semtag['tag'] | null;

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

// Persistent map metadata common structure
export interface Dyson360MapMetadata {
    id:                                 string;
    name:                               string | null;
    zones:                              Dyson360PersistentMapMetadataZoneBase[];
    zonesDefinitionLastUpdatedDate?:    string | null;
}
type PersistentMapMetadataZone<TMap extends Dyson360MapMetadata> = TMap['zones'][number];

// Zone cleaning status with its associated persistent map identifier
export interface Dyson360CleaningStatusFields {
    mapId:          string;
    mapVersion?:    string;
    zoneStatus:     Dyson360ZoneStatus[];
}
export type Dyson360CleaningStatus =
    ({ cleaningMode: Dyson360CleaningMode.Global | Dyson360CleaningMode.Spot } & Partial<Dyson360CleaningStatusFields>)
  | ({ cleaningMode: Dyson360CleaningMode.Zones                              } &         Dyson360CleaningStatusFields );

// Current zone location
export interface Dyson360CurrentZone {
    mapId:          string;
    mapVersion?:    string;
    zoneId:         string;
}

// Return the cleaning programme with zone cleaning commands to enable overrides
export interface DysonDevice360ZoneCommand extends DysonDevice360Command {
    cleaningProgramme:  Dyson360CleaningProgrammeZones;
}

// Interval between map update checks without zonesDefinitionLastUpdatedDate
const MAP_REFRESH_INTERVAL_MS = 5 * 60 * MS; // 5 minutes

// Persistent mapping between Matter and Dyson map/zone identifiers
export type Dyson360ZoneFingerprints = Record<string, string>;
export interface Dyson360ZoneMappingArea {
    areaId:         number;                                     // Matter AreaId
    fingerprints:   Dyson360ZoneFingerprints;                   // Other distinguishing features
}
interface Dyson360ZoneMappingMap {
    mapId:          number;                                     // Matter MapId
    areas:          Record<string, Dyson360ZoneMappingArea>;    // Indexed by zone id
}
interface Dyson360ZoneMapping {
    maps:           Record<string, Dyson360ZoneMappingMap>;     // Indexed by persistentMapId
    nextAreaId:     number;                                     // Unique AreaId across maps
}
const PERSIST_DELAY_MS = 5 * MS; // 5 seconds before saving updated mapping

// Mixin to add zone cleaning to a Dyson robot vacuum device
export function DysonDevice360ZonesMixin<
    TMap    extends Dyson360MapMetadata,
    TBase   extends AbstractConstructor<DysonDevice360Base>
>(Base: TBase) {
    abstract class DysonDevice360WithZones extends Base {

        // The current attribute values for the Service Area cluster
        supportedMaps:      ServiceArea.Map[]   = [];
        supportedAreas:     ServiceArea.Area[]  = [];

        // Map of current Matter identifiers to latest Dyson maps and zones
        mapFromMatter       = new Map<number, TMap>();
        zoneFromMatter      = new Map<number, [TMap, PersistentMapMetadataZone<TMap>]>();

        // Map of Dyson maps and zones to Matter identifiers (inc. obsolete)
        zoneMapping:        Dyson360ZoneMapping = { maps: {}, nextAreaId: 0 };
        saveZonePromise?:   Promise<void>;

        // When were the maps last updated (in milliseconds since the epoch)
        lastMapFetch        = 0;

        // Cache of zone cleaning status (for use when not cleaning)
        zoneStatusCache?:   Dyson360CleaningStatus;

        // Mixin constructor
        constructor(...args: any[]) {
            super(...args as ConstructorParameters<TBase>);

            // Perform an initial fetch of the persistent maps
            void (async () => {
                try {
                    await this.loadZoneMapping();
                    await this.updateMaps();
                } catch (err) {
                    logError(this.log, 'Retrieving maps', err);
                }
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
        override getEndpointOptions(): EndpointOptions360 {
            const endpointOptions = super.getEndpointOptions();
            endpointOptions.supportsMaps = true;
            return endpointOptions;
        }

        // Handle a received MQTT message
        override async mqttMessageReceived(msg: DysonMqtt360Msg): Promise<void> {
            switch (msg.msg) {
            case 'PERSISTENT-MAP-MANIFEST-UPDATED':
                // Force a map refresh after they have been updated
                await this.updateMaps(true);
                break;
            }
        }

        // Update the Service Area cluster when the zone status changes
        async updateZoneStatus(cleaningStatus?: Dyson360CleaningStatus, currentZone?: Dyson360CurrentZone): Promise<void> {
            const { runMode } = dyson360MapState(this.mqtt.status.state);

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
            if (currentZone && await this.checkMap(currentZone.mapId, currentZone.mapVersion)) {
                currentArea = this.findAreaId(currentZone.mapId, currentZone.zoneId);
            }

            // If zone cleaning then attempt to set the areas and progress
            const progress:         ServiceArea.Progress[] = [];
            const selectedAreas:    number[]               = [];
            if (this.zoneStatusCache?.cleaningMode === Dyson360CleaningMode.Zones) {
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
            await this.updateMaps(true);

            // Map the Matter area identifiers to Dyson map and zone identifiers
            const maps = new Set<TMap>();
            const zones = new Set<string>();
            for (const areaId of areaIds) {
                const zone = this.zoneFromMatter.get(areaId);
                if (!zone) throw new SelectAreaError.UnsupportedArea(`${areaId} is not a supported area`);
                maps.add(zone[0]);
                zones.add(zone[1].id);
            }
            if (maps.size !== 1) throw new SelectAreaError.InvalidSet('Areas must all be from the same map');
            const [map] = maps;
            assertIsDefined(map);

            // Build the cleaning programme
            const cleaningProgramme: Dyson360CleaningProgramme = {
                persistentMapId:                map.id,
                unorderedZones:                 [...zones],
                zonesDefinitionLastUpdatedDate: 'zonesDefinitionLastUpdatedDate' in map
                                                ? map.zonesDefinitionLastUpdatedDate : undefined
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
            const findMap = (): TMap | undefined =>
                [...this.mapFromMatter.values()].find(({ id }) => id === persistentMapId);
            const getMapVersion = (map: TMap): string | undefined => {
                if (!('zonesDefinitionLastUpdatedDate' in map)) return undefined;
                return map.zonesDefinitionLastUpdatedDate ?? ''; // sorts before all dates
            };
            const isFreshEnough = (map: TMap): boolean => {
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
        async updateMaps(updateServiceAreas = false): Promise<boolean> {
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
            if (changed) {
                this.rebuildMatterMaps(metadata);
                if (updateServiceAreas) {
                    await this.endpoint?.updateServiceArea({
                        currentArea:    null,
                        progress:       [],
                        selectedAreas:  [],
                        supportedAreas: this.supportedAreas,
                        supportedMaps:  this.supportedMaps
                    });
                }
            }
            return changed;
        }

        // Retrieve the latest persistent map metadata
        abstract getPersistentMapMetadata(): Promise<TMap[]> | undefined;

        // Check whether there are Matter-relevant changes to a map
        hasMapChanged(a: TMap, b?: TMap): boolean {
            const signature = (map: TMap) => {
                // Sort zones by their ID to ensure consistent comparison
                const { name, id } = map;
                const zones = [...map.zones].sort((a, b) => a.id.localeCompare(b.id));
                return 'zoneProperties' in map ? { id, name, zones, zoneProperties: map.zoneProperties } : { id, name, zones };
            };
            return !b || !isDeepStrictEqual(signature(a), signature(b));
        }

        // Rebuild the Matter mapping for maps and zones
        rebuildMatterMaps(maps: TMap[]): void {
            // Discard any previous mappings
            this.mapFromMatter.clear();
            this.zoneFromMatter.clear();
            this.supportedMaps = [];
            this.supportedAreas = [];

            // Process each map and zone to build new mappings
            for (const map of maps) {
                // Create a Matter map entry
                const mapId = this.makeMapId(map.id);
                const supportedMap: ServiceArea.Map = {
                    mapId,
                    name:   map.name?.substring(0, 64) ?? ''
                };
                this.supportedMaps.push(supportedMap);
                this.mapFromMatter.set(mapId, map);

                // Create a Matter area entry for each zone
                const zoneToArea = this.makeAreaIds(map.id, map.zones);
                for (const zone of map.zones) {
                    const areaId = zoneToArea.get(zone.id);
                    assertIsDefined(areaId);
                    const supportedArea: ServiceArea.Area = {
                        mapId,
                        areaId,
                        areaInfo: {
                            locationInfo: {
                                locationName:   zone.name.substring(0, 128),
                                floorNumber:    null,
                                areaType:       this.getZoneCommonAreaTag(zone)
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
        makeMapId(mapKey: string): number {
            // If the map is already known then use its existing MapId
            const map = this.zoneMapping.maps[mapKey];
            if (map) return map.mapId;

            // Allocate the next MapId for a new map
            const mapId = Object.keys(this.zoneMapping.maps).length;
            this.log.debug(`Allocating new mapId ${mapId} for persistent map ${mapKey}`);
            this.zoneMapping.maps[mapKey] = { mapId, areas: {} };
            this.saveZoneMapping();
            return mapId;
        }

        // Lookup or create Matter area identifiers for all zones in a Dyson map
        makeAreaIds(mapKey: string, zones: PersistentMapMetadataZone<TMap>[]): Map<string, number> {
            // Find the previous mapping for this map
            const map = this.zoneMapping.maps[mapKey];
            assertIsDefined(map);

            // Generate fingerprints for the current zone definitions
            let unmapped = zones.map(zone => ({ newZoneId: zone.id, fingerprints: this.getZoneFingerprints(zone) }));
            const partialFingerprintMatch = (f1: Dyson360ZoneFingerprints, f2: Dyson360ZoneFingerprints): boolean =>
                Object.entries(f1).some(([key, value]) => f2[key] === value);

            // First keep any zone ids that have at least one fingerprint match
            const newAreas: Record<string, Dyson360ZoneMappingArea> = {};
            unmapped = unmapped.filter(({ newZoneId, fingerprints }) => {
                const area = map.areas[newZoneId];
                if (!area || !partialFingerprintMatch(area.fingerprints, fingerprints)) return true;
                newAreas[newZoneId] = { areaId: area.areaId, fingerprints }; // (update fingerprints)
            });

            // Find any zones with new ids that have a unique fingerprint match
            unmapped = unmapped.filter(({ newZoneId, fingerprints }) => {
                const [match, ...rest] = Object.entries(map.areas).filter(([oldZoneId, area]) =>
                    !Object.keys(newAreas).includes(oldZoneId) && partialFingerprintMatch(area.fingerprints, fingerprints));
                if (!match || rest.length) return true; // (no match or multiple matches)
                const [oldZoneId, area] = match;
                newAreas[newZoneId] = { areaId: area.areaId, fingerprints };
                this.log.info(`Dyson zone ${newZoneId} matched to existing Matter area ${area.areaId} (previously zone ${oldZoneId})`);
            });

            // Allocate the next unused AreaIds to any zone still unmatched
            let newNextAreaId = this.zoneMapping.nextAreaId;
            for (const { newZoneId, fingerprints } of unmapped) {
                newAreas[newZoneId] = { areaId: newNextAreaId++, fingerprints };
            }

            // Save and return the updated mapping
            const newAreaIdCount = newNextAreaId - this.zoneMapping.nextAreaId;
            if (!isDeepStrictEqual(newAreas, map.areas) || newAreaIdCount) {
                this.log.info(newAreaIdCount ? `${plural(newAreaIdCount, 'new area identifier')} allocated` : 'Area fingerprints updated');
                map.areas = newAreas;
                this.zoneMapping.nextAreaId = newNextAreaId;
                this.saveZoneMapping();
            }
            return new Map(Object.entries(newAreas).map(([zoneId, area]) => [zoneId, area.areaId]));
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

        // Construct a storage key for the map and zone identifier mapping
        get zonePersistKey(): string {
            return `zone-map-v1:${this.serialNumber}`;
        }

        // Restore any previous map and zone identifier mapping
        async loadZoneMapping(): Promise<void> {
            try {
                const mapping = await this.persist.getItem(this.zonePersistKey) as Dyson360ZoneMapping | undefined;
                if (mapping) this.zoneMapping = mapping;
                else this.log.info('No saved mapping between Dyson zones and Matter areas');
            } catch (err) {
                logError(this.log, 'Restoring zone mapping', err);
            }
        }

        // Save a (possibly) updated map and zone identifier mapping
        saveZoneMapping(): void {
            const delayedSet = async (): Promise<void> => {
                try {
                    // Delay to allow multiple updates to coalesce
                    await setTimeout(PERSIST_DELAY_MS);
                    this.saveZonePromise = undefined;

                    // Save the current map and zone identifier mapping
                    await this.persist.setItem(this.zonePersistKey, this.zoneMapping);
                    this.log.info('Saved updated mapping between Dyson zones and Matter areas');
                } catch (err) {
                    logError(this.log, 'Saving zone mapping', err);
                }
            };
            this.saveZonePromise ??= delayedSet();
        }

        // Generate fingerprints for a Dyson zone
        getZoneFingerprints(zone: PersistentMapMetadataZone<TMap>): Dyson360ZoneFingerprints {
            return {
                name:   zone.name,
                area:   zone.area.toString()
            };
        }

        // Map a Dyson zone to a Matter common area tag
        abstract getZoneCommonAreaTag(zone: PersistentMapMetadataZone<TMap>): Dyson360CommonAreaTag;
    }
    return DysonDevice360WithZones;
}