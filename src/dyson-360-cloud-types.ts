// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360CleaningStrategy,
    Dyson360DustName,
    Dyson360EyeEventPowerMode,
    Dyson360TimelineEvent,
    Dyson360ZoneIcon,
    Dyson360ZoneStatus
} from './dyson-360-types.js';
import {
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponse
} from './dyson-cloud-types.js';

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export interface Dyson360UnifiedschedulerEvent extends DysonUnifiedschedulerEvent {
    settings: {
        cleaningProgramme:              Dyson360CleaningProgramme   | null;
        cleaningStrategy:               Dyson360CleaningStrategy    | null;
        currentCleaningMode?:           Dyson360CleaningMode;
        powerMode:                      Dyson360EyeEventPowerMode   | null;
    }
}
export interface Dyson360UnifiedschedulerEventsResponse extends DysonUnifiedschedulerEventsResponse{
    events:                             Dyson360UnifiedschedulerEvent[];
}

// GET /v1/assets/devices/{serial}/cleanhistory?culture={languagecode} (360 Eye only)
export interface Dyson360CleanHistoryEntry {
    Area:                               number; // m²
    Charges:                            number;
    Clean:                              string; // UUID
    Finished:                           string; // e.g. '2025-12-18T09:06:18'
    FinishedIso8601:                    string; // e.g. '2025-12-18T09:06:18Z'
    IsInterim:                          boolean;
    Started:                            string; // e.g. '2025-12-18T09:00:27'
    StartedIso8601:                     string; // e.g. '2025-12-18T09:00:27Z'
    Type:                               string; // e.g. 'Scheduled'
}
export interface Dyson360CleanHistoryResponse {
    Entries:                            Dyson360CleanHistoryEntry[];
    TriviaArea:                         number; // e.g. 0
    TriviaMessage:                      string; // e.g. ''
}

