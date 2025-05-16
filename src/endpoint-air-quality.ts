// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    AirQuality,
    ConcentrationMeasurement
} from 'matterbridge/matter/clusters';
import {
    AirQualityServer,
    CarbonDioxideConcentrationMeasurementServer,
    FormaldehydeConcentrationMeasurementServer,
    NitrogenDioxideConcentrationMeasurementServer,
    Pm10ConcentrationMeasurementServer,
    Pm25ConcentrationMeasurementServer,
    RelativeHumidityMeasurementServer,
    TemperatureMeasurementServer,
    TotalVolatileOrganicCompoundsConcentrationMeasurementServer
} from 'matterbridge/matter/behaviors';
import { Endpoint } from 'matterbridge/matter';

// Create the Air Quality cluster
export function createAirQualityClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(AirQualityServer.withFeatures(
        AirQuality.Feature.Fair,
        AirQuality.Feature.Moderate,
        AirQuality.Feature.VeryPoor,
        AirQuality.Feature.ExtremelyPoor
    ), {
        // Variable attributes
        airQuality: AirQuality.AirQualityEnum.Unknown
    });
}

// Create the Temperature Measurement cluster
export function createTemperatureMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(TemperatureMeasurementServer, {
        // Constant attributes
        minMeasuredValue:   -30.15 * 100,   // centi-°C
        maxMeasuredValue:    79.85 * 100,   // centi-°C
        tolerance:            0.50 * 100,   // centi-°C (5 deci-K steps)
        // Variable attributes
        measuredValue:      null
    });
}

// Create the Relative Humidity Measurement cluster
export function createRelativeHumidityMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(RelativeHumidityMeasurementServer, {
        // Constant attributes
        minMeasuredValue:     0.00 * 100,   // centi-%
        maxMeasuredValue:   100.00 * 100,   // centi-%
        tolerance:            1.00 * 100,   // centi-% (Dyson measures %)
        // Variable attributes
        measuredValue:      null
    });
}

// Create the Total Volatile Organic Compounds Concentration Measurement cluster
export function createTotalVolatileOrganicCompoundsConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(TotalVolatileOrganicCompoundsConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.LevelIndication,
        ConcentrationMeasurement.Feature.MediumLevel,
        ConcentrationMeasurement.Feature.CriticalLevel
    ), {
        // Constant attributes
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        // Variable attributes
        levelValue:         ConcentrationMeasurement.LevelValue.Unknown
    });
}

// Create the Carbon Dioxide Concentration Measurement cluster
export function createCarbonDioxideConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(CarbonDioxideConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.NumericMeasurement
    ), {
        // Constant attributes
        minMeasuredValue:      0,   // ppm
        maxMeasuredValue:   9999,   // ppm
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        measurementUnit:    ConcentrationMeasurement.MeasurementUnit.Ppm,
        uncertainty:        1,
        // Variable attributes
        measuredValue:      null
    });
}

// Create the Nitrogen Dioxide Concentration Measurement cluster
export function createNitrogenDioxideConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(NitrogenDioxideConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.LevelIndication,
        ConcentrationMeasurement.Feature.MediumLevel,
        ConcentrationMeasurement.Feature.CriticalLevel
    ), {
        // Constant attributes
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        // Variable attributes
        levelValue:         ConcentrationMeasurement.LevelValue.Unknown
    });
}

// Create the Formaldehyde Concentration Measurement cluster
export function createFormaldehydeConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(FormaldehydeConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.NumericMeasurement
    ), {
        // Constant attributes
        minMeasuredValue:     0,    // µg/m³
        maxMeasuredValue:   999,    // µg/m³ (99 for v1 sensors)
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        measurementUnit:    ConcentrationMeasurement.MeasurementUnit.Ugm3,
        uncertainty:        1,
        // Variable attributes
        measuredValue:      null
    });
}

// Create the PM2.5 Concentration Measurement cluster
export function createPm25ConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(Pm25ConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.NumericMeasurement
    ), {
        // Constant attributes
        minMeasuredValue:     0,    // µg/m³
        maxMeasuredValue:   999,    // µg/m³ (149 for v1 sensors)
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        measurementUnit:    ConcentrationMeasurement.MeasurementUnit.Ugm3,
        uncertainty:        1,
        // Variable attributes
        measuredValue:      null
    });
}

// Create the PM10 Concentration Measurement cluster
export function createPm10ConcentrationMeasurementClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(Pm10ConcentrationMeasurementServer.withFeatures(
        ConcentrationMeasurement.Feature.NumericMeasurement
    ), {
        // Constant attributes
        minMeasuredValue:     0,    // µg/m³
        maxMeasuredValue:   999,    // µg/m³ (149 for v1 sensors)
        measurementMedium:  ConcentrationMeasurement.MeasurementMedium.Air,
        measurementUnit:    ConcentrationMeasurement.MeasurementUnit.Ugm3,
        uncertainty:        1,
        // Variable attributes
        measuredValue:      null
    });
}