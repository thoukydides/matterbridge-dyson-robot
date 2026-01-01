// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

// Common base for all Dyson MQTT payloads
export interface DysonMsg {
    msg:                    string;
    time?:                  string; // e.g. '2025-04-28T12:33:27.003Z'
}

// Dyson mode reason
export enum DysonModeReason {
    Unknown                 = '',
    LocalApp                = 'LAPP',
    LocalSchedule           = 'LSCH',
    RemoteApp               = 'RAPP',
    Preconditioning         = 'PRC',
    PhysicalUserInteraction = 'PUI',
    None                    = 'NONE'
}

// Dyson state reason
export enum DysonStateReason {
    Environment             = 'ENV',
    FLT                     = 'FLT',
    Mode                    = 'MODE',
    None                    = 'NONE'
}