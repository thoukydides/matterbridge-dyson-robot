// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

// Air treatment reset source
export enum DysonAirResetSource {
    PowerUp                 = 'PWUP',
    Hibernate               = 'HIB'
}

// Dyson air treatment error and warning codes
export enum DysonAirErrorCodeEnum {
    None                    = 'NONE',
    Unknown02C0             = '02C0',
    Unknown02C9             = '02C9',
    OscillationDisabled     = '11E1',
    Unknown57C2             = '57C2',
}
export type DysonAirErrorCode = DysonAirErrorCodeEnum | string;
export enum DysonAirWarningCodeEnum {
    None                    = 'NONE'
}
export type DysonAirWarningCode = DysonAirWarningCodeEnum | string;

// Dyson air treatment faults
export enum DysonAirFaultStatus {
    OK                      = 'OK',
    Fail                    = 'FAIL'
}
export type DysonAirFaultChange = [DysonAirFaultStatus, DysonAirFaultStatus]
export enum DysonAirProductError {
    AMF1                    = 'amf1',  // Air multiplier fault
    AMF2                    = 'amf2',  // Air multiplier fault
    AMF3                    = 'amf3',  // Air multiplier fault
    AMF4                    = 'amf4',  // Air multiplier fault
    AMF5                    = 'amf5',  // Air multiplier fault
    AMF6                    = 'amf6',  // Air multiplier fault
    AMF7                    = 'amf7',  // Air multiplier fault
    AMF8                    = 'amf8',  // Air multiplier fault
    AMF9                    = 'amf9',  // Air multiplier fault
    BOSL                    = 'bosl',  // Oscillation boundary sensor left
    BOSR                    = 'bosr',  // Oscillation boundary sensor right
    CNFG                    = 'cnfg',  // Configuration error
    COM1                    = 'com1',  // Internal communications error
    COM2                    = 'com2',  // Internal communications error
    COM4                    = 'com4',  // Internal communications error
    COM5                    = 'com5',  // Internal communications error
    COM9                    = 'com9',  // Internal communications error
    COMA                    = 'coma',  // Internal communications error
    DSTS                    = 'dsts',  // Dust (particle) sensor error
    ETWS                    = 'etws',  // External temperature error
    FMCO                    = 'fmco',  // Fan motor communications error
    FS01                    = 'fs01',  // Fan subsystem fault
    FS02                    = 'fs02',  // Fan subsystem fault
    FS03                    = 'fs03',  // Fan subsystem fault
    FS04                    = 'fs04',  // Fan subsystem fault
    FS05                    = 'fs05',  // Fan subsystem fault
    FS06                    = 'fs06',  // Fan subsystem fault
    FS07                    = 'fs07',  // Fan subsystem fault
    FS08                    = 'fs08',  // Fan subsystem fault
    FS09                    = 'fs09',  // Fan subsystem fault
    FS0A                    = 'fs0a',  // Fan subsystem fault
    FS0B                    = 'fs0b',  // Fan subsystem fault
    FS0C                    = 'fs0c',  // Fan subsystem fault
    HALL                    = 'hall',  // Hall sensor fault
    HAMB                    = 'hamb',  // Humidity sensor error
    HAMP                    = 'hamp',  // Humidity sensor error
    HILC                    = 'hilc',  // Heater error
    HIOC                    = 'hioc',  // Heater error
    HTCF                    = 'htcf',  // Heater error
    HTRI                    = 'htri',  // Heater error
    HVMI                    = 'hvmi',  // Heater error
    IBUS                    = 'ibus',  // Internal bus fault
    ILSS                    = 'ilss',  // Light (illuminance) sensor
    IUA1                    = 'iua1',  // Input unit?
    IUA2                    = 'iua2',  // Input unit?
    IUA4                    = 'iua4',  // Input unit?
    IUC1                    = 'iuc1',  // Input unit?
    IUC2                    = 'iuc2',  // Input unit?
    IUC4                    = 'iuc4',  // Input unit?
    IUH0                    = 'iuh0',  // Input unit?
    IUH1                    = 'iuh1',  // Input unit?
    IUH2                    = 'iuh2',  // Input unit?
    IUH4                    = 'iuh4',  // Input unit?
    IUP0                    = 'iup0',  // Input unit?
    IUU1                    = 'iuu1',  // Input unit?
    IUU2                    = 'iuu2',  // Input unit?
    IUU4                    = 'iuu4',  // Input unit?
    IUW0                    = 'iuw0',  // Input unit?
    IUW1                    = 'iuw1',  // Input unit?
    IUW2                    = 'iuw2',  // Input unit?
    IUW4                    = 'iuw4',  // Input unit?
    NVMR                    = 'nvmr',  // Non-volatile memory read error
    NVMW                    = 'nvmw',  // Non-volatile memory write error
    POVI                    = 'povi',  // ?
    PROT                    = 'prot',  // Protection mode (deep clean cycle overdue)
    PSU1                    = 'psu1',  // Power supply unit fault
    PSU2                    = 'psu2',  // Power supply unit fault
    SEN1                    = 'sen1',  // Sensor error
    SEN2                    = 'sen2',  // Sensor error
    SEN3                    = 'sen3',  // Sensor error
    SEN4                    = 'sen4',  // Sensor error
    SHRT                    = 'shrt',  // Short circuit detected
    STAL                    = 'stal',  // Stalled motor
    STTO                    = 'stto',  // Set temperature timeout
    TAHS                    = 't&hs',  // Temperature and humidity sensor fault
    TILT                    = 'tilt',  // Tilt sensor error
    UI01                    = 'ui01',  // User interface module fault
    UI02                    = 'ui02',  // User interface module fault
    UI03                    = 'ui03',  // User interface module fault
    UID1                    = 'uid1',  // User interface module fault
    UID2                    = 'uid2',  // User interface module fault
    ULED                    = 'uled',  // LED failure
    VOCS                    = 'vocs',  // Volatile organic compounds sensor fault
    WDOG                    = 'wdog',  // Watchdog timer
    WFCP                    = 'wfcp',  // Wi-Fi communications protocol fault
    WFHB                    = 'wfhb',  // Wi-Fi heartbeat lost
    WPMP                    = 'wpmp'   // Water pump fault
}
export enum DysonAirProductWarning {
    FLTR                    = 'fltr',  // Filter replacement warning
    tnke                    = 'tnke',  // Tank empty
    tnkp                    = 'tnkp',  // Tank removed
    cldu                    = 'cldu',  // Clean due
    etwd                    = 'etwd'   // Environmental temperature warning
}
export enum DysonAirModuleError {
    LSPD                    = 'lspd',
    SZAV                    = 'szav',
    SZBV                    = 'szbv',
    SZED                    = 'szed',
    SZHV                    = 'szhv',
    SZME                    = 'szme',
    SZMW                    = 'szmw',
    SZPE                    = 'szpe',
    SZPI                    = 'szpi',
    SZPP                    = 'szpp',
    SZPS                    = 'szps',
    SZPW                    = 'szpw'
}
export enum DysonAirModuleWarning {
    NWCS                    = 'nwcs',
    NWDS                    = 'nwds',
    NWPS                    = 'nwps',
    NWSS                    = 'nwss',
    NWTS                    = 'nwts',
    SRMI                    = 'srmi',
    SRMU                    = 'srmu',
    SRNK                    = 'srnk',
    STAC                    = 'stac',
    STRS                    = 'strs'
}

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
    Degrees45               = '0045',
    Degrees90               = '0090',
    Degrees180              = '0180',
    Breeze                  = 'BRZE',
    Custom                  = 'CUST'
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
    srsc:                   string;     // Schedule checksum, e.g. 'f27f'
    tzid:                   string;     // Timezone identifier, e.g. '0001'
}
export enum DysonAirDaylightSaving {
    Disabled                = '0000',
    Enabled                 = '0001'
}

// Dyson air treatment HEPA filter
export enum DysonAirHEPAFilterType {
    Combination             = 'GCOM',
    OnlyHEPA                = 'GHEP'
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
    SelectiveCatalytic      = 'SCOG'
}
export enum DysonAirCarbonFilterEnum {
    Invalid                 = 'INV'
}
export type DysonAirCarbonFilterLife = DysonAirCarbonFilterEnum | string;

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