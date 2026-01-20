// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    PowerSource,
    RvcCleanMode,
    RvcRunMode,
    RvcOperationalState,
    ServiceArea
} from 'matterbridge/matter/clusters';
import { PowerSourceServer } from 'matterbridge/matter/behaviors';
import {
    RvcCleanMode360,
    RvcCleanModeServer360,
    RvcOperationalStateServer360,
    RvcRunMode360,
    RvcRunModeServer360,
    ServiceAreaServer360
} from './endpoint-360-behavior.js';
import { RvcOperationalStateError } from './error-360.js';
import { Endpoint } from 'matterbridge/matter';
import { assertIsDefined } from './utils.js';

// Device-specific endpoint configuration
export interface BatteryPowerSourceOptions {
    batteryPartNumber:      string;
}
export type RvcCleanModeLabels = [RvcCleanMode360, string][];
export interface RvcCleanModeOptions {
    labels:                 RvcCleanModeLabels;
    simpleModeTags:         boolean;
}

// Create the Power Source cluster for the rechargeable battery
export function createBatteryPowerSourceClusterServer(
    { behaviors }:          Endpoint,
    { batteryPartNumber }:  BatteryPowerSourceOptions
): void {
    behaviors.require(PowerSourceServer.withFeatures(
        PowerSource.Feature.Battery,
        PowerSource.Feature.Rechargeable,
        PowerSource.Feature.Replaceable
    ).enable({
        events: {
            batFaultChange:         true,
            batChargeFaultChange:   true
        }
    }), {
        // Constant attributes
        batApprovedChemistry:       PowerSource.BatApprovedChemistry.LithiumIon,
        batCapacity:                6600, // mAh
        batFunctionalWhileCharging: false,
        batPresent:                 true,
        batQuantity:                1,
        batReplaceability:          PowerSource.BatReplaceability.UserReplaceable,
        batReplacementDescription:  `Dyson ${batteryPartNumber} (14.8V Li-ion)`,
        description:                'Primary Battery',
        endpointList:               [],
        order:                      0,
        // Variable attributes (with dummy defaults)
        activeBatChargeFaults:      [],
        activeBatFaults:            [],
        batChargeLevel:             PowerSource.BatChargeLevel.Ok,
        batChargeState:             PowerSource.BatChargeState.Unknown,
        batPercentRemaining:        null,
        batReplacementNeeded:       true,
        status:                     PowerSource.PowerSourceStatus.Unspecified,
        // Unsupported attributes
        batAnsiDesignation:         undefined,
        batChargingCurrent:         undefined,
        batCommonDesignation:       undefined,
        batIecDesignation:          undefined,
        batTimeRemaining:           undefined,
        batTimeToFullCharge:        undefined,
        batVoltage:                 null
    });
}

// Create the RVC Run Mode cluster
export function createRvcRunModeClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(RvcRunModeServer360.enable({
        commands: {
            changeToMode: true
        }
    }), {
        // Constant attributes
        supportedModes: [{
            label:      'Idle',
            mode:       RvcRunMode360.Idle,
            modeTags:   [{ value: RvcRunMode.ModeTag.Idle }]
        }, {
            label:      'Cleaning',
            mode:       RvcRunMode360.Cleaning,
            modeTags:   [{ value: RvcRunMode.ModeTag.Cleaning }]
        }, {
            label:      'Mapping',
            mode:       RvcRunMode360.Mapping,
            modeTags:   [{ value: RvcRunMode.ModeTag.Mapping }]
        }],
        // Variable attributes (with dummy defaults)
        currentMode:    RvcRunMode360.Idle
    });
}

