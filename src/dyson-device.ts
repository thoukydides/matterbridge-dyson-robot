// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { DysonDevice } from './dyson-device-base.js';
import {
    DysonDevice360Eye,
    DysonDevice360Heurist,
    DysonDevice360VisNav
} from './dyson-device-360.js';
import {
    DysonDeviceAirCool,
    DysonDeviceAirCoolDesk,
    DysonDeviceAirCoolE,
    DysonDeviceAirCoolK,
    DysonDeviceAirCoolLink,
    DysonDeviceAirCoolLinkDesk,
    DysonDeviceAirHotCool,
    DysonDeviceAirHotCoolE,
    DysonDeviceAirHotCoolK,
    DysonDeviceAirHotCoolLink,
    DysonDeviceAirHotCoolLinkA,
    DysonDeviceAirHumidifyCool,
    DysonDeviceAirHumidifyCoolE,
    DysonDeviceAirHumidifyCoolK,
    DysonDeviceAirBigQuiet
} from './dyson-device-air.js';
import { Config } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { logError, UnionToIntersection } from './utils.js';
import { DeviceConfigMqtt } from './dyson-mqtt-client.js';

// List of constructors for Dyson devices
const DYSON_DEVICE_TYPES = [
    // Dyson robot vacuum device types
    DysonDevice360Eye,
    DysonDevice360Heurist,
    DysonDevice360VisNav,
    // Dyson air treatment device types
    DysonDeviceAirCool,
    DysonDeviceAirCoolDesk,
    DysonDeviceAirCoolE,
    DysonDeviceAirCoolK,
    DysonDeviceAirCoolLink,
    DysonDeviceAirCoolLinkDesk,
    DysonDeviceAirHotCool,
    DysonDeviceAirHotCoolE,
    DysonDeviceAirHotCoolK,
    DysonDeviceAirHotCoolLink,
    DysonDeviceAirHotCoolLinkA,
    DysonDeviceAirHumidifyCool,
    DysonDeviceAirHumidifyCoolE,
    DysonDeviceAirHumidifyCoolK,
    DysonDeviceAirBigQuiet
] as const;

// Dyson device factory
export async function createDysonDevice(
    log:        AnsiLogger,
    config:     Config,
    device:     DeviceConfigMqtt
): Promise<DysonDevice> {
    // Select the appropriate class for this device
    const { rootTopic } = device;
    const deviceClass = DYSON_DEVICE_TYPES.find((device) => device.model.type === rootTopic);
    if (!deviceClass) throw new Error(`Unknown Dyson device type: ${rootTopic}`);

    // Create the MQTT client and wait for it to finish initialising
    const mqtt = new deviceClass.mqttConstructor(log, config, device);
    mqtt.on('error', err => { logError(log, 'MQTT Event', err); });
    await mqtt.waitUntilInitialised();

    // Create the Dyson device itself
    return new deviceClass(log, config, device, mqtt as UnionToIntersection<typeof mqtt>);
}

// Test whether a specific model is supported
export function isSupportedModel(rootTopic: string): boolean {
    return DYSON_DEVICE_TYPES.some((device) => device.model.type === rootTopic);
}