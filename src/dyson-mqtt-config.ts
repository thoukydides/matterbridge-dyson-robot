// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { createHash } from 'crypto';
import {
    DeviceConfig,
    DeviceConfigAny,
    DeviceConfigIoT,
    DeviceConfigMqtt,
    DeviceConfigWiFi
} from './config-types.js';
import { assertIsDefined } from './utils.js';

// Regular expressions to parse Wi-Fi setup SSIDs
const SSID_360EYE_RE = /^(360EYE-)?(?<sn>[A-Z0-9]{3}-[A-Z]{2}-[A-Z0-9]{8,})/;
const SSID_OTHER_RE  = /^DYSON-(?<sn>[A-Z0-9]{3}-[A-Z]{2}-[A-Z0-9]{8,})-(?<type>[0-9]{3}[A-Z]?)$/;

// Dyson 360 Eye uses a different Wi-Fi setup SSID format
const TYPE_360EYE = 'N223';

// Dyson Pure Hot+Cool Link (HP02) SSIDs don't match the MQTT topic and username
const TYPE_MAP = new Map<string, string>([['455A', '455']]);

// Identify the type of credentials provided
export function isConfigWiFi(config: DeviceConfigAny): config is DeviceConfigWiFi {
    return 'wifi_ssid' in config;
}
export function isConfigMqtt(config: DeviceConfigAny): config is DeviceConfigMqtt {
    return 'password' in config;
}
export function isConfigIoT(config: DeviceConfigAny): config is DeviceConfigIoT {
    return 'endpoint' in config;
}

// Convert Wi-Fi setup credentials to local MQTT credentials
export function getDeviceConfigMqtt(config: DeviceConfigAny): DeviceConfig {
    if (isConfigMqtt(config) || isConfigIoT(config)) return config;
    const { wifi_ssid, wifi_password } = config;
    const { root_topic, username } = parseSSID(wifi_ssid);
    const password = hashWifiPassword(wifi_password);
    return { ...config, username, password, root_topic };
}

// Extract the MQTT topic and username from a Wi-Fi setup SSID
function parseSSID(ssid: string): { root_topic: string, username: string } {
    const match =  SSID_360EYE_RE.exec(ssid) ?? SSID_OTHER_RE.exec(ssid);
    if (!match) throw new Error(`Unable to parse Product SSID: ${ssid}`);
    const root_topic    = match.groups?.type ?? TYPE_360EYE;
    const serialNumber  = match.groups?.sn;
    assertIsDefined(serialNumber);
    const username = TYPE_MAP.get(serialNumber) ?? serialNumber;
    return { root_topic, username };
}

// Convert a Wi-Fi password to the form required for MQTT
function hashWifiPassword(password: string): string {
    const sha512 = createHash('sha512').update(password).digest();
    return sha512.toString('base64');
}
