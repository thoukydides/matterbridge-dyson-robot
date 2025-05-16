// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AirQuality, ConcentrationMeasurement } from 'matterbridge/matter/clusters';
import { DysonMqttStatusAirSensor } from './dyson-mqtt-air.js';
import { UpdateAirSensors } from './endpoint-air.js';
import { assertIsDefined, formatList } from './utils.js';
import { AnsiLogger } from 'matterbridge/logger';

// Thresholds to map different pollutants to Air Quality levels:
//  co2r  CO2           Common indoor air quality guidelines
//  hcho  Formaldehyde  WHO guidelines and typical concern levels
//  pm25  PM2.5         US EPA 24-hour AQI breakpoints *
//  pm10  PM10          US EPA 24-hour AQI breakpoints *
//  vact  VOC           Arbitrary mapping of unknown index values
//  noxl  NOx           Arbitrary mapping of unknown index values
//  pact  Dust          Arbitrary mapping of unknown index values
// * = https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html
const AQI_COLUMNS = [                           'co2r', 'hcho', 'pm25', 'pm10', 'vact', 'noxl', 'pact'
] as const satisfies (keyof DysonMqttStatusAirSensor)[];
const AQI_THRESHOLDS: [AirQuality.AirQualityEnum, number[]][] = [
    //                                          ppm     µg/m³   µg/m³   µg/m³   0~99    0~99    0~9
    [AirQuality.AirQualityEnum.Good,           [ 800,    10,      9.0,   54,    10,     10,     0]],
    [AirQuality.AirQualityEnum.Fair,           [1000,    30,     35.4,  154,    25,     25,     1]],
    [AirQuality.AirQualityEnum.Moderate,       [1500,    60,     55.4,  254,    50,     50,     3]],
    [AirQuality.AirQualityEnum.Poor,           [2500,   100,    125.4,  354,    75,     75,     5]],
    [AirQuality.AirQualityEnum.VeryPoor,       [5000,   200,    225.4,  424,    90,     90,     7]]
    // (AirQuality.AirQualityEnum.ExtremelyPoor for anything higher)
];
type AqiKey = typeof AQI_COLUMNS[number];
type SensorsAQI     = Map<AqiKey, AirQuality.AirQualityEnum>;
type SensorsLevel   = Map<AqiKey, ConcentrationMeasurement.LevelValue>;

// Mapping from Air Quality to Concentration Measurement levels
const LEVEL_MAP: Record<AirQuality.AirQualityEnum, ConcentrationMeasurement.LevelValue> = {
    [AirQuality.AirQualityEnum.Unknown]:        ConcentrationMeasurement.LevelValue.Unknown,
    [AirQuality.AirQualityEnum.Good]:           ConcentrationMeasurement.LevelValue.Low,
    [AirQuality.AirQualityEnum.Fair]:           ConcentrationMeasurement.LevelValue.Low,
    [AirQuality.AirQualityEnum.Moderate]:       ConcentrationMeasurement.LevelValue.Medium,
    [AirQuality.AirQualityEnum.Poor]:           ConcentrationMeasurement.LevelValue.High,
    [AirQuality.AirQualityEnum.VeryPoor]:       ConcentrationMeasurement.LevelValue.High,
    [AirQuality.AirQualityEnum.ExtremelyPoor]:  ConcentrationMeasurement.LevelValue.Critical
};

// Map numeric sensor values to Air Quality Sensor enum values
function mapToAirQualitySensorEnum(sensors: DysonMqttStatusAirSensor): SensorsAQI {
    const aqiValues: SensorsAQI = new Map();
    AQI_COLUMNS.forEach((key: AqiKey, index: number) => {
        const value = sensors[key];
        if (value === undefined) return;
        if (typeof value === 'number') {
            const aqiRow = AQI_THRESHOLDS.find(([, thresholds]) => value <= (thresholds[index] ?? Infinity));
            const aqi = aqiRow ? aqiRow[0] : AirQuality.AirQualityEnum.ExtremelyPoor;
            aqiValues.set(key, aqi);
        } else {
            aqiValues.set(key, AirQuality.AirQualityEnum.Unknown);
        }
    });
    return aqiValues;
}

// Determine the overall air quality as the worst of the available data
function worstAirQuality(log: AnsiLogger, aqiValues: SensorsAQI): AirQuality.AirQualityEnum {
    const values: string[] = [];
    let aqi = AirQuality.AirQualityEnum.Unknown;
    aqiValues.forEach((aqiValue: AirQuality.AirQualityEnum, key: AqiKey) => {
        if (aqiValue > aqi) aqi = aqiValue;
        values.push(`${key}:${AirQuality.AirQualityEnum[aqiValue]}`);
    });
    log.debug(`Air quality is ${AirQuality.AirQualityEnum[aqi]} (${formatList(values)})`);
    return aqi;
}

// Map Air Quality Sensor values to Concentration Measurement levels
function mapToAirQualityLevelEnum(aqiValues: SensorsAQI): SensorsLevel {
    const levelValues: SensorsLevel = new Map();
    aqiValues.forEach((aqi: AirQuality.AirQualityEnum, key: AqiKey) => {
        levelValues.set(key, LEVEL_MAP[aqi]);
    });
    return levelValues;
}

// Ensure that a numeric type is either a number, null (any other value), or undefined
export function numeric(value:  number | string, factor?: number): number | null;
export function numeric(value?: number | string, factor?: number): number | null | undefined;
export function numeric(value?: number | string, factor = 1): number | null | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return null;
    return Math.round(value * factor);
}

// Map the Dyson sensor data to Matter attribute values
export function mapDysonAirSensorStatus(log: AnsiLogger, status: DysonMqttStatusAirSensor): UpdateAirSensors {
    const { tact, hact, co2r, hcho, pm25, pm10 } = status;
    assertIsDefined(tact);
    assertIsDefined(hact);

    // Map the available measurements to Air Quality
    const aqiValues = mapToAirQualitySensorEnum(status);
    const levelValues = mapToAirQualityLevelEnum(aqiValues);

    // Return the mapped sensor readings
    return {
        airQuality:     worstAirQuality(log, aqiValues),
        temperature:    numeric(tact, 100), // centi-°C
        humidity:       numeric(hact, 100), // centi-%
        voc:            levelValues.get('vact'),
        co2:            numeric(co2r),      // ppm
        nox:            levelValues.get('noxl'),
        hcho:           numeric(hcho),      // µg/m³
        pm25:           numeric(pm25),      // µg/m³
        pm10:           numeric(pm10)       // µg/m³
    };
}