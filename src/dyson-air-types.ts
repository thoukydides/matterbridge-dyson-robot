// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

// Dyson air treatment goodbye reason
export enum DysonAirGoodbyeReason {
    SwitchToAP              = 'SWITCH_TO_AP',
    Unknown                 = 'UNKNOWN'
}

// Dyson air treatment reset source
export enum DysonAirResetSource {
    ConnectionJourney       = 'CONJRNY',
    PowerUp                 = 'PWUP',
    Hibernate               = 'HIB'
}

// Dyson air treatment call to action type
export enum DysonAirCTAType {
    None                        = '',
    ContactUs                   = 'contact_Us',
    FeatureActivateCM           = 'feature_activate_CM',
    FilterManagement            = 'filter_management',
    HeatingDisabled             = 'heating_disabled',
    InitialisingSensors         = 'initialising_sensors',
    FirmwareUpdateAvailable     = 'ota_available',
    FirmwareUpdateInProgress    = 'ota_inprogress'
}

// Dyson air treatment error and warning codes
export enum DysonAirErrorCodeEnum {
    None                    = 'NONE',
    Unknown02C0             = '02C0',
    AirQualitySensorFault   = '02C3',
    Unknown02C9             = '02C9',
    OscillationDisabled     = '11E1',
    Unknown12D2             = '12D2',
    Unknown12E1             = '12E1',
    Unknown14II             = '14II',
    Unknown26U1             = '26U1',
    Unknown31U2             = '31U2',
    Unknown34U5             = '34U5',
    Unknown51C2             = '51C2',
    Unknown57C2             = '57C2',
    Unknown62R6             = '62R6'
}
export type DysonAirErrorCode = DysonAirErrorCodeEnum | string;
export enum DysonAirWarningCodeEnum {
    None                    = 'NONE',
    UnknownFLTR             = 'FLTR'
}
export type DysonAirWarningCode = DysonAirWarningCodeEnum | string;

// Dyson air treatment faults
export enum DysonAirFaultStatus {
    OK                      = 'OK',
    Fail                    = 'FAIL'
}
export type DysonAirFaultsChange            = [DysonAirFaultStatus, DysonAirFaultStatus]
export interface DysonAirFaultsList         { [fault: string]: DysonAirFaultStatus; }
export interface DysonAirFaultsChangeList   { [fault: string]: DysonAirFaultsChange; }

// Dyson air treatment power
export enum DysonAirFanPower {
    Off                     = 'OFF',
    On                      = 'ON'
}

// Dyson air treatment fan
export enum DysonAirFanAutoPower {
    Off                     = 'OFF',
    Manual                  = 'FAN',
    Auto                    = 'AUTO'
}
export enum DysonAirAutoMode {
    Manual                  = 'OFF',
    Auto                    = 'ON'
}
export enum DysonAirFanSpeed {
    Auto                    = 'AUTO',
    Speed1                  = '0001',
    Speed2                  = '0002',
    Speed3                  = '0003',
    Speed4                  = '0004',
    Speed5                  = '0005',
    Speed6                  = '0006',
    Speed7                  = '0007',
    Speed8                  = '0008',
    Speed9                  = '0009',
    Speed10                 = '0010'
}
export enum DysonAirFanState {
    Stopped                 = 'OFF',
    Running                 = 'FAN'
}
export enum DysonAirFanDirection {
    Backward                = 'OFF',
    Forward                 = 'ON'
}

// Dyson air treatment heating
export enum DysonAirHeatingMode {
    Cool                    = 'OFF',
    Heat                    = 'HEAT'
}
export enum DysonAirHeatingStatus {
    NotHeating              = 'OFF',
    Heating                 = 'HEAT'
}
export enum DysonAirFanFocus {
    Diffuse                 = 'OFF',
    Focused                 = 'ON'
}

// Dyson air treatment side-to-side oscillation
export enum DysonAirOscillation {
    Fixed                   = 'OFF',
    FixedOI                 = 'OIOF',
    Oscillating             = 'ON',
    OscillatingOI           = 'OION'
}
export enum DysonAirOscillationStatus {
    Fixed                   = 'OFF',
    Oscillating             = 'ON',
    Idle                    = 'IDLE'
}
export enum DysonAirAnemometerControlProfile {
    Degrees10               = '0010',
    Degrees40               = '0040',
    Degrees45               = '0045',
    Degrees70               = '0070',
    Degrees90               = '0090',
    Degrees180              = '0180',
    Degrees350              = '0350',
    Breeze                  = 'BRZE',
    Custom                  = 'CUST',
    FindFollow              = 'SMRT'
}

// Dyson air treatment tilt oscillation
export enum DysonAirTiltOscillation {
    Fixed                   = 'OFF',
    Oscillating             = 'ON',
}
export enum DysonAirTiltOscillationStatus {
    Fixed                   = 'OFF',
    Oscillating             = 'ON'
}
export enum DysonAirTiltAngle {
    Degrees0                = '0000',
    Degrees25               = '0025',
    Degrees50               = '0050',
    Breeze                  = '0359'
}
export enum DysonAirAnemometerControlTilt {
    Breeze                  = 'BRZE',
    Custom                  = 'CUST'
}

