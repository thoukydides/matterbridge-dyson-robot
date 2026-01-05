// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    Dyson360ActiveFault,
    Dyson360CleaningMode,
    Dyson360CleaningProgramme,
    Dyson360CleaningStrategy,
    Dyson360CleaningType,
    Dyson360Faults,
    Dyson360GoodbyeReason,
    Dyson360OutOfBoxState,
    Dyson360Position,
    Dyson360PowerMode,
    Dyson360State,
    Dyson360ZoneStatus
} from './dyson-360-types.js';
import { DysonModeReason, DysonMsg } from './dyson-types.js';

// MQTT topic: <type>/initialconnection/credentials

export interface Dyson360MsgDeviceCredentials extends DysonMsg {
    msg:                        'DEVICE-CREDENTIALS';
    serialNumber:               string;
    apPasswordHash:             string;
}

// MQTT topic: <type>/initialconnection/status

export interface Dyson360MsgConnectionStatus extends DysonMsg {
    msg:                        'CONNECTION-STATUS';
    status:                     string; // e.g. 'idle'
    phase:                      string; // e.g. 'disconnected'
    network:                    string; // e.g. ''
    requestId:                  string; // e.g. ''
    ip:                         string; // e.g. '192.168.0.100'
}

// MQTT topic: <type>/<sn>/status

// (This is also sometimes received with an empty MQTT topic)
export interface Dyson360MsgHello extends DysonMsg {
    msg:                        'HELLO',
    model?:                     string; // e.g. 'RB03'
    productHardware?:           string; // e.g. 'RB03-1'
    protocol:                   string; // e.g. '1.0.0'
    serial:                     string; // e.g. 'AB1-CD-EFG2345H'
    sessionId?:                 string; // UUID
    version:                    string; // e.g. '11.3.5.10'
}

export interface Dyson360MsgGoodbye extends DysonMsg {
    msg:                        'GOODBYE';
    reason:                     Dyson360GoodbyeReason;
    sessionId?:                 string; // UUID
}

export interface Dyson360MsgAuthoriseVerifiedUser extends DysonMsg {
    msg:                        'AUTHORISE-VERIFIED-USER';
    id:                         string; // UUID
    localpwd:                   string; // base64 encoded
}

export interface Dyson360MsgGoneAway extends DysonMsg {
    msg:                        'GONE-AWAY';
    // Note: This is the only message that omits the 'time' property
}

export interface Dyson360MsgImBack extends DysonMsg {
    msg:                        'IM-BACK';
    state?:                     Dyson360State;
}

export interface Dyson360MsgCurrentState extends DysonMsg {
    msg:                        'CURRENT-STATE';
    activeFaults?:              Dyson360ActiveFault[],
    batteryChargeLevel?:        number; // Percent remaining
    channel?:                   string; // Wi-Fi channel number
    cleanDuration?:             number; // Seconds
    cleanId?:                   string; // UUID
    cleaningProgramme?:         Dyson360CleaningProgramme;
    currentCleaningMode?:       Dyson360CleaningMode;
    currentCleaningStrategy?:   Dyson360CleaningStrategy,
    currentVacuumPowerMode?:    Dyson360PowerMode;
    defaultCleaningMode?:       Dyson360CleaningMode;
    defaultCleaningStrategy?:   Dyson360CleaningStrategy,
    defaultVacuumPowerMode?:    Dyson360PowerMode;
    faults?:                    Dyson360Faults;
    fullCleanType?:             Dyson360CleaningType;
    globalPosition?:            Dyson360Position;
    outOfBoxState?:             Dyson360OutOfBoxState;
    persistentMapId?:           string; // UUID
    rssi?:                      string; // Wi-Fi RSSI dBm
    sessionId?:                 string; // UUID
    state:                      Dyson360State;
    traverseTargetId?:          string; // e.g. '1'
    zoneId?:                    string; // e.g. '1'
    zonesDefinitionVersion?:    string; // e.g. '2024-09-17T23:08:23.9939605Z'
    zoneStatus?:                Dyson360ZoneStatus[];
}

