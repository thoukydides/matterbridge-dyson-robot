// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonDevice } from './dyson-device-base.js';
import { DYSON_DEVICE_TYPES_360 } from './dyson-device-360.js';
import { DYSON_DEVICE_TYPES_AIR } from './dyson-device-air.js';
import { Config } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MS, UnionToIntersection, formatList, plural } from './utils.js';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { logError } from './log-error.js';
import NodePersist from 'node-persist';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import CONFIG_SCHEMA from '../matterbridge-dyson-robot.schema.json' with { type: 'json' };

// Root MQTT topics defined in the configuration schema
const SCHEMA_ROOT_TOPICS = CONFIG_SCHEMA.definitions.deviceRootTopic.oneOf;

// List of constructors for Dyson devices
const DYSON_DEVICE_TYPES = [
    ...DYSON_DEVICE_TYPES_360,
    ...DYSON_DEVICE_TYPES_AIR
] as const;

// Delay before falling back to using cached status (if any)
// (must be less than Matterbridge's 120 second platform initialisation timeout)
export const MQTT_CACHE_FALLBACK_DELAY = 60 * MS;

// Dyson device factory
export async function createDysonDevice(
    log:        AnsiLogger,
    config:     Config,
    persist:    NodePersist.LocalStorage,
    device:     DeviceConfigMqtt,
    api?:       DysonCloudAPIDevice
): Promise<DysonDevice> {
    // One-off check that the implementation and schema are consistent
    checkDysonDeviceSchemaConsistency(log);

    // Select the appropriate class for this device
    const { rootTopic } = device;
    const deviceClass = DYSON_DEVICE_TYPES.find((device) => device.model.type === rootTopic);
    if (!deviceClass) throw new Error(`Unknown Dyson device type: ${rootTopic}`);

    // Create the MQTT client and wait for it to finish initialising
    const mqtt = new deviceClass.mqttConstructor(log, config, persist, device);
    mqtt.on('error', err => { logError(log, 'MQTT Event', err); });
    await mqtt.waitUntilInitialised(MQTT_CACHE_FALLBACK_DELAY);

    // Create the Dyson device itself
    return new deviceClass(log, config, device, mqtt as UnionToIntersection<typeof mqtt>, api);
}

// Test whether a specific model is supported
export function isSupportedModel(rootTopic: string): boolean {
    return DYSON_DEVICE_TYPES.some((device) => device.model.type === rootTopic);
}

// Check whether the implementation and schema are consistent
let schemaChecked = false;
function checkDysonDeviceSchemaConsistency(log: AnsiLogger): void {
    // Only perform the check once
    if (schemaChecked) return;
    schemaChecked = true;

    // Sets of known topics
    const schemaTopics  = new Set(SCHEMA_ROOT_TOPICS.map(entry   => entry.const));
    const codeTopics    = new Set(DYSON_DEVICE_TYPES.map(device  => device.model.type));

    // Warn about any discrepancies
    const warnIfDifference = (a: Set<string>, b: Set<string>, description: string) => {
        const difference = [...a.difference(b)].sort();
        if (!difference.length) return;
        log.warn(`${plural(difference.length, 'MQTT root topic')} ${description} (${formatList(difference)})`);
    };
    warnIfDifference(schemaTopics, codeTopics, 'in configuration schema but without any implementation');
    warnIfDifference(codeTopics, schemaTopics, 'implemented but not listed in configuration schema');
}