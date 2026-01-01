// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

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
    description:                    string;         // e.g. '23.0.3',
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

// Details of an active fault (360 Vis Nav only)
export enum Dyson360FaultNextAction {
    WaitToClean                     = 'WAIT_TO_CLEAR',
    LocalUserAck                    = 'LOCAL_USER_ACK',
    LocalUserContinue               = 'LOCAL_USER_CONTINUE',
    LogOnly                         = 'LOG_ONLY'
}
export enum Dyson360FaultPresent {
    Present                         = 'PRESENT',
    NotPresent                      = 'NOT_PRESENT'
}
export enum Dyson360FaultUserAction {
    NoAction                        = 'NO_ACTION',
    UserRecoverable                 = 'USER_RECOVERABLE'
}
export interface Dyson360ActiveFault {
    faultCode:                      string;         // e.g. '23.0.3',
    nextActionRequired:             Dyson360FaultNextAction;
    present:                        Dyson360FaultPresent;
    requiredUserAction:             Dyson360FaultUserAction;
}

// Dyson robot vacuum power mode
export enum Dyson360EyeEventPowerMode {
    Quiet                           = 1,
    Max                             = 0
}
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
    Idle                            = '0',
    Quiet                           = '1',          // Auto (low) / Quiet / Quick
    High                            = '2',          // Auto (high)
    Boost                           = '3'           // Boost
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
    Scheduled                       = 'scheduled',
    Mapping                         = 'mapping'
}

// Dyson robot vacuum cleaning mode (360 Heurist and 360 Vis Nav only)
export enum Dyson360CleaningMode {
    Global                          = 'global',
    ZoneConfigured                  = 'zoneConfigured'
}

// Dyson robot vacuum cleaning programme (360 Heurist and 360 Vis Nav only)
export interface Dyson360CleaningProgramme {
    orderedZones?:                  string[];
    persistentMapId:                string;         // UUID
    unorderedZones?:                string[];       // e.g. ['4','1','2','3']
    zonesDefinitionLastUpdatedDate: string | null;  // e.g. '2025-12-17T10:53:21.8147587Z'
}

// Dyson robot vacuum zone status (360 Heurist and 360 Vis Nav only)
export enum Dyson360ZoneCleanStatus {
    NotRequested                    = 'CLEAN_NOT_REQUESTED',
    Unable                          = 'CANT_CLEAN',
    Pending                         = 'CLEAN_PENDING',
    InProgress                      = 'CLEAN_IN_PROGRESS',
    Complete                        = 'CLEAN_COMPLETE'
}
export interface Dyson360ZoneStatus {
    cleanStatus:                    Dyson360ZoneCleanStatus;
    zoneId:                         string;         // e.g. '1'
}

// Dyson robot vacuum cleaning strategy
export enum Dyson360CleaningStrategy {
    Auto                            = 'auto',
    Quick                           = 'quick',
    Quiet                           = 'quiet',
    Boost                           = 'boost',
    Mixed                           = 'mixed'       // (360 Heurist only)
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
    AwaitingMapping                 = 'AWAITING_SUCCESSFUL_MAPPING',
    AwaitingMapUploadingCompletion  = 'AWAITING_MAP_UPLOADING_COMPLETION',
    AwaitingZoningCompletion        = 'AWAITING_ZONING_COMPLETION',
    Complete                        = 'OUT_OF_BOX_COMPLETE'
}

// Dyson robot vacuum zone icon (360 Vis Nav only)
export enum Dyson360ZoneIcon {
    Balcony                         = 'balcony',
    Bathroom                        = 'bathroom',
    Bedroom                         = 'bedroom',        // Secondary bedroom / Guest room
    DiningRoom                      = 'dining_room',
    Hallway                         = 'hallway',
    Kitchen                         = 'kitchen',
    LivingRoom                      = 'living_room',
    MainBedroom                     = 'main_bedroom',   // Main bedroom
    Study                           = 'study',
    Toilet                          = 'toilet',
    UtilityRoom                     = 'utility_room',
    Work                            = 'work',           // Office
    Custom                          = 'custom'          // User defined
}

// Dyson robot vacuum clean map timeline event
export enum Dyson360TimelineEvent {
    Charging                        = 'CHARGING',
    CleanEnded                      = 'CLEAN_ENDED',
    CleanStarted                    = 'CLEAN_STARTED',
    FaultUserRecoverable            = 'FAULT_USER_RECOVERABLE',
    NeedsCharge                     = 'NEEDS_CHARGE',
    Paused                          = 'PAUSED',
    PersistentMapChanged            = 'PERSISTENT_MAP_CHANGED',
    Resumed                         = 'RESUMED',
    RunEnded                        = 'RUN_ENDED',
    RunStarted                      = 'RUN_STARTED',
    TraverseEnded                   = 'TRAVERSE_ENDED',
    TraverseStarted                 = 'TRAVERSE_STARTED',
    ZoneEntered                     = 'ZONE_ENTERED',
    ZoneLeft                        = 'ZONE_LEFT'
}

// Dyson robot vacuum dust category
export enum Dyson360DustName {
    ExtraFine                       = 'extraFine',
    Fine                            = 'fine',
    Medium                          = 'medium',
    Large                           = 'large',
    Other                           = 'other',
    Total                           = 'total'
}