// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    FanControl,
    ResourceMonitoring
} from 'matterbridge/matter/clusters';
import {
    ActivatedCarbonFilterMonitoringServer,
    FanControlServer,
    HepaFilterMonitoringServer
} from 'matterbridge/matter/behaviors';
import { Endpoint } from 'matterbridge/matter';
import {
    MatterbridgeOnOffServer
} from 'matterbridge';

// Device-specific endpoint configuration
interface FanRock {
    rockLeftRight?:         boolean;
    rockUpDown?:            boolean;
    rockRound?:             boolean;
}
interface FanWind {
    sleepWind?:             boolean; // = Night mode
    naturalWind?:           boolean; // = Breeze
}
export interface FanControlOptions {
    rockSupport?:           FanRock;
    windSupport?:           FanWind;
    directionSupport:       boolean;
}
export interface FilterMonitoringOptions {
    filterPartNumbers?:     string[];
}

// An entry in the ReplacementProductList attribute array
interface FilterReplacementProduct {
    productIdentifierType:  number;
    productIdentifierValue: string;
}

// Create the On/Off cluster
export function createOnOffClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(MatterbridgeOnOffServer, {
        // Variable attributes
        onOff:                          false
    });
}

// Create the Fan Control cluster
export function createFanControlClusterServer(
    { behaviors }: Endpoint, options: FanControlOptions
): void {
    const { directionSupport } = options;
    let { rockSupport, windSupport } = options;
    const features = [
        FanControl.Feature.MultiSpeed,
        FanControl.Feature.Auto
    ];
    if (directionSupport) features.push(FanControl.Feature.AirflowDirection);
    if (!rockSupport?.rockLeftRight && !rockSupport?.rockUpDown && !rockSupport?.rockRound) rockSupport = undefined;
    else features.push(FanControl.Feature.Rocking);
    if (!windSupport?.sleepWind && !windSupport?.naturalWind) windSupport = undefined;
    else features.push(FanControl.Feature.Wind);
    behaviors.require(FanControlServer.withFeatures(...features), {
        // Constant attributes
        rockSupport,
        windSupport,
        speedMax:                   10,
        fanModeSequence:            FanControl.FanModeSequence.OffLowMedHighAuto,
        // Variable attributes
        fanMode:                    FanControl.FanMode.Off,
        percentSetting:             0,
        percentCurrent:             0,
        speedSetting:               0,
        speedCurrent:               0,
        rockSetting:                rockSupport && {},
        windSetting:                windSupport && {},
        airflowDirection:           directionSupport ? FanControl.AirflowDirection.Forward : undefined
    });
}

// Create the HEPA Filter Monitoring cluster
export function createHepaFilterMonitoringClusterServer(
    { behaviors }: Endpoint, options: FilterMonitoringOptions
): void {
    const { features, replacementProductList } = makeFeaturesAndReplacements(options);
    behaviors.require(HepaFilterMonitoringServer.withFeatures(...features), {
        // Constant attributes
        degradationDirection:       ResourceMonitoring.DegradationDirection.Down,
        replacementProductList,
        // Variable attributes
        condition:                  0,
        changeIndication:           ResourceMonitoring.ChangeIndication.Ok,
        inPlaceIndicator:           true,
        // Unsupported attributes
        lastChangedTime:            undefined
    });
}

// Create the Activated Carbon Filter Monitoring cluster
export function createActivatedCarbonFilterMonitoringClusterServer(
    { behaviors }: Endpoint, options: FilterMonitoringOptions
): void {
    const { features, replacementProductList } = makeFeaturesAndReplacements(options);
    behaviors.require(ActivatedCarbonFilterMonitoringServer.withFeatures(...features), {
        // Constant attributes
        degradationDirection:       ResourceMonitoring.DegradationDirection.Down,
        replacementProductList,
        // Variable attributes
        condition:                  0,
        changeIndication:           ResourceMonitoring.ChangeIndication.Ok,
        inPlaceIndicator:           false,
        // Unsupported attributes
        lastChangedTime:            undefined
    });
}

// Prepare features and replacement products for a Filter Monitoring cluster
function makeFeaturesAndReplacements(options: FilterMonitoringOptions): {
    features:                   ResourceMonitoring.Feature[];
    replacementProductList?:    FilterReplacementProduct[];
} {
    // Default features that are always supported
    const features = [
        ResourceMonitoring.Feature.Condition,
        ResourceMonitoring.Feature.Warning
    ];
    let replacementProductList: FilterReplacementProduct[] | undefined;

    // Add a ReplacementProductList if filter part numbers were provided
    const { filterPartNumbers } = options;
    if (filterPartNumbers?.length) {
        features.push(ResourceMonitoring.Feature.ReplacementProductList);
        replacementProductList = filterPartNumbers.map(identifier => ({
            productIdentifierType:  ResourceMonitoring.ProductIdentifierType.Oem,
            productIdentifierValue: identifier.substring(0, 20)
        }));
    }
    return { features, replacementProductList };
}