// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { Dyson360ZoneType } from './dyson-360-types.js';

// Dyson robot vacuum JDM expected protocol version(s)
export type Dyson360JdmVersion                  = '1.0.1';
export const JDM_VERSION: Dyson360JdmVersion    = '1.0.1';

// Dyson robot vacuum JDM messages require a method for validation
export interface Dyson360JdmMsgBase {
    msgId:                          string;     // 32-bit integer as string
    method?:                        string;
}

// Dyson robot vacuum JDM empty params or data
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Dyson360JdmEmptyObject {}

// Dyson robot vacuum JDM multi-part request/response?
export type Dyson360JdmPackage      = [1, 1];

// Dyson robot vacuum JDM response result code
export enum Dyson360JdmResponseCode {
    Success                         = 0,
    Failure                         = 1
}

// Dyson robot vacuum JDM response service result code
export enum Dyson360JdmResponseResult {
    Unknown                         = -1,
    Success                         = 0,
    Failure                         = 1
}

// Dyson robot vacuum JDM boolean
export enum Dyson360JdmBoolean {
    False                           = 0,
    True                            = 1
}

// Dyson robot vacuum JDM trigger for deep cleaning of mop roller
export enum Dyson360JdmBackWashType {
    Time                            = 0,
    Room                            = 1,
    AfterClean                      = 2
}

// Dyson robot vacuum JDM end of clean task status
export enum Dyson360JdmTaskStatus {
    Finished                        = 1,
    StoppedByUser                   = 2,
    Abandoned                       = 4
}

// Dyson robot vacuum JDM end of clean task mode
export enum Dyson360JdmCleanMode {
    ZoneConfigured                  = 0,
    NotZoneConfigured               = 4     // (includes spotZone and mapping)
}

// Dyson robot vacuum JDM dust emptying action
export enum Dyson360JdmDustAction {
    Idle                            = 0,
    CollectDust1                    = 1,
    CollectDust2                    = 2
}

// Dyson robot vacuum JDM whole floor or per-zone preferences active
export enum Dyson360JdmPreferMode {
    Standard                        = 0,    // Standard whole-floor clean
    Custom                          = 1     // Custom per-zone preferences
}

// Dyson robot vacuum JDM language (REST API uses locale code)
export enum Dyson360JdmLanguage {
    ChineseSimplified               = 0,    // zh-CN
    ChineseSimplifiedAlternate      = 1,    // zh-CN / zh-SG
    EnglishAmerican                 = 2,    // en-US
    Spanish                         = 3,    // es-ES / es-US
    German                          = 4,    // de-DE
    French                          = 5,    // fr-FR
    Polish                          = 6,    // pl-PL
    Italian                         = 7,    // it-IT
    Russian                         = 8,    // ru-RU
    ChineseTraditionalHongKong      = 9,    // zh-HK
    Thai                            = 10,   // th-TH
    Korean                          = 11,   // ko-KR
    EnglishBritish                  = 12,   // en-GB
    Portuguese                      = 13,   // pt-PT / pt-BR
    ChineseTraditionalTaiwan        = 14,   // zh-TW
    FrenchCanadian                  = 36    // fr-CA
}

// Dyson robot vacuum JDM initial setup state
export enum Dyson360JdmOutOfBoxState {
    // Unknown                         = ?,
    // CheckingEnablementOfOOBBlocking = ?,
    // AwaitingSuccessfulMapping       = ?,
    // AwaitingMapUploadingCompletion  = ?,
    // AwaitingZoningCompletion        = ?,
    OutOfBoxComplete                = 1
}

// Dyson robot vacuum JDM dock state
export enum Dyson360JdmDockState {
    Idle                            = 0,
    WashingMop                      = 1,
    DryingMop                       = 2,
    CollectingDust                  = 5
}

// Dyson robot vacuum JDM schedules on active map
export interface Dyson360JdmOrderTotal {
    total:                          number; // Total number of schedules
    enable:                         number; // Number of enabled schedules
}

// Dyson robot vacuum JDM fine-grained work mode (no REST API equivalent)
export type Dyson360JdmWorkMode = number;   // (range is at least 1...85)

// Dyson robot vacuum JDM countdown of dock actions (no REST API equivalent)
export enum Dyson360JdmWorkTimeType {
    // CollectingDust                  = ?,
    // Idle                            = ?,
    // WashingMop                      = ?,
    DryingMop                       = 3
}
export interface Dyson360JdmWorkTime {
    type:           Dyson360JdmWorkTimeType;
    total:          number;                 // seconds
    surplus:        number;                 // Remaining seconds
}

