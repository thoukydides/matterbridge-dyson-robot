// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    DysonAirContinuousMonitoring,
    DysonAirErrorCode,
    DysonAirFanSpeed,
    DysonAirFanState,
    DysonAirFanFocus,
    DysonAirNightMode,
    DysonAirOscillation,
    DysonAirWarningCode,
    DysonAirHeatingMode,
    DysonAirHeatingStatus,
    DysonAirTiltSensor,
    DysonAirFanAutoPower,
    DysonAirQualityTarget,
    DysonAirTiltAngle,
    DysonAirWaterHardness,
    DysonAirAutoMode,
    DysonAirCarbonFilterLife,
    DysonAirFanDirection,
    DysonAirFanPower,
    DysonAirHumidification,
    DysonAirHumidificationAutoMode,
    DysonAirAnemometerControlProfile,
    DysonAirAnemometerControlTilt,
    DysonAirTemperatureUnits,
    DysonAirCarbonFilterType,
    DysonAirDeepCleanCycle,
    DysonAirHEPAFilterType,
    DysonAirHumidificationState,
    DysonAirTiltOscillation,
    DysonAirHumidificationProcess,
    DysonAirBrightness,
    DysonAirOscillationStatus,
    DysonAirTiltOscillationStatus,
    DysonAirSelectiveCatalyticOxidisationFilterType,
    DysonAirSleepTimer
} from './dyson-air-types.js';

// Dyson air treatment product state
export interface DysonAirProductState {
    // All models
    ercd?:  DysonAirErrorCode;
    fnsp?:  DysonAirFanSpeed;
    fnst?:  DysonAirFanState;
    nmod?:  DysonAirNightMode;
    rhtm?:  DysonAirContinuousMonitoring;
    wacd?:  DysonAirWarningCode;

    // All Hot+ models
    ffoc?:  DysonAirFanFocus;
    hmax?:  string;                     // Target temperature: '2740'~'3100' deci-K
    hmod?:  DysonAirHeatingMode;
    hsta?:  DysonAirHeatingStatus;

    // All models except Big+Quiet
    oson?:  DysonAirOscillation;

    // Big+Quiet models only
    anct?:  DysonAirAnemometerControlTilt;
    otal?:  DysonAirTiltAngle;          // Tilt angle lower bound °
    otau?:  DysonAirTiltAngle;          // Tilt angle upper bound °
    oton?:  DysonAirTiltOscillation;
    sflr?:  string;                     // SCO filter life:     '0000'~'0100' %
    sflt?:  DysonAirSelectiveCatalyticOxidisationFilterType;
    otcs?:  DysonAirTiltOscillationStatus;

    // All models except Pure (Hot+)Cool Link
    auto?:  DysonAirAutoMode;           // (see 'fmod' for Link models)
    cflr?:  DysonAirCarbonFilterLife;   // Carbon filter life:  '0000'~'0100' % or 'INV'
    cflt?:  DysonAirCarbonFilterType;
    corf?:  DysonAirTemperatureUnits;
    fdir?:  DysonAirFanDirection;
    fpwr?:  DysonAirFanPower;
    hflr?:  string;                     // HEPA filter life:    '0000'~'0100' %
    hflt?:  DysonAirHEPAFilterType;
    nmdv?:  DysonAirFanSpeed;           // Night mode (max?) fan speed
    sltm?:  DysonAirSleepTimer;         // Sleep timer:     '0000'~'9999' minutes or 'OFF'

    // Pure (Hot+)Cool Link models only
    filf?:  string;                     // Remaining filter life: '4300' hours = 1 year at ~12 hours/day
    fmod?:  DysonAirFanAutoPower;       // (see 'auto' for non-Link models)
    qtar?:  DysonAirQualityTarget;

    // Pure Hot+Cool Link only
    tilt?:  DysonAirTiltSensor;

    // Pure (Hot+)Cool and Humidify+Cool models only
    oscs?:  DysonAirOscillationStatus;

    // Pure (Hot+)Cool models only
    // (angles must be equal or at least 30° apart, 5° steps)
    osal?:  string;                     // Oscillation lower angle: '0005'~'0355' °
    osau?:  string;                     // Oscillation upper angle: '0005'~'0355' °

    // Humidify+Cool models only
    ancp?:  DysonAirAnemometerControlProfile;
    cdrr?:  string;                     // Time until clean finishes in minutes
    clcr?:  DysonAirDeepCleanCycle;
    cltr?:  string;                     // Time until next clean in hours
    haut?:  DysonAirHumidificationAutoMode;
    hume?:  DysonAirHumidification;
    humt?:  string;                     // Manual humidity target:  '0030'~'0070' %
    msta?:  DysonAirHumidificationState;
    psta?:  DysonAirHumidificationProcess;
    rect?:  string;                     // Auto humidity target:    '0030'~'0070' %
    wath?:  DysonAirWaterHardness;

