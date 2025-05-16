// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

// Configuration for a single device
export interface DeviceConfigBase {
    name:                   string;
}
export interface DeviceConfigWiFi extends DeviceConfigBase {
    host:                   string;
    port:                   number;
    wifi_ssid:              string;
    wifi_password:          string;
}
export interface DeviceConfigMqtt extends DeviceConfigBase {
    host:                   string;
    port:                   number;
    username:               string;
    password:               string;
    root_topic:             string;
}
export interface DeviceConfigIoT extends DeviceConfigBase {
    endpoint:               string;
    client_id:              string;
    custom_authorizer_name: string;
    token_key:              string;
    token_signature:        string;
    token_value:            string;
    username:               string;
    root_topic:             string;
}
export type DeviceConfig    = DeviceConfigMqtt | DeviceConfigIoT;
export type DeviceConfigAny = DeviceConfig | DeviceConfigWiFi;

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
  | 'Log MQTT Client'
  | 'Log MQTT Payloads'
  | 'Log Serial Numbers'
  | 'Log Debug as Info';

// The user plugin configuration
export interface Config {
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
    devices:                DeviceConfigAny[];
    wildcardTopic:          boolean;
    debug:                  boolean;
    debugFeatures:          DebugFeatures[];
    unregisterOnShutdown:   boolean;
}