// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { Dyson360BackReason } from './dyson-360-types.js';
import {
    DysonAirCurrentSensorData,
    DysonAirEnvData,
    DysonAirEnvironmentalUsageData
} from './dyson-air-sensor-types.js';
import {
    DysonAirProductState,
    DysonAirProductStateChange
} from './dyson-air-state-types.js';
import {
    DysonAirFaultsList,
    DysonAirFaultsChangeList,
    DysonAirFindFollowMode,
    DysonAirGoodbyeReason,
    DysonAirResetFilterLife,
    DysonAirResetHEPAFilterLife,
    DysonAirResetSource,
    DysonAirScheduler,
    DysonAirSleepTimer,
    DysonStateReason
} from './dyson-air-types.js';
import {
    DysonModeReason,
    DysonMsg
} from './dyson-types.js';

// MQTT topic: <type>/<sn>/status/connection

export interface DysonAirMsgHello extends DysonMsg {
    msg:                    'HELLO';
    hardwareVersion?:       string; // e.g. 'PS00.WF03',
    macAddress:             string; // e.g. "C8:FF:77:XX:XX:XX"
    model?:                 string; // e.g. 'X455' or 'X475'
    moduleBootloader?:      string; // e.g. '-.-.-.-'
    moduleHardware?:        string; // e.g. '140762-01-07'
    moduleNwp?:             string; // e.g. '2.11.0.1'
    moduleSoftware?:        string; // e.g. '5227'
    productBootloader?:     string; // e.g. '000000.00.00'
    productHardware?:       string; // e.g. '306614-01-03'
    productSoftware?:       string; // e.g. '000027.19.59'
    protocol:               string; // e.g. '1.0.0'
    recoveryPackageVersion?:string; // e.g. '0664PF.00.08.004.0001'
    resetSource:            DysonAirResetSource;
    serialNumber:           string; // e.g. 'AB1-CD-EFG2345H'
    version:                string; // e.g. '21.04.03'
}

export interface DysonAirMsgGoneAway extends DysonMsg {
    msg:                    'GONE-AWAY';
    // Note: This is the only message that omits the 'time' property
}

export interface DysonAirMsgGoodbye extends DysonMsg {
    msg:                    'GOODBYE';
    reason:                 DysonAirGoodbyeReason;
}

export interface DysonAirMsgImBack extends DysonMsg {
    msg:                    'IM-BACK';
    reason?:                Dyson360BackReason;
    version?:               string; // e.g. '0664PF.00.08.005.0002'
}

// MQTT topic: <type>/<sn>/status/current

export interface DysonAirMsgCurrentState extends DysonMsg {
    msg:                    'CURRENT-STATE';
    modeReason:             DysonModeReason;
    stateReason:            DysonStateReason;
    dial?:                  string; // e.g. 'OFF'
    rssi?:                  string; // Wi-Fi RSSI dBm
    channel?:               string; // Wi-Fi channel number
    fghp?:                  string; // e.g. '74456'
    fqhp?:                  string; // e.g. '91608'
    productState:           DysonAirProductState;
    scheduler:              DysonAirScheduler;
}

export interface DysonAirMsgStateChange extends DysonMsg {
    msg:                    'STATE-CHANGE';
    modeReason:             DysonModeReason;
    stateReason:            DysonStateReason;
    productState:           DysonAirProductStateChange;
    scheduler:              DysonAirScheduler;
}

export interface DysonAirMsgEnvironmentalCurrentSensorData extends DysonMsg {
    msg:                    'ENVIRONMENTAL-CURRENT-SENSOR-DATA';
    data:                   DysonAirCurrentSensorData;
}

export interface DysonAirMsgEnvironmentalAndUsageData extends DysonMsg {
    msg:                    'ENVIRONMENTAL-AND-USAGE-DATA';
    data:                   DysonAirEnvironmentalUsageData;
}
export interface DysonAirMsgLocation extends DysonMsg {
    msg:                    'LOCATION';
    apos:                   string; // e.g. '0153'
}