// Create the RVC Clean Mode cluster
export function createRvcCleanModeClusterServer(
    { behaviors }:              Endpoint,
    { labels, simpleModeTags }: RvcCleanModeOptions
): void {
    // Mode tags to use for each mode (only first tag used in simple mode)
    const CLEAN_MODE_TAGS: Record<RvcCleanMode360, { value: RvcCleanMode.ModeTag }[]> = {
        [RvcCleanMode360.Quiet]: [
            { value: RvcCleanMode.ModeTag.Quiet },
            { value: RvcCleanMode.ModeTag.Vacuum },
            { value: RvcCleanMode.ModeTag.LowEnergy },
            { value: RvcCleanMode.ModeTag.LowNoise },
            { value: RvcCleanMode.ModeTag.Min },
            { value: RvcCleanMode.ModeTag.Night }
        ],
        [RvcCleanMode360.Quick]: [
            { value: RvcCleanMode.ModeTag.Quick },
            { value: RvcCleanMode.ModeTag.Vacuum },
            { value: RvcCleanMode.ModeTag.Day }
        ],
        [RvcCleanMode360.High]: [
            { value: RvcCleanMode.ModeTag.DeepClean },
            { value: RvcCleanMode.ModeTag.Vacuum },
            { value: RvcCleanMode.ModeTag.Day }
        ],
        [RvcCleanMode360.MaxBoost]: [
            { value: RvcCleanMode.ModeTag.Max },
            { value: RvcCleanMode.ModeTag.Vacuum },
            { value: RvcCleanMode.ModeTag.Day }
        ],
        [RvcCleanMode360.Auto]: [
            { value: RvcCleanMode.ModeTag.Auto },
            { value: RvcCleanMode.ModeTag.Vacuum },
            { value: RvcCleanMode.ModeTag.Day }
        ]
    };
    const modeTags = (mode: RvcCleanMode360): { value: RvcCleanMode.ModeTag }[] => {
        const tags = CLEAN_MODE_TAGS[mode];
        assertIsDefined(tags[0]);
        return simpleModeTags ? [tags[0]] : tags;
    };

    // Create the cluster
    behaviors.require(RvcCleanModeServer360.enable({
        commands: {
            changeToMode: true
        }
    }), {
        // Constant attributes
        supportedModes: labels.map(([mode, label]) => ({
            label,
            mode,
            modeTags:   modeTags(mode)
        })),
        // Variable attributes (with dummy defaults)
        currentMode:    RvcCleanMode360.Quiet
    });
}

// Create the RVC Operational State cluster
export function createRvcOperationalStateClusterServer(
    { behaviors }: Endpoint
): void {
    behaviors.require(RvcOperationalStateServer360.enable({
        events: {
            operationalError:       true,
            operationCompletion:    true
        }, commands: {
            pause:                  true,
            resume:                 true,
            goHome:                 true
        }
    }), {
        // Constant attributes
        operationalStateList: [
            { operationalStateId: RvcOperationalState.OperationalState.Stopped },
            { operationalStateId: RvcOperationalState.OperationalState.Running },
            { operationalStateId: RvcOperationalState.OperationalState.Paused },
            { operationalStateId: RvcOperationalState.OperationalState.Error },
            { operationalStateId: RvcOperationalState.OperationalState.SeekingCharger },
            { operationalStateId: RvcOperationalState.OperationalState.Charging },
            { operationalStateId: RvcOperationalState.OperationalState.Docked }
        ],
        // Variable attributes (with dummy defaults)
        operationalState:       RvcOperationalState.OperationalState.Stopped,
        operationalError:       RvcOperationalStateError.toStruct(),
        // Unsupported attributes
        phaseList:              null,
        currentPhase:           null,
        countdownTime:          null
    });
}

// Create the Service Area cluster
export function createServiceAreaClusterServer(
    { behaviors }: Endpoint
): void {
    behaviors.require(ServiceAreaServer360.withFeatures(
        ServiceArea.Feature.Maps,
        ServiceArea.Feature.ProgressReporting
    ).enable({
        commands: {
            selectAreas:        true
        }
    }), {
        // Variable attributes (with dummy defaults)
        currentArea:            null,
        progress:               [],
        selectedAreas:          [],
        supportedAreas:         [],
        supportedMaps:          [],
        // Unsupported attributes
        estimatedEndTime:       undefined
    });
}