// Dyson robot vacuum JDM consumable identifier
export enum Dyson360JdmConsumable {
    BrushBar                        = 1,    // prop main_brush
    SideBrushes                     = 2,    // prop side_brush
    RobotFilter                     = 3,    // prop hypa
    MopRoller                       = 4     // prop mop_life
    // CleaningSolution                = ?
    // DockFilter                      = ?,    // prop dock_hypa
    // IoniserCartridge                = ?,    // prop ioniser
    // MopPad                          = ?,    // prop mop_life
}

// Dyson robot vacuum JDM action during a clean (no REST API equivalent)
export enum Dyson360JdmSweepType {
    // (values based on Xiaomi robots)
    Global                          = 0,
    Mop                             = 1,
    Edge                            = 2,
    Area                            = 3,
    Point                           = 4,
    RemoteControl                   = 5,
    Explore                         = 6,
    Room                            = 7,
    Floor                           = 8
}

// Dyson robot vacuum JDM status
export enum Dyson360JdmStatusValue {
    Unknown1                        = 1,
    Paused                          = 2,
    ReturningToDock                 = 3,
    Charging                        = 4,
    Unknown5                        = 5,
    Unknown6                        = 6,
    WashingFinished                 = 7,
    WashingOnDock                   = 9,
    DryingOnDock                    = 10,
    Unknown11                       = 11,
    Unknown12                       = 12
}

// Dyson robot vacuum JDM clean type
export enum Dyson360JdmCleanType {
    Vacuum                          = 0,
    VacuumAndMop                    = 1,
    Mop                             = 2,
    VacuumThenMop                   = 3     // (not available via REST API)
}

// Dyson robot vacuum JDM cleaning strategy
export enum Dyson360JdmVacuumMode {
    Auto                            = 0,
    Boost                           = 1,
    Quiet                           = 2,
    Quick                           = 3
}

// Dyson robot vacuum JDM start or pause cleaning
export enum Dyson360JdmRoomCleanCtrl {
    Stop                            = 0,
    Start                           = 1,    // (also used for Resume)
    Pause                           = 2
}

// Dyson robot vacuum JDM dock action control
export enum Dyson360JdmDockActionCtrl {
    Stop                            = 0,
    Start                           = 1
}
export enum Dyson360JdmDockAction {
    WashMop                         = 1,
    DryMop                          = 2,
    CollectDust                     = 3,
}

// Dyson robot vacuum JDM water level
export enum Dyson360JdmWaterLevel {
    Low                             = 0,
    Medium                          = 1,
    High                            = 2,
    VeryLow                         = 99
}

// Dyson robot vacuum JDM vacuum and mop repetitions
export enum Dyson360JdmVacuumPasses {
    One                             = 0,    // (1 via REST API)
    Two                             = 1     // (2 via REST API)
}
export enum Dyson360JdmMopPasses {
    One                             = 0,    // (1 via REST API)
    Two                             = 1     // (2 via REST API)
}

// Dyson robot vacuum JDM map type
export enum Dyson360JdmMapType {
    Type0                           = 0,
    Type3                           = 3,
}

// Dyson robot vacuum JDM map change result
export enum Dyson360JdmMapChangeResult {
    Modified                        = 3,
    SplitRefused                    = 4,    // Zone too small
    MergeRefused                    = 6     // Zones not adjacent
}

// Dyson robot vacuum JDM detected material type
export enum Dyson360JdmMaterialType {
    Unknown                         = 0,
    SmoothFloor                     = 1,
    Tile                            = 2,
    Wood                            = 3,
    Carpet                          = 10
}

// Dyson robot vacuum JDM map identifiers
export interface Dyson360JdmMapListItem {
    cur:            boolean;                // = isCurrentMap (true|false, not 0|1)
    id:             number;                 // = id
    name:           string;                 // = name
}

// Result of modifying a map
export interface Dyson360JdmMapChange {
    map_id:         number;
    map_type:       Dyson360JdmRestrictionBehaviour | 0;
    timestamp:      number;                 // Seconds since epoch
    package?:       Dyson360JdmPackage;     // (service.adjust_furniture only)
}

// Dyson robot vacuum JDM split line
export type Dyson360JdmSplitLine = [
    number, number,                         // (x[0], y[0])
    number, number                          // (x[1], y[1])
];