export interface Dyson360MsgStateChange extends DysonMsg {
    msg:                        'STATE-CHANGE';
    activeFaults?:              Dyson360ActiveFault[],
    batteryChargeLevel?:        number; // Percent remaining
    channel?:                   string; // Wi-Fi channel number
    cleanDuration?:             number; // Seconds
    cleanId?:                   string; // UUID
    cleaningProgramme?:         Dyson360CleaningProgramme;
    currentCleaningMode?:       Dyson360CleaningMode;
    currentCleaningStrategy?:   Dyson360CleaningStrategy,
    currentVacuumPowerMode?:    Dyson360PowerMode;
    defaultCleaningMode?:       Dyson360CleaningMode;
    defaultCleaningStrategy?:   Dyson360CleaningStrategy,
    defaultVacuumPowerMode?:    Dyson360PowerMode;
    endOfClean?:                boolean;
    faults?:                    Dyson360Faults;
    fullCleanType?:             Dyson360CleaningType;
    globalPosition?:            Dyson360Position;
    newActiveFaults?:           Dyson360ActiveFault[],
    newOutOfBoxState?:          Dyson360OutOfBoxState;
    newstate:                   Dyson360State;
    newZoneId?:                 string; // e.g. '1'
    oldActiveFaults?:           Dyson360ActiveFault[],
    oldOutOfBoxState?:          Dyson360OutOfBoxState;
    oldstate:                   Dyson360State;
    oldZoneId?:                 string; // e.g. '1'
    persistentMapId?:           string; // UUID
    rssi?:                      string; // Wi-Fi RSSI dBm
    sessionId?:                 string; // UUID
    traverseTargetId?:          string; // e.g. '1'
    zonesDefinitionVersion?:    string; // e.g. '2024-09-17T23:08:23.9939605Z'
    zoneStatus?:                Dyson360ZoneStatus[];
}

export interface Dyson360MsgMapData extends DysonMsg {
    msg:                        'MAP-DATA',
    gridID:                     string; // e.g. '3'
    cleanId:                    string; // UUID
    data: {
        content:                string; // base64 encoded, zlib deflate compressed
        contentType:            'application/json';
        contentEncoding:        'gzip';
    }
}

export interface Dyson360MsgMapGlobal extends DysonMsg {
    msg:                        'MAP-GLOBAL',
    angle:                      number;
    cleanId:                    string; // UUID
    gridID:                     string; // e.g. '3'
    x:                          number;
    y:                          number;
}

export interface Dyson360MsgMapGrid extends DysonMsg {
    msg:                        'MAP-GRID',
    anchor:                     Dyson360Position;
    cleanId:                    string; // UUID
    gridID:                     string; // e.g. '3'
    height:                     number;
    resolution:                 number;
    width:                      number;
}

export interface Dyson360MsgTelemetryData extends DysonMsg {
    msg:                        'TELEMETRY-DATA',
    field1:                     string; // e.g. '128.0.0'
    field2:                     string; // e.g. '0.000000'
    field3:                     string; // e.g. ''
    field4:                     string; // e.g. UUID
    id:                         string; // e.g. '41280000'
}

// MQTT topic: <type>/<sn>/command

export interface Dyson360MsgRequestCurrentState extends DysonMsg {
    msg:                        'REQUEST-CURRENT-STATE';
    'mode-reason'?:             DysonModeReason;
}

export interface Dyson360MsgStateSet extends DysonMsg {
    msg:                        'STATE-SET';
    'mode-reason':              DysonModeReason;
    data?: {
        defaultVacuumPowerMode: Dyson360PowerMode;
    }
    defaults?: {
        defaultCleaningStrategy: Dyson360CleaningStrategy
    }
}

export interface Dyson360MsgStart extends DysonMsg {
    msg:                        'START';
    'mode-reason'?:             DysonModeReason;
    fullCleanType:              Dyson360CleaningType;
    cleaningMode?:              Dyson360CleaningMode;
    cleaningProgramme?:         Dyson360CleaningProgramme;
    cleaningStrategy?:          Dyson360CleaningStrategy;
    vacuumPowerMode?:           Dyson360PowerMode;
    cleanId?:                   string; // UUID
}

export interface Dyson360MsgPause extends DysonMsg {
    msg:                        'PAUSE';
    'mode-reason':              DysonModeReason;
}

export interface Dyson360MsgResume extends DysonMsg {
    msg:                        'RESUME';
    'mode-reason':              DysonModeReason;
}

export interface Dyson360MsgAbort extends DysonMsg {
    msg:                        'ABORT'; // GoHome
    'mode-reason':              DysonModeReason;
}

export interface Dyson360MsgStartMapping extends DysonMsg {
    msg:                        'START-MAPPING';
    'mode-reason':              DysonModeReason;
}

export interface Dyson360MsgPersistentMapManifestUpdated extends DysonMsg {
    msg:                        'PERSISTENT-MAP-MANIFEST-UPDATED'
}

export interface Dyson360MsgAcknowledgeFault extends DysonMsg {
    msg:                        'ACKNOWLEDGE-FAULT',
    'mode-reason':              DysonModeReason,
    faultCode:                  string; // e.g. '19.12.-1'
}