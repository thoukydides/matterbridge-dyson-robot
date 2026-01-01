// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonAirProductState } from './dyson-air-state-types.js';
import {
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponse
} from './dyson-cloud-types.js';

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export interface DysonAirUnifiedschedulerEvent extends DysonUnifiedschedulerEvent {
    settings:               DysonAirProductState;
}
export interface DysonAirUnifiedschedulerEventsResponse extends DysonUnifiedschedulerEventsResponse{
    events:                 DysonAirUnifiedschedulerEvent[];
}

// GET /v1/environment/devices/{serial}/data?language={languagecode}
export interface DysonAirEnvironmentResponse {
    DateTime:               string; // e.g. '2025-12-18T09:00:00Z'
    AqiState:               number;
    AqiValue:               number;
    ColorValue:             null;
    Pm25Value:              number;
    Pm10Value:              number;
    No2Value:               number;
    WeatherState:           number;
    Humidity:               null,
    Temperature:            null,
    LocationName:           string; // e.g. 'London'
    ColorIndex:             string; // e.g. '1'
    AqiName:                string; // e.g. 'Low'
    AqiDescription:         string; // e.g. 'Enjoy your usual outdoor activities.'
    Icon:                   null,
    Measure:                string; // e.g. 'AQI',
    PollenState:            number,
    DominantPollen:         null,
    Pollens:                null
}

// GET /v1/messageprocessor/devices/{serial}/environmentdata/daily
export interface DysonAirEnvironmentDataDailyResponse {
    start_time:             string; // e.g. '2025-12-12T00:00:00Z'
    resolution:             string; // e.g. 'PT15M'
    aqlm:                   number[];
    fnsp:                   number[];
    volm:                   number[];
    p25m:                   number[];
    hchm:                   number[];
    p10m:                   number[];
    no2m:                   number[];
    tmpm:                   number[];
    humm:                   number[];
    usage:                  number[];
    tmpm_min:               number;
    tmpm_max:               number;
    humm_min:               number;
    humm_max:               number;
}