// MQTT topic: <type>/<sn>/status/faults

export interface DysonAirMsgCurrentFaults extends DysonMsg {
    msg:                    'CURRENT-FAULTS';
    productErrors:          DysonAirFaultsList
    productWarnings:        DysonAirFaultsList;
    moduleErrors:           DysonAirFaultsList;
    moduleWarnings:         DysonAirFaultsList;
}

export interface DysonAirMsgFaultsChange extends DysonMsg {
    msg:                    'FAULTS-CHANGE';
    productErrors:          DysonAirFaultsChangeList;
    productWarnings:        DysonAirFaultsChangeList;
    moduleErrors:           DysonAirFaultsChangeList;
    moduleWarnings:         DysonAirFaultsChangeList;
}

// MQTT topic: <type>/<sn>/status/scheduler

export interface DysonAirMsgScheduleUpdated extends DysonMsg {
    msg:                    'SCHEDULE-UPDATED';
    version:                string; // Schedule version e.g. '80a0' or 'a770'
}

// MQTT topic: <type>/<sn>/status/summary

// (Published CBOR encoded encapsulated in DysonMsgCBOR)
export interface DysonAirMsgEnvData extends DysonMsg {
    msg:                    'ENV-DATA',
    aqlm:                   DysonAirEnvData; // AQL:                     ?
    co2m:                   DysonAirEnvData; // CO2:                     ?
    fnau:                   DysonAirEnvData; // Fan?
    fnmd:                   DysonAirEnvData; // Fan?
    fnon:                   DysonAirEnvData; // Fan?
    fnsp:                   DysonAirEnvData; // Fan speed:      0 ~  100 %
    hchm:                   DysonAirEnvData; // Formaldehyde:            deci-µg/m³
    humm:                   DysonAirEnvData; // Humidity:       0 ~ 1000 deci-%
    no2m:                   DysonAirEnvData; // NOx:                     ppb
    p10m:                   DysonAirEnvData; // PM10:                    µg/m³
    p25m:                   DysonAirEnvData; // PM2.5:                   µg/m³
    tmpm:                   DysonAirEnvData; // Temperature: 2430 ~ 3530 deci-K
    volm:                   DysonAirEnvData; // VOC:                     ?
}

// MQTT topic: <type>/<sn>/command

export interface DysonAirMsgRequestCurrentFaults extends DysonMsg {
    msg:                    'REQUEST-CURRENT-FAULTS';
    'mode-reason'?:         DysonModeReason;
}

export interface DysonAirMsgRequestCurrentState extends DysonMsg {
    msg:                    'REQUEST-CURRENT-STATE';
    'mode-reason'?:         DysonModeReason;
}

export interface DysonAirMsgRequestProductEnvironmentCurrentSensorData extends DysonMsg {
    msg:                    'REQUEST-PRODUCT-ENVIRONMENT-CURRENT-SENSOR-DATA';
    'mode-reason'?:         DysonModeReason;
}

export interface DysonAirMsgStateSet extends DysonMsg {
    msg:                    'STATE-SET';
    'mode-reason'?:         DysonModeReason;
    data:                   DysonAirProductState & {
        rstf?:              DysonAirResetFilterLife;
        rhtf?:              DysonAirResetHEPAFilterLife;
        sltm?:              DysonAirSleepTimer;
        soon?:              DysonAirFindFollowMode;
    }
}

export interface DysonAirMsgScheduleSet extends DysonMsg {
    msg:                    'SCHEDULE-SET';
    version:                string; // Schedule version e.g. '80a0' or 'a770'
}

export interface DysonAirMsgUpdateSchedule extends DysonMsg {
    msg:                    'UPDATE-SCHEDULE',
    version:                string; // Schedule version e.g. '80a0' or 'a770'
}