// Dyson air treatment Find+Follow
export enum DysonAirFindFollowMode {
    Disabled                = 'OFF',
    Enabled                 = 'ON',
    ManualScan              = 'SCAN'
}
export enum DysonAirFindFollowState {
    Off                     = 'OFF',
    Scanning                = 'SCAN',
    Sleeping                = 'NOD'
}

// Dyson air treatment humidifier
export enum DysonAirHumidification {
    Disabled                = 'OFF',
    Enabled                 = 'HUMD'
}
export enum DysonAirHumidificationAutoMode {
    Manual                  = 'OFF',
    Auto                    = 'ON'
}
export enum DysonAirHumidificationState {
    Idle                    = 'OFF',
    Humidifying             = 'HUMD'
}
export enum DysonAirHumidificationProcess {
    Off                     = 'OFF',
    Initialising            = 'INIT',
    Cleaning                = 'CLNG',
    Inactive                = 'INV'
};
export enum DysonAirWaterHardness { // (deep clean cycle interval)
    Soft                    = '2025',
    Medium                  = '1350',
    Hard                    = '0675'
}
export enum DysonAirDeepCleanCycle {
    Inactive                = 'CLNO',
    CleanSupplies           = 'CLSE',
    CleanActive             = 'CLAC',
    CleanTank               = 'CLCM'
}

// Dyson air treatment night mode
export enum DysonAirNightMode {
    Day                     = 'OFF',
    Night                   = 'ON'
}

// Dyson air sleep timer mode
export enum DysonAirSleepTimerMode {
    Disabled                = 'OFF',
    Enabled                 = 'ON'
}

// Dyson air treatment air quality target
export enum DysonAirQualityTarget {
    Off                     = 'OFF',
    VerySensitive           = '0001',   // I'm very sensitive to particles and pollutants
    Default                 = '0002',
    Sensitive               = '0003',   // I'm sensitive to particles and pollutants
    Good                    = '0004'    // I just want to maintain good air quality
}

// Dyson air treatment continuous monitoring
export enum DysonAirContinuousMonitoring {
    NotMonitoring           = 'OFF',
    Monitoring              = 'ON'
}

// Dyson air treatment tilt sensor
export enum DysonAirTiltSensor {
    NotTilted               = 'OK',
    Tilted                  = 'TILT'
}

// Dyson air treatment temperature units
export enum DysonAirTemperatureUnits {
    Fahrenheit              = 'OFF',
    Celsius                 = 'ON'
}

// Dyson air treatment scheduler state
export interface DysonAirScheduler {
    dstv:                   DysonAirDaylightSaving;
    srsc:                   string;     // Schedule checksum, e.g. 'f27f' or '0000000000000000'
    tzid:                   string;     // Timezone identifier, e.g. '0001'
}
export enum DysonAirDaylightSaving {
    Disabled                = '0000',
    Enabled                 = '0001'
}

// Dyson air treatment HEPA filter
export enum DysonAirHEPAFilterType {
    GCOK                    = 'GCOK',
    GCOM                    = 'GCOM',
    GHEP                    = 'GHEP',
    PHEP                    = 'PHEP',
}
export enum DysonAirResetFilterLife {
    Reset                   = 'RSTF'
}
export enum DysonAirResetHEPAFilterLife {
    Reset                   = 'RHTF'
}

// Dyson air treatment carbon filter
export enum DysonAirCarbonFilterType {
    None                    = 'NONE',
    Carbon                  = 'CARF',
    SelectiveCatalyticF     = 'SCOF',
    SelectiveCatalyticG     = 'SCOG',
    SelectiveCatalyticH     = 'SCOH'
}
export enum DysonAirCarbonFilterEnum {
    Invalid                 = 'INV'
}
export type DysonAirCarbonFilterLife = DysonAirCarbonFilterEnum | string;

// Dyson air treatment selective catalytic oxidisation filter
export enum DysonAirSelectiveCatalyticOxidisationFilterType {
    SelectiveCatalyticH     = 'SCOH'
}

// Dyson air treatment display brightness
export enum DysonAirBrightness {
    Low                     = '0001',
    Medium                  = '0002',
    High                    = '0003'
}

// Dyson air treatment sleep timer
export enum DysonAirSleepTimerEnum {
    Disabled                = 'OFF'
}
export type DysonAirSleepTimer = DysonAirSleepTimerEnum | string;

// Dyson air treatment sensor data (four digit decimal values)
export enum DysonAirSensorValueEnum {
    Off                     = 'OFF',
    Initialising            = 'INIT',
    Failed                  = 'FAIL',
    Unavailable             = 'NONE'
}
export type DysonAirSensorValue = DysonAirSensorValueEnum | string;