// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    Dyson360CleaningProgramme,
    Dyson360ZoneCleanStatus,
    Dyson360ZoneIcon
} from './dyson-360-types.js';
import { AreaNamespaceTag } from 'matterbridge/matter';
import { DysonDevice360Base } from './dyson-device-360-base.js';
import { AbstractConstructor, assertIsDefined } from './utils.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { DysonMqttStatus360 } from './dyson-mqtt-360.js';
import {
    Dyson360PersistentMapMetadata,
    Dyson360PersistentMapMetadataZone
} from './dyson-360-cloud-types.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { SelectAreaError } from './error-360.js';
import { Endpoint360, formatAreaName } from './endpoint-360.js';
import { Device360CommandHandlers } from './dyson-device-360-commands.js';
import { logError } from './log-error.js';

// Mapping of Dyson area icons/names to Matter common areas
type LocationType = number | null;
type LocationTypeMapping = LocationType | [RegExp, LocationType][];
const LOCATION_TYPE_MAP: Record<Dyson360ZoneIcon, LocationTypeMapping> = {
    [Dyson360ZoneIcon.Balcony]:     AreaNamespaceTag.Balcony.tag,
    [Dyson360ZoneIcon.Bathroom]:    AreaNamespaceTag.Bathroom.tag,
    [Dyson360ZoneIcon.Bedroom]: [
        [/^Guest room$/i,           AreaNamespaceTag.GuestBedroom.tag],
        [/^/,                       AreaNamespaceTag.Bedroom.tag]
    ],
    [Dyson360ZoneIcon.DiningRoom]:  AreaNamespaceTag.Dining.tag,
    [Dyson360ZoneIcon.Hallway]:     AreaNamespaceTag.Hallway.tag,
    [Dyson360ZoneIcon.Kitchen]:     AreaNamespaceTag.Kitchen.tag,
    [Dyson360ZoneIcon.LivingRoom]:  AreaNamespaceTag.LivingRoom.tag,
    [Dyson360ZoneIcon.MainBedroom]: AreaNamespaceTag.PrimaryBedroom.tag,
    [Dyson360ZoneIcon.Study]:       AreaNamespaceTag.Study.tag,
    [Dyson360ZoneIcon.Toilet]:      AreaNamespaceTag.Toilet.tag,
    [Dyson360ZoneIcon.UtilityRoom]: AreaNamespaceTag.UtilityRoom.tag,
    [Dyson360ZoneIcon.Work]:        AreaNamespaceTag.Office.tag,
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

// Mixin to add zone cleaning to a Dyson robot vacuum device
export function DysonDevice360ZonesMixin<TBase extends AbstractConstructor<DysonDevice360Base>>(Base: TBase) {
    abstract class DysonDevice360WithZones extends Base {

        // The current attribute values for the Service Area cluster
        supportedMaps:  ServiceArea.Map[]   = [];
        supportedAreas: ServiceArea.Area[]  = [];

        // Map of current Matter identifiers to latest Dyson maps and zones
        mapFromMatter   = new Map<number, Dyson360PersistentMapMetadata>();
        zoneFromMatter  = new Map<number, [Dyson360PersistentMapMetadata, Dyson360PersistentMapMetadataZone]>();

        // Map of Dyson maps and zones to Matter identifiers (inc. obsolete)
        mapToMatter     = new Map<string, number>();
        zoneToMatter    = new Map<string, number>();

        // The next map and area identifiers to allocate
        nextMapId = 1;
        nextAreaId = 1;

        // Mixin constructor
        constructor(...args: any[]) {
            super(...args as ConstructorParameters<TBase>);

            // Perform an initial fetch of the persistent maps
            void (async () => {
                try { await this.updateMaps(); } catch (err) { logError(this.log, 'Retrieving maps', err); }
            })();
        }

        // Attach command handlers to the endpoint
        override attachCommandHandlers(endpoint: Endpoint360): Device360CommandHandlers {
            const handlers = super.attachCommandHandlers(endpoint);
            handlers.attachSelectAreasHandler(
                this.makeCleaningProgramme.bind(this),
                (areaId: number) => formatAreaName(this.supportedMaps, this.supportedAreas, areaId)
            );
            return handlers;
        }

        // Indicates whether the device supports Service Area map features
        override supportsMaps = () => true;

        // Update cluster attributes when the MQTT status is updated
        override async updateClusterAttributes(
            status: DysonMqttStatus<DysonMqttStatus360>
        ): Promise<void> {
            await super.updateClusterAttributes(status);

            // If a map is being used then ensure the latest maps are loaded
            let currentArea:        number | null           = null;
            let progress:           ServiceArea.Progress[]  = [];
            const selectedAreas:    number[]                = [];
            const { persistentMapId, zonesDefinitionVersion } = status;
            if (persistentMapId && await this.checkMap(persistentMapId, zonesDefinitionVersion)) {
                const { zoneId, zoneStatus, cleaningProgramme } = status;

                // If the current zone is known then map it to a Matter area
                if (zoneId) currentArea = this.findAreaId(persistentMapId, zoneId);

                // Index the zone status by Matter area identifier
                const progressMap = new Map<number, ServiceArea.OperationalStatus>();
                for (const { zoneId, cleanStatus } of zoneStatus ?? []) {
                    const areaId = this.findAreaId(persistentMapId, zoneId);
                    if (areaId) progressMap.set(areaId, PROGRESS_MAP[cleanStatus]);
                }

                // If zone cleaning then map selected areas to Matter areas
                const cleaningZones = new Set([
                    ...(cleaningProgramme?.orderedZones   ?? []),
                    ...(cleaningProgramme?.unorderedZones ?? [])
                ]);
                for (const zoneId of cleaningZones) {
                    const areaId = this.findAreaId(persistentMapId, zoneId);
                    if (areaId) {
                        selectedAreas.push(areaId);
                        const status = progressMap.get(areaId) ?? ServiceArea.OperationalStatus.Pending;
                        progress.push({ areaId, status });
                    }
                }

                // If not zone cleaning provide any progress status reported
                if (selectedAreas.length === 0) {
                    progress = Array.from(progressMap.entries(), ([areaId, status]) => ({ areaId, status }));
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
        async makeCleaningProgramme(areaIds: number[]): Promise<Dyson360CleaningProgramme> {
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
            const maps = new Set<Dyson360PersistentMapMetadata>();
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
            const {id, zonesDefinitionLastUpdatedDate } = map;

            // Build the cleaning programme
            return {
                orderedZones:       [],
                persistentMapId:    id,
                unorderedZones,
                zonesDefinitionLastUpdatedDate
            };
        }

        // Check whether the persistent maps have changed and update if necessary
        async checkMap(persistentMapId: string, rvcVersion?: string): Promise<boolean> {
            const getMyVersion = (): string | undefined => {
                const map = [...this.mapFromMatter.values()].find(({ id }) => id === persistentMapId);
                const myVersion = map?.zonesDefinitionLastUpdatedDate;
                return myVersion === null ? '' /* sorts before all dates */ : myVersion;
            };

            // First check whether the matching map and version is already known
            let myVersion = getMyVersion();
            if (myVersion && (!rvcVersion || rvcVersion <= myVersion)) {
                if (rvcVersion && rvcVersion < myVersion) {
                    this.log.info(`RVC map ${persistentMapId} is out of date (${rvcVersion} < ${myVersion})`);
                }
                return true;
            }

            // Retrieve the latest maps and then check again
            await this.updateMaps();
            myVersion = getMyVersion();
            if (myVersion) {
                // Tolerate but warn of version mismatches
                if (rvcVersion && rvcVersion < myVersion) {
                    this.log.info(`RVC map ${persistentMapId} is out of date (${rvcVersion} < ${myVersion})`);
                } else if (rvcVersion && myVersion < rvcVersion) {
                    this.log.warn(`RVC map ${persistentMapId} is more recent than cloud (${rvcVersion} > ${myVersion})`);
                }
                return true;
            }
            if (this.api) this.log.warn(`RVC map ${persistentMapId} does not exist`);
            return false;
        }

        // Retrieve the latest persistent maps
        async updateMaps(): Promise<boolean> {
            // Retrieve the latest persistent map metadata
            if (!this.api) return false;
            const metadata = await this.api.getPersistentMapMetadata360();

            // Check for any changes
            let changed = false;
            const oldMetadata = [...this.mapFromMatter.values()];
            for (const { id, zonesDefinitionLastUpdatedDate } of metadata) {
                const prevUpdateDate = oldMetadata.find(map => map.id === id)?.zonesDefinitionLastUpdatedDate;
                if (prevUpdateDate === zonesDefinitionLastUpdatedDate) continue;
                changed = true;
                this.log.info(`Map ${id} ${prevUpdateDate ? 'updated' : 'added'}`);
            }
            for (const { id } of oldMetadata) {
                if (metadata.some(map => map.id === id)) continue;
                changed = true;
                this.log.info(`Map ${id} deleted`);
            }

            if (changed) this.rebuildMatterMaps(metadata);
            return changed;
        }

        // Rebuild the Matter mapping for maps and zones
        rebuildMatterMaps(maps: Dyson360PersistentMapMetadata[]): void {
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
        makeMapId(map: Dyson360PersistentMapMetadata): number {
            const mapKey = map.id;
            const mapId = this.mapToMatter.get(mapKey) ?? this.nextMapId++;
            this.mapToMatter.set(mapKey, mapId);
            return mapId;
        }

        // Lookup or create a Matter area identifier for a Dyson zone
        makeAreaId(map: Dyson360PersistentMapMetadata, zone: Dyson360PersistentMapMetadataZone): number {
            let zoneKey = `${map.id}|${zone.name}`;
            // Custom zones might not be unique, so distinguish by area too
            if (zone.icon === Dyson360ZoneIcon.Custom) zoneKey += `|${zone.area}`;
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
        makeLocationAreaType(zone: Dyson360PersistentMapMetadataZone): LocationType {
            const mapping = LOCATION_TYPE_MAP[zone.icon];
            if (!Array.isArray(mapping)) return mapping;
            const match = mapping.find(([re]) => re.test(zone.name));
            return match ? match[1] : null;
        }
    }
    return DysonDevice360WithZones;
}