// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

// Configuration methods
export type ProvisioningMethod =
    'Remote Account'
  | 'Local Account'
  | 'Local Wi-Fi'
  | 'Local MQTT';

// Dyson account configuration
export interface DysonAccountBase {
    china:                  boolean;
    // Dummy values corresponding to action buttons
    finishAuth?:            boolean,
    startAuth?:             boolean
}
export interface DysonAccountLogin extends DysonAccountBase {
    email:                  string;
    password:               string;
}
export interface DysonAccountToken extends DysonAccountBase {
    token:                  string;
    email?:                 string;
    password?:              string;
}
export type DysonAccount = DysonAccountLogin | DysonAccountToken;

// Device configuration
export interface DeviceConfigNetwork {
    host:                   string;
    port:                   number;
}
export interface DeviceConfigLocalAccount extends DeviceConfigNetwork {
    serialNumber:           string;
}
export interface DeviceConfigLocalWiFi extends DeviceConfigNetwork {
    name:                   string;
    ssid:                   string;
    password:               string;
}
export interface DeviceConfigLocalMqtt extends DeviceConfigNetwork {
    name:                   string;
    serialNumber:           string;
    password:               string;
    rootTopic:              string;
}

// Entity names used for validation
export type EntityName =
    'Air Purifier'
  | 'Air Quality Sensor'
  | 'Composed Air Purifier'
  | 'Humidity Sensor'
  | 'Temperature Sensor'
  | 'Thermostat';

// Debugging features
export type DebugFeatures =
    'Log Endpoint Debug'
  | 'Log API Headers'
  | 'Log API Bodies'
  | 'Log MQTT Client'
  | 'Log MQTT Payloads'
  | 'Log Serial Numbers'
  | 'Log Debug as Info';

// The user plugin configuration
export interface ConfigBase {
    // Matterbridge additions
    name:                   string;
    type:                   string;
    version:                string;
    whiteList:              string[];
    blackList:              string[];
    entityWhiteList:        EntityName[],
    entityBlackList:        EntityName[],
    deviceEntityBlackList:  { [serialNumber: string]: EntityName[] },
    // Plugin configuration
    provisioningMethod:     ProvisioningMethod;
    enableServerRvc:        boolean;
    wildcardTopic:          boolean;
    debug:                  boolean;
    debugFeatures:          DebugFeatures[];
    unregisterOnShutdown:   boolean;
}
export interface ConfigAccount extends ConfigBase {
    dysonAccount:           DysonAccount;
}
export interface ConfigRemoteAccount extends ConfigAccount {
    provisioningMethod:     'Remote Account';
}
export interface ConfigLocalAccount extends ConfigAccount {
    provisioningMethod:     'Local Account';
    devices:                DeviceConfigLocalAccount[];
}
export interface ConfigLocalWiFi extends ConfigBase {
    provisioningMethod:     'Local Wi-Fi';
    devices:                DeviceConfigLocalWiFi[];
}
export interface ConfigLocalMqtt extends ConfigBase {
    provisioningMethod:     'Local MQTT';
    devices:                DeviceConfigLocalMqtt[];
}
export type Config = ConfigRemoteAccount | ConfigLocalAccount | ConfigLocalWiFi | ConfigLocalMqtt;