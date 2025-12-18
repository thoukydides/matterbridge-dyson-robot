// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360CleaningStrategy
} from './dyson-360-types.js';
import {
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponse
} from './dyson-cloud-types.js';

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export enum Dyson360EyeEventPowerMode {
    Quiet                               = 1,
    Max                                 = 0
}
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

// GET /v1/assets/devices/{serial}/cleanhistory?culture={languagecode} (Eye only)
export interface Dyson360CleanHistoryEntry {
    Area:                               number;
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

// GET /v1/mapvisualizer/devices/{serial}/map/{uuid} (Eye only)
// Accept: image/png

// GET /v1/app/{serial}/persistent-map-metadata (Vis Nav only)
export interface Dyson360PersistentMapMetadataZone {
    area:                               number;
    icon:                               string; // e.g. 'kitchen'
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
    name:                               string; // e.g. 'Downstairs'
    lastVisited:                        string; // e.g. '2025-12-17T13:36:17.768Z'
    zones:                              Dyson360PersistentMapMetadataZone[];
    zoneProperties:                     Dyson360PersistentMapMetadataZoneProperties[];
    zonesDefinitionLastUpdatedDate:     string; // e.g. '2025-12-17T11:30:52.6166355Z'
}
export type Dyson360PersistentMapMetadataResponse = Dyson360PersistentMapMetadata[];

// GET /v1/app/{serial}/persistent-maps/{uuid} (Vis Nav only)
export interface Dyson360PersistentMapVertex {
    x:                                  number;
    y:                                  number;
}
export interface Dyson360PersistentMapLocation extends Dyson360PersistentMapVertex{
    angle:                              number;
}
export interface Dyson360PersistentMapBitmap {
    resolution:                         number;
    data:                               string; // base64 encoded PNG image
}
export interface Dyson360PersistentMapThreshold {
    startX:                             number;
    startY:                             number;
    endX:                               number;
    endY:                               number;
    leftZone:                           string; // e.g. '1'
    rightZone:                          string; // e.g. '2'
}
export interface Dyson360PersistentMapZonesDefinition {
    lastUpdatedDate:                    string; // e.g. '2025-12-17T11:30:52.6166355Z'
    persistentMapDisplayOrientation:    number; // e.g. 270
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
export interface Dyson360PersistentMap {
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

// GET /v1/app/{serial}/recommended-cleans (Vis Nav only)
export interface Dyson360ZonePredictionDustMilligrams {
    name:                               string; // e.g. 'extraFine', 'fine', 'medium', 'large', 'other', 'total'
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

// PUT /v1/app/{serial}/{uuid}/zones/{zoneid}/zone-behaviours (Vis Nav only)
export interface Dyson360ZoneBehavioursRequest {
    cleaningStrategy:                   Dyson360CleaningStrategy;
}