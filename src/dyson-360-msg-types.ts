// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    Dyson360CleaningMode,
    Dyson360CleaningType,
    Dyson360Faults,
    Dyson360Position,
    Dyson360PowerMode,
    Dyson360State
} from './dyson-360-types.js';
import { DysonModeReason, DysonMsg } from './dyson-types.js';

// MQTT topic: <type>/initialconnection/credentials

export interface Dyson360MsgDeviceCredentials extends DysonMsg {
    msg:                    'DEVICE-CREDENTIALS';
    serialNumber:           string;
    apPasswordHash:         string;
}

// MQTT topic: <type>/initialconnection/status

export interface Dyson360MsgConnectionStatus extends DysonMsg {
    msg:                    'CONNECTION-STATUS';
    status:                 string; // e.g. 'idle'
    phase:                  string; // e.g. 'disconnected'
    network:                string; // e.g. ''
    requestId:              string; // e.g. ''
    ip:                     string; // e.g. '192.168.0.100'
}

// MQTT topic: <type>/<sn>/status

// (This is also sometimes received with an empty MQTT topic)
export interface Dyson360MsgHello extends DysonMsg {
    msg:                    'HELLO',
    protocol:               string; // e.g. '1.0.0'
    serial:                 string; // e.g. '<SERIAL_NUMBER: JJ5-...HDA1502A>'
    version:                string; // e.g. '11.3.5.10'
}

export interface Dyson360MsgGoodbye extends DysonMsg {
    msg:                    'GOODBYE';
    reason:                 'UNKNOWN';
}

export interface Dyson360MsgGoneAway extends DysonMsg {
    msg:                    'GONE-AWAY';
    // Note: This is the only message that omits the 'time' property
}

export interface Dyson360MsgImBack extends DysonMsg {
    msg:                    'IM-BACK';
    state?:                 Dyson360State;
}

export interface Dyson360MsgCurrentState extends DysonMsg {
    msg:                    'CURRENT-STATE';
    batteryChargeLevel:     number; // Percent remaining
    cleanDuration?:         number; // Seconds
    cleanId:                string; // UUID
    currentVacuumPowerMode: Dyson360PowerMode;
    defaultVacuumPowerMode: Dyson360PowerMode;
    currentCleaningMode?:   Dyson360CleaningMode;
    defaultCleaningMode?:   Dyson360CleaningMode;
    faults?:                Dyson360Faults;
    fullCleanType:          Dyson360CleaningType;
    globalPosition:         Dyson360Position;
    state:                  Dyson360State;
}

export interface Dyson360MsgStateChange extends DysonMsg {
    msg:                    'STATE-CHANGE';
    batteryChargeLevel:     number; // Percent remaining
    cleanDuration?:         number; // Seconds
    cleanId:                string; // UUID
    currentVacuumPowerMode: Dyson360PowerMode;
    defaultVacuumPowerMode: Dyson360PowerMode;
    currentCleaningMode?:   Dyson360CleaningMode;
    defaultCleaningMode?:   Dyson360CleaningMode;
    faults?:                Dyson360Faults;
    fullCleanType:          Dyson360CleaningType;
    globalPosition:         Dyson360Position;
    newstate:               Dyson360State;
    oldstate:               Dyson360State;
    endOfClean?:            boolean;
}

export interface Dyson360MsgMapData extends DysonMsg {
    msg:                    'MAP-DATA',
    gridID:                 string; // e.g. '3'
    cleanId:                string; // UUID
    data: {
        content:            string; // base64 encoded
        contentType:        string; // e.g. 'application/json'
        contentEncoding:    string; // e.g. 'gzip'
    }
}

export interface Dyson360MsgMapGlobal extends DysonMsg {
    msg:                    'MAP-GLOBAL',
    angle:                  number;
    cleanId:                string; // UUID
    gridID:                 string; // e.g. '3'
    x:                      number;
    y:                      number;
}

export interface Dyson360MsgMapGrid extends DysonMsg {
    msg:                    'MAP-GRID',
    anchor:                 Dyson360Position;
    cleanId:                string; // UUID
    gridID:                 string; // e.g. '3'
    height:                 number;
    resolution:             number;
    width:                  number;
}

export interface Dyson360MsgTelemetryData extends DysonMsg {
    msg:                    'TELEMETRY-DATA',
    field1:                 string; // e.g. '128.0.0'
    field2:                 string; // e.g. '0.000000'
    field3:                 string; // e.g. ''
    field4:                 string; // e.g. UUID
    id:                     string; // e.g. '41280000'
}

// MQTT topic: <type>/<sn>/command

export interface Dyson360MsgRequestCurrentState extends DysonMsg {
    msg:                    'REQUEST-CURRENT-STATE';
    'mode-reason'?:         DysonModeReason;
}

export interface Dyson360MsgStateSet extends DysonMsg {
    msg:                    'STATE-SET';
    'mode-reason':          DysonModeReason;
    data: {
        defaultVacuumPowerMode: Dyson360PowerMode;
    }
}

export interface Dyson360MsgStart extends DysonMsg {
    msg:                    'START';
    'mode-reason':          DysonModeReason;
    fullCleanType:          Dyson360CleaningType;
     // Heurist and Vis Nav only
    cleaningMode?:          Dyson360CleaningMode;
}

export interface Dyson360MsgPause extends DysonMsg {
    msg:                    'PAUSE';
    'mode-reason':          DysonModeReason;
}

export interface Dyson360MsgResume extends DysonMsg {
    msg:                    'RESUME';
    'mode-reason':          DysonModeReason;
}

export interface Dyson360MsgAbort extends DysonMsg {
    msg:                    'ABORT'; // GoHome
    'mode-reason':          DysonModeReason;
}