// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

// Dyson robot vacuum state
export enum Dyson360State {
    MachineOff                      = 'MACHINE_OFF',
    FaultCallHelpline               = 'FAULT_CALL_HELPLINE',
    FaultContactHelpline            = 'FAULT_CONTACT_HELPLINE',
    FaultCritical                   = 'FAULT_CRITICAL',
    FaultGettingInfo                = 'FAULT_GETTING_INFO',
    FaultLost                       = 'FAULT_LOST',
    FaultOnDock                     = 'FAULT_ON_DOCK',
    FaultOnDockCharged              = 'FAULT_ON_DOCK_CHARGED',
    FaultOnDockCharging             = 'FAULT_ON_DOCK_CHARGING',
    FaultReplaceOnDock              = 'FAULT_REPLACE_ON_DOCK',
    FaultReturnToDock               = 'FAULT_RETURN_TO_DOCK',
    FaultRunningDiagnostic          = 'FAULT_RUNNING_DIAGNOSTIC',
    FaultUserRecoverable            = 'FAULT_USER_RECOVERABLE',
    FullCleanAbandoned              = 'FULL_CLEAN_ABANDONED',
    FullCleanAborted                = 'FULL_CLEAN_ABORTED',
    FullCleanCharging               = 'FULL_CLEAN_CHARGING',
    FullCleanDiscovering            = 'FULL_CLEAN_DISCOVERING',
    FullCleanFinished               = 'FULL_CLEAN_FINISHED',
    FullCleanInitiated              = 'FULL_CLEAN_INITIATED',
    FullCleanNeedsCharge            = 'FULL_CLEAN_NEEDS_CHARGE',
    FullCleanPaused                 = 'FULL_CLEAN_PAUSED',
    FullCleanRunning                = 'FULL_CLEAN_RUNNING',
    FullCleanTraversing             = 'FULL_CLEAN_TRAVERSING',
    InactiveCharged                 = 'INACTIVE_CHARGED',
    InactiveCharging                = 'INACTIVE_CHARGING',
    InactiveDischarging             = 'INACTIVE_DISCHARGING',
    MappingAborted                  = 'MAPPING_ABORTED',
    MappingCharging                 = 'MAPPING_CHARGING',
    MappingFinished                 = 'MAPPING_FINISHED',
    MappingInitiated                = 'MAPPING_INITIATED',
    MappingNeedsCharge              = 'MAPPING_NEEDS_CHARGE',
    MappingPaused                   = 'MAPPING_PAUSED',
    MappingRunning                  = 'MAPPING_RUNNING'
}

// Fault status
export type Dyson360FaultStatus = {
    active:                         false;
} | {
    active:                         true;
    description:                    string; // e.g. '23.0.3',
}
export interface Dyson360Faults {
    AIRWAYS:                        Dyson360FaultStatus;
    BATTERY:                        Dyson360FaultStatus;
    BRUSH_BAR_AND_TRACTION:         Dyson360FaultStatus;
    CHARGE_STATION:                 Dyson360FaultStatus;
    LIFT?:                          Dyson360FaultStatus;
    LOST:                           Dyson360FaultStatus;
    OPTICS:                         Dyson360FaultStatus;
}

// Details of an active fault (Dyson 360 Vis Nav only?)
export enum Dyson360FaultNextAction {
    WaitToClean                     = 'WAIT_TO_CLEAR',
    LocalUserContinue               = 'LOCAL_USER_CONTINUE'
}
export enum Dyson360FaultPresent {
    Present                         = 'PRESENT',
    NotPresent                      = 'NOT_PRESENT'
}
export enum Dyson360FaultUserAction {
    UserRecoverable                 = 'USER_RECOVERABLE'
}
export interface Dyson360ActiveFault {
    faultCode:                      string; // e.g. '23.0.3',
    nextActionRequired:             Dyson360FaultNextAction;
    present:                        Dyson360FaultPresent;
    requiredUserAction:             Dyson360FaultUserAction;
}

// Dyson robot vacuum power mode
export enum Dyson360EyePowerMode {
    Quiet                           = 'halfPower',
    Max                             = 'fullPower'
}
export enum Dyson360HeuristPowerMode {
    Quiet                           = '1',
    High                            = '2',
    Max                             = '3'
}
export enum Dyson360VisNavPowerMode {
    Unknown                         = '0',
    Auto                            = '1',
    Quick                           = '2',
    Quiet                           = '3',
    Boost                           = '4'
}
export type Dyson360PowerMode =
    Dyson360EyePowerMode
  | Dyson360HeuristPowerMode
  | Dyson360VisNavPowerMode;

// Dyson robot vacuum cleaning type
export enum Dyson360CleaningType {
    Unknown                         = '',
    Immediate                       = 'immediate',
    Manual                          = 'manual',
    Scheduled                       = 'scheduled'
}

// Dyson robot vacuum cleaning mode (Heurist and Vis Nav only)
export enum Dyson360CleaningMode {
    Global                          = 'global',
    ZoneConfigured                  = 'zoneConfigured'
}

// Dyson robot vacuum cleaning strategy
export enum Dyson360CleaningStrategy {
    Auto                            = 'auto',
    Mixed                           = 'mixed'
}

// Dyson robot vacuum position
export type Dyson360Position = [number, number];

// Map data (after base64 and gzip decoding)
export type Dyson360MapBitmap = number[][];
export type Dyson360MapPath = [number, number, number];
export interface Dyson360MapData {
    cleaned:                        Dyson360MapBitmap;  // 0 = not cleaned, 1 = cleaned
    observed:                       Dyson360MapBitmap;  // 0 = not observed, 1 = observed
    occupied:                       Dyson360MapBitmap;  // 0 = free, 1 = occupied
    unnavigable:                    Dyson360MapBitmap;  // 0 = free, 1-101 = dilated obstacle mask
    path:                           Dyson360MapPath[];
}

// Dyson robot vacuum initial setup state
export enum Dyson360OutOfBoxState {
    Complete                        = 'OUT_OF_BOX_COMPLETE'
}