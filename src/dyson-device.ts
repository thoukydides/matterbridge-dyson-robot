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
import { Config, DeviceConfig } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { logError, UnionToIntersection } from './utils.js';

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
    device:     DeviceConfig
): Promise<DysonDevice> {
    // Select the appropriate class for this device
    const { root_topic } = device;
    const deviceClass = DYSON_DEVICE_TYPES.find((device) => device.model.type === root_topic);
    if (!deviceClass) throw new Error(`Unknown Dyson device type: ${root_topic}`);

    // Create the MQTT client and wait for it to finish initialising
    const mqtt = new deviceClass.mqttConstructor(log, config, device);
    mqtt.on('error', err => { logError(log, 'MQTT Event', err); });
    await mqtt.waitUntilInitialised();

    // Create the Dyson device itself
    return new deviceClass(log, config, device, mqtt as UnionToIntersection<typeof mqtt>);
}