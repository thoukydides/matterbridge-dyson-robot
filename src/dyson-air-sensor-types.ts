// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonAirSensorValue, DysonAirSleepTimer } from './dyson-air-types.js';

// Dyson air treatment environmental current sensor data
export interface DysonAirCurrentSensorData {
    // Temperature and humidity
    tact?:  DysonAirSensorValue;    // Temperature:     '2430'~'3530' deci-K or 'OFF'
    hact?:  DysonAirSensorValue;    // Humidity:        '0062'~'0100' % or 'OFF'
    // Air quality measurements
    co2a?:  DysonAirSensorValue;    // CO2:             ?
    co2r?:  DysonAirSensorValue;    // CO2:             '0000'~'9999' ppm
    pact?:  DysonAirSensorValue;    // Dust:            '0000'~'0009' index
    hcho?:  DysonAirSensorValue;    // Formaldehyde v1: '0000'~'0099' µg/m³
    hchr?:  DysonAirSensorValue;    // Formaldehyde v2: '0000'~'0999' µg/m³
    noxl?:  DysonAirSensorValue;    // NOx:             '0000'~'0099' index
    pm25?:  DysonAirSensorValue;    // PM2.5 v1:        '0000'~'0149' µg/m³
    p25r?:  DysonAirSensorValue;    // PM2.5 v2:        '0000'~'0999' µg/m³
    pm10?:  DysonAirSensorValue;    // PM10 v1:         '0000'~'0149' µg/m³
    p10r?:  DysonAirSensorValue;    // PM10 v2:         '0000'~'0999' µg/m³
    vact?:  DysonAirSensorValue;    // VOC v1:          '0000'~'0009' index
    va10?:  DysonAirSensorValue;    // VOC v2:          '0000'~'0099' index
    // Sleep timer
    sltm?:  DysonAirSleepTimer;     // Sleep timer:     '0000'~'9999' minutes or 'OFF'
}

// Dyson air treatment environmental and usage data
export interface DysonAirEnvironmentalUsageData {
    // Dust level histogram since start of hour
    pal0?:  DysonAirSensorValue;    // Time at Dust=0:  '0000'~'3600' seconds
    pal1?:  DysonAirSensorValue;    // Time at Dust=1:  '0000'~'3600' seconds
    pal2?:  DysonAirSensorValue;    // Time at Dust=2:  '0000'~'3600' seconds
    pal3?:  DysonAirSensorValue;    // Time at Dust=3:  '0000'~'3600' seconds
    pal4?:  DysonAirSensorValue;    // Time at Dust=4:  '0000'~'3600' seconds
    pal5?:  DysonAirSensorValue;    // Time at Dust=5:  '0000'~'3600' seconds
    pal6?:  DysonAirSensorValue;    // Time at Dust=6:  '0000'~'3600' seconds
    pal7?:  DysonAirSensorValue;    // Time at Dust=7:  '0000'~'3600' seconds
    pal8?:  DysonAirSensorValue;    // Time at Dust=8:  '0000'~'3600' seconds
    pal9?:  DysonAirSensorValue;    // Time at Dust=9:  '0000'~'3600' seconds
    palm?:  DysonAirSensorValue;    // Average (median or mean?) of palX
    // Volatile Organic Compound (VOC) level histogram since start of hour
    vol0?:  DysonAirSensorValue;    // Time at VOC=0:   '0000'~'3600' seconds
    vol1?:  DysonAirSensorValue;    // Time at VOC=1:   '0000'~'3600' seconds
    vol2?:  DysonAirSensorValue;    // Time at VOC=2:   '0000'~'3600' seconds
    vol3?:  DysonAirSensorValue;    // Time at VOC=3:   '0000'~'3600' seconds
    vol4?:  DysonAirSensorValue;    // Time at VOC=4:   '0000'~'3600' seconds
    vol5?:  DysonAirSensorValue;    // Time at VOC=5:   '0000'~'3600' seconds
    vol6?:  DysonAirSensorValue;    // Time at VOC=6:   '0000'~'3600' seconds
    vol7?:  DysonAirSensorValue;    // Time at VOC=7:   '0000'~'3600' seconds
    vol8?:  DysonAirSensorValue;    // Time at VOC=8:   '0000'~'3600' seconds
    vol9?:  DysonAirSensorValue;    // Time at VOC=9:   '0000'~'3600' seconds
    volm?:  DysonAirSensorValue;    // Average (median or mean?) of volX
    // Air Quality Level (AQL)histogram since start of hour
    aql0?:  DysonAirSensorValue;    // Time at AQL=0:   '0000'~'3600' seconds
    aql1?:  DysonAirSensorValue;    // Time at AQL=1:   '0000'~'3600' seconds
    aql2?:  DysonAirSensorValue;    // Time at AQL=2:   '0000'~'3600' seconds
    aql3?:  DysonAirSensorValue;    // Time at AQL=3:   '0000'~'3600' seconds
    aql4?:  DysonAirSensorValue;    // Time at AQL=4:   '0000'~'3600' seconds
    aql5?:  DysonAirSensorValue;    // Time at AQL=5:   '0000'~'3600' seconds
    aql6?:  DysonAirSensorValue;    // Time at AQL=6:   '0000'~'3600' seconds
    aql7?:  DysonAirSensorValue;    // Time at AQL=7:   '0000'~'3600' seconds
    aql8?:  DysonAirSensorValue;    // Time at AQL=8:   '0000'~'3600' seconds
    aql9?:  DysonAirSensorValue;    // Time at AQL=9:   '0000'~'3600' seconds
    aqlm?:  DysonAirSensorValue;    // Average (median or mean?) of aqlX
    // Other usage data
    fafs?:  DysonAirSensorValue;    // ?                '0000'~'3600' seconds
    faos?:  DysonAirSensorValue;    // ?                '0000'~'3600' seconds
    fofs?:  DysonAirSensorValue;    // ?                '0000'~'3600' seconds
    fons?:  DysonAirSensorValue;    // ?                '0000'~'3600' seconds
    humm?:  DysonAirSensorValue;    // Humidity?        '0000'~'0100' %
    tmpm?:  DysonAirSensorValue;    // Temperature?     '0000'~'5000' deci-K
}