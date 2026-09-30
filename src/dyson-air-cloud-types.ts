// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonAirProductState } from './dyson-air-state-types.js';
import { DysonAirCTAType, DysonAirFaultSeverity } from './dyson-air-types.js';
import {
    DysonUnifiedschedulerEvent,
    DysonUnifiedschedulerEventsResponseV1
} from './dyson-cloud-types.js';

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export interface DysonAirUnifiedschedulerEvent extends DysonUnifiedschedulerEvent {
    settings:               DysonAirProductState;
}
export interface DysonAirUnifiedschedulerEventsResponseV1 extends DysonUnifiedschedulerEventsResponseV1{
    events:                 DysonAirUnifiedschedulerEvent[];
}

// GET /v1/environment/devices/{serial}/data?language={languagecode}
export interface DysonAirEnvironmentResponseV1 {
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
    DominantPollen:         string | null,
    Pollens:                { [key: string]: string } | null;
}

// GET /v1/messageprocessor/devices/{serial}/environmentdata/daily
export interface DysonAirEnvironmentDataDailyResponseV1 {
    start_time:             string; // e.g. '2025-12-12T00:00:00Z'
    resolution:             string; // e.g. 'PT15M'
    aqlm:                   (number | null)[];
    fnsp:                   (number | null)[];
    volm?:                  (number | null)[];
    p25m:                   (number | null)[];
    hchm?:                  (number | null)[];
    p10m:                   (number | null)[];
    no2m?:                  (number | null)[];
    tmpm?:                  (number | null)[];
    humm?:                  (number | null)[];
    usage:                  (number | null)[];
    tmpm_min?:              number;
    tmpm_max?:              number;
    humm_min?:              number;
    humm_max?:              number;
}

// GET /v1/support/product-faults/{serial}?locale={languagecode}&market={countrycode}&faultCode=<code>
export interface DysonAirFaultDescription {
    codes:                      string[];       // e.g. ['sen1.FAIL']
    cta:                        string;         // e.g. 'dyson:///support/resolve/{serial}/008-01-01-4'
    ctaType:                    DysonAirCTAType;
    description:                string;
    dismissable:                boolean;
    id?:                        string;         // e.g. 'fault_settings'
    linkRef?:                   string;         // e.g. '007-02-01-2'
    priority?:                  number;
    severity:                   DysonAirFaultSeverity;
    title:                      string;
}
export type DysonAirFaultResponseV1 = DysonAirFaultDescription[];