// GET /v1/app/{serial}/persistent-map-metadata (360 Vis Nav only)
export interface Dyson360PersistentMapMetadataZone {
    area:                               number; // m²
    icon:                               Dyson360ZoneIcon;
    id:                                 string; // e.g. '1'
    name:                               string; // e.g. 'Kitchen'
}
export interface Dyson360PersistentMapMetadataZoneProperties {
    zones:                              string[]; // e.g. ['1']
    zoneBehaviours: {
        vacuumPowerMode:                null;
        cleaningStrategy:               Dyson360CleaningStrategy;
    }
}
export interface Dyson360PersistentMapMetadata {
    id:                                 string; // UUID
    name:                               string | null; // e.g. 'Downstairs'
    lastVisited:                        string; // e.g. '2025-12-17T13:36:17.768Z'
    zones:                              Dyson360PersistentMapMetadataZone[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[];
    zonesDefinitionLastUpdatedDate:     string | null; // e.g. '2025-12-17T11:30:52.6166355Z'
}
export type Dyson360PersistentMapMetadataResponse = Dyson360PersistentMapMetadata[];

// GET /v1/app/{serial}/persistent-maps/{uuid} (360 Vis Nav only)
export interface Dyson360PersistentMapVertex {
    x:                                  number; // mm
    y:                                  number; // mm
}
export interface Dyson360PersistentMapLocation extends Dyson360PersistentMapVertex{
    angle:                              number; // °
}
export interface Dyson360PersistentMapBitmap {
    resolution:                         number; // mm/pixel
    data:                               string; // base64 encoded PNG image
}
export interface Dyson360PersistentMapThreshold {
    startX:                             number; // mm
    startY:                             number; // mm
    endX:                               number; // mm
    endY:                               number; // mm
    leftZone:                           string; // e.g. '1'
    rightZone:                          string; // e.g. '2'
}
export interface Dyson360PersistentMapZonesDefinition {
    lastUpdatedDate:                    string; // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapDisplayOrientation:    number; // °
    persistentMapId:                    string; // UUID
    persistentMapName:                  string; // e.g. 'Downstairs'
    persistentMapOffset:                Dyson360PersistentMapLocation;
    persistentMapVersion:               number; // e.g. 1
    thresholds:                         Dyson360PersistentMapThreshold[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[],
    zones:                              Dyson360PersistentMapMetadataZone[],
    zonesMap:                           Dyson360PersistentMapBitmap;
}
export interface Dyson360PersistentMapRestrictionProperties {
    keepOut:                            true | null;
    brushBarOff:                        true | null;
    vacuumPowerMode:                    null;
    noClimb:                            true | null;
    lowObjectSensitivity:               null;
}
export interface Dyson360PersistentMapRestriction {
    icon:                               null;
    id:                                 number;
    name:                               string; // e.g. 'Avoid cables'
    priority:                           number;
    properties:                         Dyson360PersistentMapRestrictionProperties;
    vertices:                           Dyson360PersistentMapVertex[];
}
export interface Dyson360PersistentMapRestrictionsDefinition {
    lastUpdatedDate:                    string; // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapId:                    string; // UUID
    persistentMapOffset:                Dyson360PersistentMapLocation;
    persistentMapVersion:               number; // e.g. 3
    restrictions:                       Dyson360PersistentMapRestriction[];
}
export interface Dyson360PersistentMapResponse {
    dockLocations:                      Dyson360PersistentMapLocation[],
    highSensitivityAdditionalObjects:   Dyson360PersistentMapBitmap;
    id:                                 string; // UUID
    lastVisited:                        string; // e.g. '2025-12-17T13:36:17.768Z',
    lowSensitivityObjects:              Dyson360PersistentMapBitmap;
    maturity:                           Dyson360PersistentMapBitmap;
    occupancyProbability:               Dyson360PersistentMapBitmap;
    offset:                             Dyson360PersistentMapLocation;
    presentationMap:                    Dyson360PersistentMapBitmap;
    restrictionsDefinition:             Dyson360PersistentMapRestrictionsDefinition | null;
    version:                            number; // e.g. 2
    visitedFootprint:                   Dyson360PersistentMapBitmap;
    zonesDefinition:                    Dyson360PersistentMapZonesDefinition;
}

// GET /v1/{serial}/clean-maps?dustMap=total
export interface Dyson360CleanTimelineEntry {
    eventName:                          Dyson360TimelineEvent;
    time:                               string;         // e.g. '2025-12-23T09:00:25Z'
    zone:                               string | null;  // e.g. '1'
    targetZone:                         string | null;  // e.g. '1'
    persistentMapId:                    string | null;  // UUID
    reason:                             null;
    faultCode:                          string | null;  // e.g. '23.1.-1'
    faultType:                          string | null;  // e.g. 'BRUSH_BAR_AND_TRACTION'
    faultLocation:                      Dyson360PersistentMapVertex | null;
}
export interface DysonCleanMapDustData {
    name:                               Dyson360DustName; // (only 'total')
    scaleFactor:                        number; // 100% in data scale
    data:                               string; // base64 encoded, zlib deflate compressed, width×height octets
}
export interface DysonCleanMapDustMap {
    width:                              number; // pixels
    height:                             number; // pixels
    resolution:                         number; // mm/pixel
    dustData:                           DysonCleanMapDustData[];
}
export interface DysonCleanMapPersistentMap {
    id:                                 string; // UUID
    cleanMapPosition:                   Dyson360PersistentMapLocation;
};
export interface Dyson360CleanMap {
    cleanedFootprint:                   Dyson360PersistentMapBitmap;
    cleanId:                            string; // UUID
    cleanTimeline:                      Dyson360CleanTimelineEntry[];
    dustMap:                            DysonCleanMapDustMap;
    highSensitivityAdditionalObjects:   Dyson360PersistentMapBitmap;
    lowSensitivityObjects:              Dyson360PersistentMapBitmap;
    occupancyProbability:               Dyson360PersistentMapBitmap;
    persistentMap:                      DysonCleanMapPersistentMap | null;
    robotPath:                          [];
    sequenceNumber:                     number;
    zones:                              Dyson360PersistentMapBitmap;
    zoneStatus:                         Dyson360ZoneStatus[] | null;
}
export type Dyson360CleanMapsResponse = Dyson360CleanMap[];

// GET /v1/app/{serial}/recommended-cleans (360 Vis Nav only)
export interface Dyson360ZonePredictionDustMilligrams {
    name:                               Dyson360DustName;
    weight:                             number;
}
export interface Dyson360ZonePrediction {
    zoneId:                             string; // e.g. '1'
    zoneDustMilligrams:                 Dyson360ZonePredictionDustMilligrams[];
}
export interface Dyson360RecommendedClean {
    persistentMapId:                    string; // UUID
    zonePredictions:                    Dyson360ZonePrediction[];
}
export type Dyson360RecommendedCleansResponse = Dyson360RecommendedClean[];

// PUT /v1/app/{serial}/{uuid}/zones/{zoneid}/zone-behaviours (360 Vis Nav only)
export interface Dyson360ZoneBehavioursRequest {
    cleaningStrategy:                   Dyson360CleaningStrategy;
}