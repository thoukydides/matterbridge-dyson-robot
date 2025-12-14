// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    DysonAirCurrentSensorData,
    DysonAirEnvironmentalUsageData
} from './dyson-air-sensor-types.js';
import {
    DysonAirProductState,
    DysonAirProductStateChange
} from './dyson-air-state-types.js';
import {
    DysonAirFaultChange,
    DysonAirFaultStatus,
    DysonAirResetFilterLife,
    DysonAirResetHEPAFilterLife,
    DysonAirResetSource,
    DysonAirScheduler,
    DysonAirSleepTimer
} from './dyson-air-types.js';
import {
    DysonModeReason,
    DysonMsg,
    DysonStateReason
} from './dyson-types.js';

// MQTT topic: <type>/<sn>/status/connection

export interface DysonAirMsgHello extends DysonMsg {
    msg:                    'HELLO';
    model?:                 string; // e.g. 'X455' or 'X475'
    version:                string; // e.g. '21.04.03'
    protocol:               string; // e.g. '1.0.0'
    serialNumber:           string; // e.g. 'AB1-CD-EFG2345H'
    macAddress:             string; // e.g. "C8:FF:77:XX:XX:XX"
    moduleHardware?:        string; // e.g. '140762-01-07'
    moduleBootloader?:      string; // e.g. '-.-.-.-'
    moduleSoftware?:        string; // e.g. '5227'
    moduleNwp?:             string; // e.g. '2.11.0.1'
    productHardware?:       string; // e.g. '306614-01-03'
    productBootloader?:     string; // e.g. '000000.00.00'
    productSoftware?:       string; // e.g. '000027.19.59'
    resetSource:            DysonAirResetSource;
}

export interface DysonAirMsgGoneAway extends DysonMsg {
    msg:                    'GONE-AWAY';
    // Note: This is the only message that omits the 'time' property
}

export interface DysonAirMsgGoodbye extends DysonMsg {
    msg:                    'GOODBYE';
    reason:                 'UNKNOWN';
}

export interface DysonAirMsgImBack extends DysonMsg {
    msg:                    'IM-BACK';
    reason?:                'WIFI-RECONNECT' | 'BROKER-RECONNECT';
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
    productErrors: {
        // Should be Record<DysonAirProductError, DysonAirFaultStatus>
        [fault: string]:    DysonAirFaultStatus;
    }
    productWarnings: {
        // Should be Record<DysonAirProductWarning, DysonAirFaultStatus>
        [fault: string]:    DysonAirFaultStatus;
    }
    moduleErrors: {
        // Should be Record<DysonAirModuleError, DysonAirFaultStatus>
        [fault: string]:    DysonAirFaultStatus;
    }
    moduleWarnings: {
        // Should be Record<DysonAirModuleWarning, DysonAirFaultStatus>
        [fault: string]:    DysonAirFaultStatus;
    }
}

export interface DysonAirMsgFaultsChange extends DysonMsg {
    msg:                    'FAULTS-CHANGE';
    productErrors: {
        // Should be Record<DysonAirProductError, DysonAirFaultChange>
        [fault: string]:    DysonAirFaultChange;
    }
    productWarnings: {
        // Should be Record<DysonAirProductWarning, DysonAirFaultChange>
        [fault: string]:    DysonAirFaultChange;
    }
    moduleErrors: {
        // Should be Record<DysonAirModuleError, DysonAirFaultChange>
        [fault: string]:    DysonAirFaultChange;
    }
    moduleWarnings: {
        // Should be Record<DysonAirModuleWarning, DysonAirFaultChange>
        [fault: string]:    DysonAirFaultChange;
    }
}

// MQTT topic: <type>/<sn>/status/scheduler

export interface DysonAirMsgScheduleUpdated extends DysonMsg {
    msg:                    'SCHEDULE-UPDATED';
    version:                string; // Schedule version e.g. '80a0' or 'a770'
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
    }
}

export interface DysonAirMsgScheduleSet extends DysonMsg {
    msg:                    'SCHEDULE-SET';
    version:                string; // Schedule version e.g. '80a0' or 'a770'
}