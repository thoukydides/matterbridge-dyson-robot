// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360VacuumMode,
    Dyson360CleanType,
    Dyson360VacuumPasses,
    Dyson360DustName,
    Dyson360EyeEventPowerMode,
    Dyson360WaterLevel,
    Dyson360Rotation,
    Dyson360TimelineEvent,
    Dyson360MopPasses,
    Dyson360ZoneIcon,
    Dyson360ZoneStatus,
    Dyson360ZoneType,
    Dyson360FurnitureType,
    Dyson360RestrictionBehaviour,
    Dyson360ZoneCleanStatus,
    Dyson360FaultNextAction,
    Dyson360PresentationType
} from './dyson-360-types.js';
import {
    DysonFaultDescription,
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponseV1
} from './dyson-cloud-types.js';

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export interface Dyson360UnifiedschedulerEvent extends DysonUnifiedschedulerEvent {
    settings: {
        cleaningProgramme:              Dyson360CleaningProgramme   | null;
        cleaningStrategy:               Dyson360VacuumMode          | null;
        currentCleaningMode?:           Dyson360CleaningMode;
        powerMode:                      Dyson360EyeEventPowerMode   | null;
    }
}
export interface Dyson360UnifiedschedulerEventsResponseV1 extends DysonUnifiedschedulerEventsResponseV1{
    events:                             Dyson360UnifiedschedulerEvent[];
}

// GET /v1/assets/devices/{serial}/cleanhistory?culture={languagecode} (360 Eye only)
export interface Dyson360CleanHistoryEntry {
    Area:                               number;             // m²
    Charges:                            number;
    Clean:                              string;             // UUID
    Finished:                           string;             // e.g. '2025-12-18T09:06:18'
    FinishedIso8601:                    string;             // e.g. '2025-12-18T09:06:18Z'
    IsInterim:                          boolean;
    Started:                            string;             // e.g. '2025-12-18T09:00:27'
    StartedIso8601:                     string;             // e.g. '2025-12-18T09:00:27Z'
    Type:                               string;             // e.g. 'Scheduled'
}
export interface Dyson360CleanHistoryResponseV1 {
    Entries:                            Dyson360CleanHistoryEntry[];
    TriviaArea:                         number;             // e.g. 0
    TriviaMessage:                      string;             // e.g. ''
}

