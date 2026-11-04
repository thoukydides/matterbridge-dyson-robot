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
    RvcCleanModeServer360,
    RvcOperationalStateServer360,
    RvcRunMode360,
    RvcRunModeServer360,
    ServiceAreaServer360
} from './endpoint-360-behavior.js';
import { RvcOperationalStateError } from './error-360.js';
import { AtLeastOne, Endpoint } from 'matterbridge/matter';

// Device-specific endpoint configuration
export interface BatteryPowerSourceOptions {
    batteryPartNumber:          string;
}
export interface RvcCleanModeDefinition {
    label:                      string;
    tags:                       AtLeastOne<keyof typeof RvcCleanMode.ModeTag>;
}
export interface RvcCleanModeOptions {
    modes:                      RvcCleanModeDefinition[];
    vacuumVariants?:            RvcCleanModeDefinition[];
    mopVariants?:               RvcCleanModeDefinition[];
    simpleModeTags:             boolean;
}
export interface RvcOperationalStateOptions {
    supportsEmptyingDustBin:    boolean;
    supportsCleaningMop:        boolean;
}

// Reverse mapping for RVC Clean Mode to individual modes and variants
export interface RvcCleanModeOption {
    label:                      string;
    modeIndex:                  number;
    vacuumIndex?:               number;
    mopIndex?:                  number;
}
export type RvcCleanModeMap = Map<number, RvcCleanModeOption>;

// Create the Power Source cluster for the rechargeable battery
export const batteryPowerSourceBehavior =
    PowerSourceServer.withFeatures(
        PowerSource.Feature.Battery,
        PowerSource.Feature.Rechargeable,
        PowerSource.Feature.Replaceable
    ).enable({
        events: {
            batFaultChange:         true,
            batChargeFaultChange:   true
        }
    });
export function createBatteryPowerSourceClusterServer(
    { behaviors }:          Endpoint,
    { batteryPartNumber }:  BatteryPowerSourceOptions
): void {
    behaviors.require(batteryPowerSourceBehavior, {
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
export const rvcRunModeBehavior =
    RvcRunModeServer360.enable({
        commands: {
            changeToMode: true
        }
    });
export function createRvcRunModeClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(rvcRunModeBehavior, {
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
export const rvcCleanModeBehavior =
    RvcCleanModeServer360.enable({
        commands: {
            changeToMode: true
        }
    });
export function createRvcCleanModeClusterServer(
    { behaviors }:                                          Endpoint,
    { modes, vacuumVariants, mopVariants, simpleModeTags }: RvcCleanModeOptions
): RvcCleanModeMap {
    // Combine the variants with the main modes for the supported modes list
    const supportedModes: RvcCleanMode.ModeOption[] = [];
    const cleanModeMap = new Map<number, RvcCleanModeOption>();
    for (const [modeIndex, mode] of modes.entries()) {
        let modeVariants: { mode: RvcCleanModeDefinition, option: Omit<RvcCleanModeOption, 'label'> }[] =
            [{ mode, option: { modeIndex } }];
        const modeHasTag = (tag: keyof typeof RvcCleanMode.ModeTag) => mode.tags.includes(tag);
        const modeVariant = (mode: RvcCleanModeDefinition, variant: RvcCleanModeDefinition): RvcCleanModeDefinition => ({
            label:  `${mode.label} ${variant.label}`,
            tags:   [...mode.tags, ...(simpleModeTags ? [variant.tags[0]] : variant.tags)]
        });

        // Generate combinations of vacuum and mop variants for the current mode
        if (vacuumVariants?.length && (modeHasTag('Vacuum') || modeHasTag('VacuumThenMop'))) {
            modeVariants = modeVariants.flatMap(({ mode, option }) =>
                vacuumVariants.map((vacuumVariant, vacuumIndex) => ({
                    mode:   modeVariant(mode, vacuumVariant),
                    option: { ...option, vacuumIndex }
                })));
        }
        if (mopVariants?.length && (modeHasTag('Mop') || modeHasTag('VacuumThenMop'))) {
            modeVariants = modeVariants.flatMap(({ mode, option }) =>
                mopVariants.map((mopVariant, mopIndex) => ({
                    mode:   modeVariant(mode, mopVariant),
                    option: { ...option, mopIndex }
                })));
        }

        // Add to the list of supported modes and the reverse mapping
        for (const { mode, option } of modeVariants) {
            const cleanMode = supportedModes.length;
            supportedModes.push({
                label:      mode.label.substring(0, 64),
                mode:       cleanMode,
                modeTags:   mode.tags.map(tag => ({ value: RvcCleanMode.ModeTag[tag] }))
            });
            cleanModeMap.set(cleanMode, { ...option, label: mode.label });
        }
    }

    // Create the RVC Clean Mode cluster
    behaviors.require(rvcCleanModeBehavior, {
        // Constant attributes
        supportedModes,
        // Variable attributes (with dummy defaults)
        currentMode:    0
    });

    // Return the reverse mapping
    return cleanModeMap;
}

// Create the RVC Operational State cluster
export const rvcOperationalStateBehavior =
    RvcOperationalStateServer360.enable({
        events: {
            operationalError:       true,
            operationCompletion:    true
        }, commands: {
            pause:                  true,
            resume:                 true,
            goHome:                 true
        }
    });
export function createRvcOperationalStateClusterServer(
    { behaviors }:                                      Endpoint,
    { supportsEmptyingDustBin, supportsCleaningMop }:   RvcOperationalStateOptions
): void {
    const operationalStateList: RvcOperationalState.OperationalStateStruct[] = [
        { operationalStateId: RvcOperationalState.OperationalState.Stopped },
        { operationalStateId: RvcOperationalState.OperationalState.Running },
        { operationalStateId: RvcOperationalState.OperationalState.Paused },
        { operationalStateId: RvcOperationalState.OperationalState.Error },
        { operationalStateId: RvcOperationalState.OperationalState.SeekingCharger },
        { operationalStateId: RvcOperationalState.OperationalState.Charging },
        { operationalStateId: RvcOperationalState.OperationalState.Docked }
    ];
    if (supportsEmptyingDustBin) {
        operationalStateList.push({ operationalStateId: RvcOperationalState.OperationalState.EmptyingDustBin });
    }
    if (supportsCleaningMop) {
        operationalStateList.push({ operationalStateId: RvcOperationalState.OperationalState.CleaningMop });
    }
    behaviors.require(rvcOperationalStateBehavior, {
        // Constant attributes
        operationalStateList,
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
export const serviceAreaBehavior =
    ServiceAreaServer360.withFeatures(
        ServiceArea.Feature.Maps,
        ServiceArea.Feature.ProgressReporting
    ).enable({
        commands: {
            selectAreas:        true
        }
    });
export function createServiceAreaClusterServer(
    { behaviors }: Endpoint
): void {
    behaviors.require(serviceAreaBehavior, {
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