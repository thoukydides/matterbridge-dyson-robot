// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { createHash } from 'crypto';
import {
    DeviceConfigLocalMqtt,
    DeviceConfigLocalWiFi
} from './config-types.js';
import { assertIsDefined } from './utils.js';

// Regular expressions to parse Wi-Fi setup SSIDs
const SSID_360EYE_RE = /^(360EYE-)?(?<sn>[A-Z0-9]{3}-[A-Z]{2}-[A-Z0-9]{8,})/;
const SSID_OTHER_RE  = /^DYSON-(?<sn>[A-Z0-9]{3}-[A-Z]{2}-[A-Z0-9]{8,})-(?<type>[0-9]{3}[A-Z]?)$/;

// Dyson 360 Eye uses a different Wi-Fi setup SSID format
const TYPE_360EYE = 'N223';

// Dyson Pure Hot+Cool Link (HP02) SSIDs don't match the MQTT topic and username
const TYPE_MAP = new Map<string, string>([['455A', '455']]);

// Convert Wi-Fi setup credentials to local MQTT credentials
export function getDeviceConfigMqtt(config: DeviceConfigLocalWiFi): DeviceConfigLocalMqtt {
    const { ssid, password: wifiPassword } = config;
    const { rootTopic, serialNumber } = parseSSID(ssid);
    const password = hashWifiPassword(wifiPassword);
    return { ...config, serialNumber, password, rootTopic };
}

// Extract the MQTT topic and username from a Wi-Fi setup SSID
function parseSSID(ssid: string): { rootTopic: string, serialNumber: string } {
    const match =  SSID_360EYE_RE.exec(ssid) ?? SSID_OTHER_RE.exec(ssid);
    if (!match) throw new Error(`Unable to parse Product SSID: ${ssid}`);
    const rootTopic     = match.groups?.type ?? TYPE_360EYE;
    const sn            = match.groups?.sn;
    assertIsDefined(sn);
    const serialNumber = TYPE_MAP.get(sn) ?? sn;
    return { rootTopic, serialNumber };
}

// Convert a Wi-Fi password to the form required for MQTT
function hashWifiPassword(password: string): string {
    const sha512 = createHash('sha512').update(password).digest();
    return sha512.toString('base64');
}
