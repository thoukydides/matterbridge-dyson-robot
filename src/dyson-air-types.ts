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

// Dyson air treatment fault severity
export enum DysonAirFaultSeverity {
    Info                    = 'info',
    Warning                 = 'warning',
    Critical                = 'critical',
    Success                 = 'success'
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
export enum DysonAirProductFault {
    // GET /v1/support/product-faults/{serial}?locale=en-GB&market=GB&faultCode={code}
    AMF1                    = 'amf1',   // Motor fault
    AMF2                    = 'amf2',   // Motor fault
    AMF3                    = 'amf3',   // Motor fault
    AMF4                    = 'amf4',   // Motor fault
    AMF5                    = 'amf5',   // Motor fault
    AMF6                    = 'amf6',   // Motor fault
    AMF7                    = 'amf7',   // Motor fault
    AMF8                    = 'amf8',   // Motor fault
    AMF9                    = 'amf9',   // Fault detected
    CFLR                    = 'cflr',   // 0% filter life remaining
    CLDU                    = 'cldu',   // Deep clean cycle due
    CNFG                    = 'cnfg',   // Fault detected
    COM1                    = 'com1',   // Motor fault
    COM2                    = 'com2',   // Fault detected
    COM3                    = 'com3',   // Fault detected
    COM4                    = 'com4',   // Motor fault
    COM6                    = 'com6',   // Fault detected
    COM7                    = 'com7',   // Fault detected
    COM8                    = 'com8',   // Fault detected
    DSTS                    = 'dsts',   // Particle sensor fault
    ETWD                    = 'etwd',   // Drip tray overflow
    ETWS                    = 'etws',   // Drip tray overflow while in deep clean
    FILF                    = 'filf',   // 0% filter life remaining
    FMCO                    = 'fmco',   // Motor fault
    FS00                    = 'fs00',   // Fault detected
    FS01                    = 'fs01',   // Fault detected
    HALL                    = 'hall',   // Motor fault
    HAMB                    = 'hamb',   // Heater fault
    HAMP                    = 'hamp',   // Motor fault
    HCTF                    = 'hctf',   // Heater fault
    HFLR                    = 'hflr',   // 0% filter life remaining
    HILC                    = 'hilc',   // Heater fault
    HIOC                    = 'hioc',   // Heater fault
    HT01                    = 'ht01',   // Heater fault
    HT02                    = 'ht02',   // Heater fault
    HT03                    = 'ht03',   // Heater fault
    HT04                    = 'ht04',   // Heater fault
    HT05                    = 'ht05',   // Heater fault
    HT06                    = 'ht06',   // Heater fault
    HT07                    = 'ht07',   // Heater fault
    HT08                    = 'ht08',   // Fault detected
    HT09                    = 'ht09',   // Heater fault
    HT0A                    = 'ht0a',   // Heater fault
    HTRI                    = 'htri',   // Heater fault
    HVMI                    = 'hvmi',   // Heater fault
    IBUS                    = 'ibus',   // Fault detected
    ILSS                    = 'ilss',   // Fault detected
    ION1                    = 'ion1',   // Ioniser fault
    IUC1                    = 'iuc1',   // Software update failed
    IUC3                    = 'iuc3',   // Software update failed
    IUC4                    = 'iuc4',   // Software update failed
    IUH0                    = 'iuh0',   // Software update failed
    IUH1                    = 'iuh1',   // Software update failed
    IUH3                    = 'iuh3',   // Software update failed
    IUH4                    = 'iuh4',   // Software update failed
    IUP0                    = 'iup0',   // Software update failed
    IUU1                    = 'iuu1',   // Software update failed
    IUU2                    = 'iuu2',   // Software update failed
    IUU3                    = 'iuu3',   // Software update failed
    IUU4                    = 'iuu4',   // Software update failed
    IUW1                    = 'iuw1',   // Software update failed
    IUW3                    = 'iuw3',   // Software update failed
    IUW4                    = 'iuw4',   // Software update failed
    NVMM                    = 'nvmm',   // Hardware memory fault
    NVMR                    = 'nvmr',   // Hardware memory fault
    NVMW                    = 'nvmw',   // Hardware memory fault
    POVI                    = 'povi',   // Heater fault
    PROT                    = 'prot',   // Pump rotor fault
    PSU1                    = 'psu1',   // Power supply unit fault
    PSU2                    = 'psu2',   // Power supply unit fault
    PSU3                    = 'psu3',   // Power supply unit fault
    SEN1                    = 'sen1',   // Particle sensor fault
    SEN2                    = 'sen2',   // Organic gas sensor fault
    SEN3                    = 'sen3',   // Temperature sensor fault
    SEN4                    = 'sen4',   // Humidity sensor fault
    SEN5                    = 'sen5',   // Filter air pressure sensor fault
    SEN6                    = 'sen6',   // Filter not installed
    SEN7                    = 'sen7',   // Formaldehyde sensor fault
    SEN8                    = 'sen8',   // Sensor data fault
    SEN9                    = 'sen9',   // Fan speed sensor fault
    SENA                    = 'sena',   // Fan speed sensing error
    SENB                    = 'senb',   // Carbon dioxide sensor fault
    SHRT                    = 'shrt',   // Motor fault
    SO01                    = 'so01',   // Find+Follow error
    SO02                    = 'so02',   // Find+Follow error
    STAL                    = 'stal',   // Motor fault
    STE1                    = 'ste1',   // Oscillation disabled
    STE2                    = 'ste2',   // Airflow angle disabled
    STTO                    = 'stto',   // Motor fault
    T_HS                    = 't&hs',   // Temperature and humidity sensor fault
    TILT                    = 'tilt',   // Heater fault
    TNKE                    = 'tnke',   // Tank empty
    TNKP                    = 'tnkp',   // Tank not detected
    TOSL                    = 'tosl',   // Tilt angle disabled
    UI01                    = 'ui01',   // Display fault
    UI02                    = 'ui02',   // Display fault
    UI03                    = 'ui03',   // Display fault
    ULED                    = 'uled',   // Water pump UV cleaner fault
    UVC1                    = 'uvc1',   // UV steriliser fault
    VOCS                    = 'vocs',   // Organic gas sensor fault
    WDOG                    = 'wdog',   // Fault detected
    WPMP                    = 'wpmp',   // Unable to humidify
    // Other fault codes seen in MQTT logs
    BOSL                    = 'bosl',  // Oscillation boundary sensor left
    BOSR                    = 'bosr',  // Oscillation boundary sensor right
    COM5                    = 'com5',  // Motor fault
    COM9                    = 'com9',  // Motor fault
    COMA                    = 'coma',  // Motor fault
    FLTR                    = 'fltr',  // Filter replacement warning
    FS02                    = 'fs02',  // Fault detected
    FS03                    = 'fs03',  // Fault detected
    FS04                    = 'fs04',  // Fault detected
    FS05                    = 'fs05',  // Fault detected
    FS06                    = 'fs06',  // Fault detected
    FS07                    = 'fs07',  // Fault detected
    FS08                    = 'fs08',  // Fault detected
    FS09                    = 'fs09',  // Fault detected
    FS0A                    = 'fs0a',  // Fault detected
    FS0B                    = 'fs0b',  // Fault detected
    FS0C                    = 'fs0c',  // Fault detected
    FS0D                    = 'fs0d',  // Fault detected
    FS0E                    = 'fs0e',  // Fault detected
    FS0F                    = 'fs0f',  // Fault detected
    HTCF                    = 'htcf',  // Heater fault
    IUA1                    = 'iua1',  // Software update failed
    IUA2                    = 'iua2',  // Software update failed
    IUA3                    = 'iua3',  // Software update failed
    IUA4                    = 'iua4',  // Software update failed
    IUC2                    = 'iuc2',  // Software update failed
    IUH2                    = 'iuh2',  // Software update failed
    IUW0                    = 'iuw0',  // Software update failed
    IUW2                    = 'iuw2',  // Software update failed
    UID1                    = 'uid1',  // User interface module fault
    UID2                    = 'uid2',  // User interface module fault
    WFCP                    = 'wfcp',  // Wi-Fi communications protocol fault
    WFHB                    = 'wfhb',  // Wi-Fi heartbeat lost
}
export enum DysonAirModuleFault {
    LSPD                    = 'lspd',
    NWCS                    = 'nwcs',
    NWDS                    = 'nwds',
    NWPS                    = 'nwps',
    NWSS                    = 'nwss',
    NWTS                    = 'nwts',
    SRMI                    = 'srmi',
    SRMU                    = 'srmu',
    SRNK                    = 'srnk',
    STAC                    = 'stac',
    STRS                    = 'strs',
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
    SZPW                    = 'szpw',
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