// GET /v1/app/{serial}/persistent-map-metadata (360 Vis Nav only)
export interface Dyson360PersistentMapMetadataZoneBase {
    area:                               number;             // m²
    id:                                 string;             // e.g. '1'
    name:                               string;             // e.g. 'Kitchen'
}
export interface Dyson360PersistentMapMetadataZoneV1 extends Dyson360PersistentMapMetadataZoneBase {
    icon:                               Dyson360ZoneIcon;
}
export interface Dyson360PersistentMapMetadataZoneProperties {
    zones:                              string[];           // e.g. ['1']
    zoneBehaviours: {
        vacuumPowerMode:                null;
        cleaningStrategy:               Dyson360VacuumMode;
    }
}
export interface Dyson360PersistentMapMetadataV1 {
    id:                                 string;             // UUID
    name:                               string | null;      // e.g. 'Downstairs'
    lastVisited:                        string;             // e.g. '2025-12-17T13:36:17.768Z'
    zones:                              Dyson360PersistentMapMetadataZoneV1[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[];
    zonesDefinitionLastUpdatedDate:     string | null;      // e.g. '2025-12-17T11:30:52.6166355Z'
}
export type Dyson360PersistentMapMetadataResponseV1 = Dyson360PersistentMapMetadataV1[];

// GET /v2/app/{serial}/persistent-map-metadata (Spot+Scrub Ai only)
export interface Dyson360ZoneSettingsV2 {
    cleanType:                          Dyson360CleanType;
    cleaningStrategy:                   Dyson360VacuumMode;
    dryPasses:                          Dyson360VacuumPasses;
    isUvScanOn?:                        boolean;            // UV sterilisation pass
    mopPasses:                          Dyson360MopPasses;
    waterLevel:                         Dyson360WaterLevel;
}
export interface Dyson360PersistentMapMetadataZoneV2 extends Dyson360PersistentMapMetadataZoneBase {
    isSelected:                         boolean;
    nameLocation:                       Dyson360PersistentMapLocation;
    order:                              number;             // Cleaning sequence (1 is first)
    settings:                           Dyson360ZoneSettingsV2;
    type:                               Dyson360ZoneType | '';
}
export interface Dyson360PersistentMapMetadataV2 {
    id:                                 string;             // e.g. '1788021937'
    name:                               string | null;      // e.g. 'Downstairs'
    imageUrl?:                          string;             // e.g. ''
    isCurrentMap:                       boolean;
    zones:                              Dyson360PersistentMapMetadataZoneV2[];
}
export type Dyson360PersistentMapMetadataResponseV2 = Dyson360PersistentMapMetadataV2[];

// PUT /v2/app/{serial}/persistent-map-metadata/{mapId} (Spot+Scrub Ai only)
export type Dyson360UpdateMapZoneSelectionRequestV2 = Dyson360PersistentMapMetadataZoneV2[];

// GET /v1/app/{serial}/persistent-maps/{mapId} (360 Vis Nav only)
export interface Dyson360PersistentMapLocation {
    x:                                  number;             // mm
    y:                                  number;             // mm
}
export interface Dyson360PersistentMapLocationRotated extends Dyson360PersistentMapLocation {
    angle:                              number;             // °
}
export interface Dyson360PersistentMapBitmap {
    resolution:                         number;             // mm/pixel
    data:                               string;             // base64 encoded PNG image
}
export interface Dyson360PersistentMapThreshold {
    startX:                             number;             // mm
    startY:                             number;             // mm
    endX:                               number;             // mm
    endY:                               number;             // mm
    leftZone:                           string;             // e.g. '1'
    rightZone:                          string;             // e.g. '2'
}
export interface Dyson360PersistentMapZonesDefinitionV1 {
    lastUpdatedDate:                    string;             // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapDisplayOrientation:    Dyson360Rotation;
    persistentMapId:                    string;             // UUID
    persistentMapName:                  string;             // e.g. 'Downstairs'
    persistentMapOffset:                Dyson360PersistentMapLocationRotated;
    persistentMapVersion:               number;             // e.g. 1
    thresholds:                         Dyson360PersistentMapThreshold[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[],
    zones:                              Dyson360PersistentMapMetadataZoneV1[],
    zonesMap:                           Dyson360PersistentMapBitmap;
}
export interface Dyson360PersistentMapRestrictionProperties {
    keepOut:                            true | null;
    brushBarOff:                        true | null;
    vacuumPowerMode:                    null;
    noClimb:                            true | null;
    lowObjectSensitivity:               null;
}
export interface Dyson360PersistentMapRestrictionV1 {
    icon:                               null;
    id:                                 number;
    name:                               string;             // e.g. 'Avoid cables'
    priority:                           number;
    properties:                         Dyson360PersistentMapRestrictionProperties;
    vertices:                           Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapRestrictionsDefinitionV1 {
    lastUpdatedDate:                    string;             // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapId:                    string;             // UUID
    persistentMapOffset:                Dyson360PersistentMapLocationRotated;
    persistentMapVersion:               number;             // e.g. 3
    restrictions:                       Dyson360PersistentMapRestrictionV1[];
}
export interface Dyson360PersistentMapResponseV1 {
    id:                                 string;             // UUID
    dockLocations:                      Dyson360PersistentMapLocationRotated[],
    highSensitivityAdditionalObjects:   Dyson360PersistentMapBitmap;
    lastVisited:                        string;             // e.g. '2025-12-17T13:36:17.768Z',
    lowSensitivityObjects:              Dyson360PersistentMapBitmap;
    maturity:                           Dyson360PersistentMapBitmap;
    occupancyProbability:               Dyson360PersistentMapBitmap;
    offset:                             Dyson360PersistentMapLocationRotated;
    presentationMap:                    Dyson360PersistentMapBitmap;
    restrictionsDefinition:             Dyson360PersistentMapRestrictionsDefinitionV1 | null;
    version:                            number;             // e.g. 2
    visitedFootprint:                   Dyson360PersistentMapBitmap;
    zonesDefinition:                    Dyson360PersistentMapZonesDefinitionV1;
}

// GET /v2/app/{serial}/persistent-maps/{mapId} (Spot+Scrub Ai only)
export interface Dyson360PersistentMapDimensions {
    height:                             number;
    offsetX:                            number;
    offsetY:                            number;
    resolution:                         number;             // m
    width:                              number;
}
export interface Dyson360PersistentMapFurniture {
    id:                                 string;             // e.g. '1789145395'
    points:                             Dyson360PersistentMapLocation[];
    type:                               Dyson360FurnitureType;
    userDefined:                        boolean;
}
export interface Dyson360PersistentMapZonePresentation {
    start:                              Dyson360PersistentMapLocation;
    end:                                Dyson360PersistentMapLocation;
    type:                               Dyson360PresentationType;
}
export interface Dyson360PersistentMapZoneV2 extends Dyson360PersistentMapMetadataZoneBase {
    cleanStatus:                        Dyson360ZoneCleanStatus;
    nameLocation:                       Dyson360PersistentMapLocation;
    presentation:                       Dyson360PersistentMapZonePresentation[]
    type?:                              Dyson360ZoneType;
    visited:                            Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapRestrictionV2 {
    behavior:                           Dyson360RestrictionBehaviour;
    id:                                 string;             // e.g. '0'
    points:                             Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapResponseV2 {
    id:                                 string;             // e.g. '1788021937'
    dimensions:                         Dyson360PersistentMapDimensions;
    dockLocation:                       Dyson360PersistentMapLocationRotated;
    furniture:                          Dyson360PersistentMapFurniture[];
    groutLines:                         [];
    hazardZones:                        [];
    orientation:                        number;
    restrictions:                       Dyson360PersistentMapRestrictionV2[];
    swingDoors:                         [];
    zones:                              Dyson360PersistentMapZoneV2[];
}

// POST /v2/app/{serial}/persistent-maps/{mapId}/clean-estimation (Spot+Scrub Ai only)
export interface Dyson360CleanEstimationZoneV2 {
    area:                               number;             // m²
    id:                                 string;             // e.g. '1'
    settings:                           Dyson360ZoneSettingsV2;
}
export interface Dyson360CleanEstimationRequestV2 {
    zones:                              Dyson360CleanEstimationZoneV2[];
}
export interface Dyson360CleanEstimationResponseV2 {
    charges:                            number;             // Recharging stops
    duration:                           number;             // minutes
}

// GET /v1/app/{serial}/live-maps/cleaning (Spot+Scrub Ai only)
export interface Dyson360LiveMapPathPoint extends Dyson360PersistentMapLocation {
    update:                             0 | 1;
};
export interface Dyson360LiveMapRobotLocation extends Dyson360PersistentMapLocationRotated {
    update:                             0 | 1;
    id:                                 string;             // e.g. '1044'
}
export interface Dyson360LiveMapCleaningResponseV1 {
    cleanPath:                          Dyson360LiveMapPathPoint[];
    dirt:                               [];
    dockLocation:                       Dyson360PersistentMapLocationRotated;
    furniture:                          Dyson360PersistentMapFurniture[];
    groutLines:                         [];
    hazardZones:                        [];
    id:                                 string;             // e.g. '1788021937'
    obstacles:                          Dyson360PersistentMapLocation[];
    orientation:                        number;
    restrictions:                       Dyson360PersistentMapRestrictionV2[];
    robotLocation:                      Dyson360LiveMapRobotLocation;
    spotZones:                          [];
    swingDoors:                         [];
    taskBeginTime:                      number;             // seconds since epoch
    zones:                              Dyson360PersistentMapZoneV2[];
}

// GET /v1/app/{serial}/live-maps/mapping (Spot+Scrub Ai only)
export interface Dyson360LiveMapMappingResponseV1 {
    dimensions:                         Dyson360PersistentMapDimensions;
    dockLocation:                       Dyson360PersistentMapLocationRotated;
    mapData:                            number[];
    orientation:                        number;
    robotLocation:                      Dyson360LiveMapRobotLocation;
    taskBeginTime:                      number;             // milliseconds since epoch
}

// GET /v1/{serial}/clean-maps?dustMap=total (360 Vis Nav only)
export interface Dyson360CleanMapLocation {
    x:                                  number;             // mm
    y:                                  number;             // mm
}
export interface Dyson360CleanMapLocationUnrotated extends Dyson360CleanMapLocation{
    angle:                              0;                  // °
}
export interface Dyson360CleanTimelineEntry {
    eventName:                          Dyson360TimelineEvent;
    time:                               string;             // e.g. '2025-12-23T09:00:25Z'
    zone:                               string | null;      // e.g. '1'
    targetZone:                         string | null;      // e.g. '1'
    persistentMapId:                    string | null;      // UUID
    reason:                             null;
    faultCode:                          string | null;      // e.g. '23.1.-1'
    faultType:                          string | null;      // e.g. 'BRUSH_BAR_AND_TRACTION'
    faultLocation:                      Dyson360CleanMapLocation | null;
}
export interface DysonCleanMapDustData {
    name:                               Dyson360DustName;   // (only 'total')
    scaleFactor:                        number;             // 100% in data scale
    data:                               string;             // base64 encoded, zlib deflate compressed, width×height octets
}
export interface DysonCleanMapDustMap {
    width:                              number;             // pixels
    height:                             number;             // pixels
    resolution:                         number;             // mm/pixel
    dustData:                           DysonCleanMapDustData[];
}
export interface DysonCleanMapPersistentMap {
    id:                                 string;             // UUID
    cleanMapPosition:                   Dyson360CleanMapLocationUnrotated;
};
export interface Dyson360CleanMap {
    cleanedFootprint:                   Dyson360PersistentMapBitmap;
    cleanId:                            string;             // UUID
    cleanTimeline:                      Dyson360CleanTimelineEntry[];
    dustMap:                            DysonCleanMapDustMap;
    highSensitivityAdditionalObjects:   Dyson360PersistentMapBitmap;
    lowSensitivityObjects:              Dyson360PersistentMapBitmap;
    occupancyProbability:               Dyson360PersistentMapBitmap;
    persistentMap:                      DysonCleanMapPersistentMap | null;
    robotPath:                          [];
    sequenceNumber:                     number;
    zones:                              Dyson360PersistentMapBitmap | null;
    zoneStatus:                         Dyson360ZoneStatus[] | null;
}
export type Dyson360CleanMapsResponseV1 = Dyson360CleanMap[];

// GET /v1/app/{serial}/recommended-cleans (360 Vis Nav only)
export interface Dyson360ZonePredictionDustMilligrams {
    name:                               Dyson360DustName;
    weight:                             number;
}
export interface Dyson360ZonePrediction {
    zoneId:                             string;             // e.g. '1'
    zoneDustMilligrams:                 Dyson360ZonePredictionDustMilligrams[];
}
export interface Dyson360RecommendedClean {
    persistentMapId:                    string;             // UUID
    zonePredictions:                    Dyson360ZonePrediction[];
}
export type Dyson360RecommendedCleansResponseV1 = Dyson360RecommendedClean[];

// PUT /v1/app/{serial}/{mapId}/zones/{zoneid}/zone-behaviours (360 Vis Nav only)
export interface Dyson360ZoneBehavioursRequestV1 {
    cleaningStrategy:                   Dyson360VacuumMode;
}

// GET /v1/support/product-faults/{serial}?locale={languagecode}&market={countrycode}&faultCode=<code> (Spot+Scrub Ai only)
export interface Dyson360FaultDescription extends DysonFaultDescription {
    nextActionRequired?:                Dyson360FaultNextAction;
}
export type Dyson360FaultResponseV1 = Dyson360FaultDescription[];