    // Others values that sometimes exist
    bril?:  DysonAirBrightness;         // Display brightness
    fqhp?:  string;                     // Variable length number?
}

// Dyson air treatment product state change; should be a mapped type:
//   export type DysonAirProductStateChange = {
//       [K in keyof DysonAirProductState]?: [
//           NonNullable<DysonAirProductState[K]>,
//           NonNullable<DysonAirProductState[K]>
//       ];
//   }
// ... but ts-interface-builder doesn't support that
export interface DysonAirProductStateChange {
    ercd?:  [DysonAirErrorCode,                                 DysonAirErrorCode];
    fnsp?:  [DysonAirFanSpeed,                                  DysonAirFanSpeed];
    fnst?:  [DysonAirFanState,                                  DysonAirFanState];
    nmod?:  [DysonAirNightMode,                                 DysonAirNightMode];
    rhtm?:  [DysonAirContinuousMonitoring,                      DysonAirContinuousMonitoring];
    wacd?:  [DysonAirWarningCode,                               DysonAirWarningCode];
    ffoc?:  [DysonAirFanFocus,                                  DysonAirFanFocus];
    hmax?:  [string,                                            string];
    hmod?:  [DysonAirHeatingMode,                               DysonAirHeatingMode];
    hsta?:  [DysonAirHeatingStatus,                             DysonAirHeatingStatus];
    oson?:  [DysonAirOscillation,                               DysonAirOscillation];
    anct?:  [DysonAirAnemometerControlTilt,                     DysonAirAnemometerControlTilt];
    otal?:  [DysonAirTiltAngle,                                 DysonAirTiltAngle];
    otau?:  [DysonAirTiltAngle,                                 DysonAirTiltAngle];
    oton?:  [DysonAirTiltOscillation,                           DysonAirTiltOscillation];
    sflr?:  [string,                                            string];
    sflt?:  [DysonAirSelectiveCatalyticOxidisationFilterType,   DysonAirSelectiveCatalyticOxidisationFilterType];
    otcs?:  [DysonAirTiltOscillationStatus,                     DysonAirTiltOscillationStatus];
    auto?:  [DysonAirAutoMode,                                  DysonAirAutoMode];
    cflr?:  [DysonAirCarbonFilterLife,                          DysonAirCarbonFilterLife];
    cflt?:  [DysonAirCarbonFilterType,                          DysonAirCarbonFilterType];
    corf?:  [DysonAirTemperatureUnits,                          DysonAirTemperatureUnits];
    fdir?:  [DysonAirFanDirection,                              DysonAirFanDirection];
    fpwr?:  [DysonAirFanPower,                                  DysonAirFanPower];
    hflr?:  [string,                                            string];
    hflt?:  [DysonAirHEPAFilterType,                            DysonAirHEPAFilterType];
    nmdv?:  [DysonAirFanSpeed,                                  DysonAirFanSpeed];
    sltm?:  [DysonAirSleepTimer,                                DysonAirSleepTimer];
    filf?:  [string,                                            string];
    fmod?:  [DysonAirFanAutoPower,                              DysonAirFanAutoPower];
    qtar?:  [DysonAirQualityTarget,                             DysonAirQualityTarget];
    tilt?:  [DysonAirTiltSensor,                                DysonAirTiltSensor];
    oscs?:  [DysonAirOscillationStatus,                         DysonAirOscillationStatus];
    osal?:  [string,                                            string];
    osau?:  [string,                                            string];
    ancp?:  [DysonAirAnemometerControlProfile,                  DysonAirAnemometerControlProfile];
    cdrr?:  [string,                                            string];
    cltr?:  [string,                                            string];
    clcr?:  [DysonAirDeepCleanCycle,                            DysonAirDeepCleanCycle];
    haut?:  [DysonAirHumidificationAutoMode,                    DysonAirHumidificationAutoMode];
    hume?:  [DysonAirHumidification,                            DysonAirHumidification];
    humt?:  [string,                                            string];
    msta?:  [DysonAirHumidificationState,                       DysonAirHumidificationState];
    psta?:  [DysonAirHumidificationProcess,                     DysonAirHumidificationProcess];
    rect?:  [string,                                            string];
    wath?:  [DysonAirWaterHardness,                             DysonAirWaterHardness];
    bril?:  [DysonAirBrightness,                                DysonAirBrightness];
    fqhp?:  [string,                                            string];
}