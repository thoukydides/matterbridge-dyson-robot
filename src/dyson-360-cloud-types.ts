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
    Dyson360FaultSeverity
} from './dyson-360-types.js';
import {
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponse
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
export interface Dyson360UnifiedschedulerEventsResponse extends DysonUnifiedschedulerEventsResponse{
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
export interface Dyson360CleanHistoryResponse {
    Entries:                            Dyson360CleanHistoryEntry[];
    TriviaArea:                         number;             // e.g. 0
    TriviaMessage:                      string;             // e.g. ''
}

// GET /v1/app/{serial}/persistent-map-metadata (360 Vis Nav and Spot+Scrub Ai only)
export interface Dyson360PersistentMapMetadataZoneBase {
    area:                               number;             // m²
    id:                                 string;             // e.g. '1'
    name:                               string;             // e.g. 'Kitchen'
}
export interface Dyson360PersistentMapMetadataZoneVisNav extends Dyson360PersistentMapMetadataZoneBase {
    icon:                               Dyson360ZoneIcon;
}
export interface Dyson360ZoneSettingsSpotScrub {
    cleanType:                          Dyson360CleanType;
    cleaningStrategy:                   Dyson360VacuumMode;
    dryPasses:                          Dyson360VacuumPasses;
    isUvScanOn:                         boolean;            // UV sterilisation pass
    mopPasses:                          Dyson360MopPasses;
    waterLevel:                         Dyson360WaterLevel;
}
export interface Dyson360PersistentMapMetadataZoneSpotScrub extends Dyson360PersistentMapMetadataZoneBase {
    isSelected:                         boolean;
    nameLocation:                       Dyson360PersistentMapLocation;
    order:                              number;             // Cleaning sequence (1 is first)
    settings:                           Dyson360ZoneSettingsSpotScrub;
    type:                               Dyson360ZoneType
}
export interface Dyson360PersistentMapMetadataZoneProperties {
    zones:                              string[];           // e.g. ['1']
    zoneBehaviours: {
        vacuumPowerMode:                null;
        cleaningStrategy:               Dyson360VacuumMode;
    }
}
export interface Dyson360PersistentMapMetadataBase {
    id:                                 string;             // UUID or e.g. '1788021937'
    name:                               string | null;      // e.g. 'Downstairs'
}
export interface Dyson360PersistentMapMetadataVisNav extends Dyson360PersistentMapMetadataBase {
    lastVisited:                        string;             // e.g. '2025-12-17T13:36:17.768Z'
    zones:                              Dyson360PersistentMapMetadataZoneVisNav[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[];
    zonesDefinitionLastUpdatedDate:     string | null;      // e.g. '2025-12-17T11:30:52.6166355Z'
}
export interface Dyson360PersistentMapMetadataSpotScrub extends Dyson360PersistentMapMetadataBase {
    imageUrl:                           string;
    isCurrentMap:                       boolean;
    name:                               string | null;
    zones:                              Dyson360PersistentMapMetadataZoneSpotScrub[];
}
export type Dyson360PersistentMapMetadata =
    Dyson360PersistentMapMetadataVisNav | Dyson360PersistentMapMetadataSpotScrub;
export type Dyson360PersistentMapMetadataResponseVisNav = Dyson360PersistentMapMetadataVisNav[];
export type Dyson360PersistentMapMetadataResponseSpotScrub = Dyson360PersistentMapMetadataSpotScrub[];

// GET /v1/app/{serial}/persistent-maps/{uuid} (360 Vis Nav and Spot+Scrub Ai only)
export interface Dyson360PersistentMapLocation {
    x:                                  number;             // mm
    y:                                  number;             // mm
}
export interface Dyson360PersistentMapLocationRotated extends Dyson360PersistentMapLocation {
    angle:                              number;             // °
}
export interface Dyson360PersistentMapLocationIdentity {
    x:                                  0;                  // mm
    y:                                  0;                  // mm
    angle:                              0;                  // °
}
export interface Dyson360PersistentMapBitmap {
    resolution:                         number;             // mm/pixel
    data:                               string;             // base64 encoded PNG image
}
export interface Dyson360PersistentMapDimensions {
    height:                             number;
    offsetX:                            number;
    offsetY:                            number;
    resolution:                         number;
    width:                              number;
}
export interface Dyson360PersistentMapThreshold {
    startX:                             number;             // mm
    startY:                             number;             // mm
    endX:                               number;             // mm
    endY:                               number;             // mm
    leftZone:                           string;             // e.g. '1'
    rightZone:                          string;             // e.g. '2'
}
export interface Dyson360PersistentMapZonesDefinitionVisNav {
    lastUpdatedDate:                    string;             // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapDisplayOrientation:    Dyson360Rotation;
    persistentMapId:                    string;             // UUID
    persistentMapName:                  string;             // e.g. 'Downstairs'
    persistentMapOffset:                Dyson360PersistentMapLocationIdentity;
    persistentMapVersion:               number;             // e.g. 1
    thresholds:                         Dyson360PersistentMapThreshold[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[],
    zones:                              Dyson360PersistentMapMetadataZoneVisNav[],
    zonesMap:                           Dyson360PersistentMapBitmap;
}
export interface Dyson360PersistentMapRestrictionProperties {
    keepOut:                            true | null;
    brushBarOff:                        true | null;
    vacuumPowerMode:                    null;
    noClimb:                            true | null;
    lowObjectSensitivity:               null;
}
export interface Dyson360PersistentMapRestrictionVisNav {
    icon:                               null;
    id:                                 number;
    name:                               string;             // e.g. 'Avoid cables'
    priority:                           number;
    properties:                         Dyson360PersistentMapRestrictionProperties;
    vertices:                           Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapRestrictionSpotScrub {
    behavior:                           Dyson360RestrictionBehaviour;
    id:                                 string;             // e.g. '0'
    points:                             Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapRestrictionsDefinitionVisNav {
    lastUpdatedDate:                    string;             // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapId:                    string;             // UUID
    persistentMapOffset:                Dyson360PersistentMapLocationIdentity;
    persistentMapVersion:               number;             // e.g. 3
    restrictions:                       Dyson360PersistentMapRestrictionVisNav[];
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
    type:                               0 | 1 | 2;
}
export interface Dyson360PersistentMapZoneSpotScrub extends Dyson360PersistentMapMetadataZoneBase {
    cleanStatus:                        Dyson360ZoneCleanStatus;
    nameLocation:                       Dyson360PersistentMapLocation;
    presentation:                       Dyson360PersistentMapZonePresentation[]
    type:                               Dyson360ZoneType;
    visited:                            Dyson360PersistentMapLocation[];
}
export interface Dyson360PersistentMapResponseBase {
    id:                                 string;             // UUID or e.g. '1788021937'
}
export interface Dyson360PersistentMapResponseVisNav extends Dyson360PersistentMapResponseBase {
    dockLocations:                      Dyson360PersistentMapLocationRotated[],
    highSensitivityAdditionalObjects:   Dyson360PersistentMapBitmap;
    lastVisited:                        string;             // e.g. '2025-12-17T13:36:17.768Z',
    lowSensitivityObjects:              Dyson360PersistentMapBitmap;
    maturity:                           Dyson360PersistentMapBitmap;
    occupancyProbability:               Dyson360PersistentMapBitmap;
    offset:                             Dyson360PersistentMapLocationRotated;
    presentationMap:                    Dyson360PersistentMapBitmap;
    restrictionsDefinition:             Dyson360PersistentMapRestrictionsDefinitionVisNav | null;
    version:                            number;             // e.g. 2
    visitedFootprint:                   Dyson360PersistentMapBitmap;
    zonesDefinition:                    Dyson360PersistentMapZonesDefinitionVisNav;
}
export interface Dyson360PersistentMapResponseSpotScrub extends Dyson360PersistentMapResponseBase {
    dimensions:                         Dyson360PersistentMapDimensions;
    dockLocation:                       Dyson360PersistentMapLocationRotated;
    furniture:                          Dyson360PersistentMapFurniture[];
    groutLines:                         [];
    hazardZones:                        [];
    orientation:                        number;
    restrictions:                       Dyson360PersistentMapRestrictionSpotScrub[];
    swingDoors:                         [];
    zones:                              Dyson360PersistentMapZoneSpotScrub[];
}
export type Dyson360PersistentMapResponse =
    Dyson360PersistentMapResponseVisNav | Dyson360PersistentMapResponseSpotScrub;

// POST /v2/app/{serial}/persistent-maps/{uuid}/clean-estimation (Spot+Scrub Ai only)
export interface Dyson360CleanEstimationZone {
    area:                               number;             // m²
    id:                                 string;             // e.g. '1'
    settings:                           Dyson360ZoneSettingsSpotScrub;
}
export interface Dyson360CleanEstimationRequest {
    zones:                              Dyson360CleanEstimationZone[];
}
export interface Dyson360CleanEstimationResponse {
    charges:                            number;
    duration:                           number;
}

// GET /v1/app/{serial}/live-maps/cleaning (Spot+Scrub Ai only)
export interface Dyson360LiveMapPathPoint extends Dyson360PersistentMapLocation {
    update:                             0 | 1;
};
export interface Dyson360LiveMapRobotLocation extends Dyson360PersistentMapLocationRotated {
    update:                             0 | 1;
    id:                                 string;             // e.g. '1044'
}
export interface Dyson360LiveMapCleaningResponse {
    cleanPath:                          Dyson360LiveMapPathPoint[];
    dirt:                               [];
    dockLocation:                       Dyson360PersistentMapLocationRotated;
    furniture:                          Dyson360PersistentMapFurniture[];
    groutLines:                         [];
    hazardZones:                        [];
    id:                                 string;             // e.g. '1788021937'
    obstacles:                          Dyson360PersistentMapLocation[];
    orientation:                        number;
    restrictions:                       Dyson360PersistentMapRestrictionSpotScrub[];
    robotLocation:                      Dyson360LiveMapRobotLocation;
    spotZones:                          [];
    swingDoors:                         [];
    taskBeginTime:                      number;             // Seconds since epoch
    zones:                              Dyson360PersistentMapZoneSpotScrub[];
}

// GET /v1/app/{serial}/live-maps/mapping (Spot+Scrub Ai only)

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
export type Dyson360CleanMapsResponse = Dyson360CleanMap[];

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
export type Dyson360RecommendedCleansResponse = Dyson360RecommendedClean[];

// PUT /v1/app/{serial}/{uuid}/zones/{zoneid}/zone-behaviours (360 Vis Nav only)
export interface Dyson360ZoneBehavioursRequest {
    cleaningStrategy:                   Dyson360VacuumMode;
}

// GET /v1/support/product-faults/{serial}?locale={languagecode}&market={countrycode}&faultCode=<code> (Spot+Scrub Ai only)
export interface Dyson360FaultDescription {
    codes:                      string[];       // e.g. ['597']
    cta:                        string;         // e.g. 'dyson:///support/resolve/7VS-EU-UNA6126A/RB05_TS_FAULT_WEB_DOCK_BIN_597'
    description:                string;
    dismissable:                boolean;
    linkRef?:                   string;         // e.g. 'RB05_TS_FAULT_WEB_DOCK_BIN_597'
    nextActionRequired?:        Dyson360FaultNextAction;
    severity:                   Dyson360FaultSeverity;
    title:                      string;
}
export type Dyson360FaultResponse = Dyson360FaultDescription[];