// Dyson robot vacuum JDM spot zone rectangle corners
export type Dyson360JdmSpotZonePoints = [
    // Corners, clockwise or anticlockwise
    number, number,                         // (x[0], y[0])
    number, number,                         // (x[1], y[1])
    number, number,                         // (x[2], y[2])
    number, number                          // (x[3], y[3])
];

// Dyson robot vacuum JDM room UV scan
export type Dyson360JdmUvSwitch = [
    number,                                 // = zones[].id
    Dyson360JdmBoolean                      // = isUvScanOn (presumably)
];

// Dyson robot vacuum JDM room preference (11 elements for set, 12 returned)
export interface Dyson360JdmRoomWithType {
    name:           string;                 // = zones[].name
    type:           Dyson360ZoneType;       // = zones[].type
}
export type Dyson360JdmRoomPreference = [
    number,                                 // = zones[].id
    string,                                 // = zones[].name or JSON encoded Dyson360JdmRoomWithType
    Dyson360JdmMaterialType,                // AI detected floor type (not available via REST API)
    Dyson360JdmCleanType,                   // = cleanType
    Dyson360JdmVacuumMode,                  // = vacuumPowerMode
    Dyson360JdmWaterLevel,                  // = waterLevel
    Dyson360JdmMopPasses,                   // = mopPasses-1 (0 = one pass, 1 = two passes)
    0,                                      // Carpet flag?
    Dyson360JdmBoolean,                     // = zones[].isSelected
    0,                                      // ?
    number,                                 // = zones[].order
    0                                       // Carpet avoidance?
];
export type Dyson360JdmRoomPreferenceSet = [
    number,                                 // = zones[].id
    string,                                 // = zones[].name; replace any JSON on writes
    0,                                      // Set to 0 on writes (returns zones[].type)
    Dyson360JdmCleanType,                   // = cleanType
    Dyson360JdmVacuumMode,                  // = vacuumPowerMode
    Dyson360JdmWaterLevel,                  // = waterLevel
    Dyson360JdmMopPasses,                   // = mopPasses-1 (0 = one pass, 1 = two passes)
    0,                                      // Carpet flag?
    Dyson360JdmBoolean,                     // = zones[].isSelected
    0,                                      // ?
    number                                  // = zones[].order
    // (index 11 omitted from writes)
];

// Dyson robot vacuum JDM restriction
export enum Dyson360JdmRestrictionBehaviour {
    KeepOut                             = 2,
    NoMop                               = 6,
    BrushBarOff                         = 12,
    ClimbObstacle                       = 13
    // NoClimb                             = ?
}
export type Dyson360JdmRestriction = [
    number,                                 // = restrictions[].id
    Dyson360JdmRestrictionBehaviour,        // = restrictions[].type
    // = restrictions[].points (corners, clockwise or anticlockwise)
    number, number,                         // (x[0], y[0])
    number, number,                         // (x[1], y[1])
    number, number,                         // (x[2], y[2])
    number, number                          // (x[3], y[3])
];

// Dyson robot vacuum JDM furniture
export enum Dyson360JdmFurnitureType {
    DiningTable                         =  1511,
    TwoSeaterSofa                       =  1512,
    DoubleBed                           =  1513,
    ToiletBowl                          =  1514,
    Cabinet                             =  1515,
    Refrigerator                        =  1516,
    SmallTableRectangular               =  1518,
    Nightstand                          =  1519,
    TvCabinet                           =  1520,
    WashingMachine                      =  1524,
    ThreeSeaterSofa                     =  1525,
    LShapeSofaLeft                      =  1526,
    LShapeSofaRight                     =  1527,
    OneSeaterSofa                       =  1528,
    SingleBed                           =  1601,
    SmallTableRound                     =  1602,
    Desk                                =  1603,
    StorageCabinet                      =  1604,
    ShoeCabinet                         =  1605,
    Closet                              =  1606,
    Bookshelf                           =  1607,
    Stove                               =  1608,
    Plant                               =  1613,
    FloorMirror                         =  1614,
}
export type Dyson360JdmFurniture = [
    number,                                 // = furniture[].id
    Dyson360JdmFurnitureType,               // = furniture[].type
    Dyson360JdmBoolean,                     // ?
    // = furniture[].points (corners, clockwise or anticlockwise)
    number, number,                         // (x[0], y[0])
    number, number,                         // (x[1], y[1])
    number, number,                         // (x[2], y[2])
    number, number                          // (x[3], y[3])
];

// Dyson robot vacuum JDM privacy policy
export interface Dyson360JdmPrivacy {
    auto_upgrade:                       Dyson360JdmBoolean;
}