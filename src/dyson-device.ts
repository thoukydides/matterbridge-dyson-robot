// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonDevice, DysonDeviceModel } from './dyson-device-base.js';
import { DYSON_DEVICE_TYPES_360 } from './dyson-device-360.js';
import { DYSON_DEVICE_TYPES_AIR } from './dyson-device-air.js';
import { Config } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MS, UnionToIntersection, formatList, plural } from './utils.js';
import { logError } from './log-error.js';
import NodePersist from 'node-persist';
import CONFIG_SCHEMA from '../matterbridge-dyson-robot.schema.json' with { type: 'json' };
import { DeviceConfigMqttWithApi } from './dyson-cloud.js';

// Root MQTT topics defined in the configuration schema
const SCHEMA_ROOT_TOPICS = CONFIG_SCHEMA.definitions.deviceRootTopic.oneOf;

// List of constructors for Dyson devices
const DYSON_DEVICE_TYPES = [
    ...DYSON_DEVICE_TYPES_360,
    ...DYSON_DEVICE_TYPES_AIR
] as const;
type DysonDeviceType = typeof DYSON_DEVICE_TYPES[number];

// Delay before falling back to using cached status (if any)
// (must be less than Matterbridge's 120 second platform initialisation timeout)
export const MQTT_CACHE_FALLBACK_DELAY = 60 * MS;

// Dyson device factory
export async function createDysonDevice(
    log:        AnsiLogger,
    config:     Config,
    persist:    NodePersist.LocalStorage,
    device:     DeviceConfigMqttWithApi
): Promise<DysonDevice> {
    // One-off check that the implementation and schema are consistent
    checkDysonDeviceSchemaConsistency(log);

    // Select the appropriate class for this device
    const deviceClass = selectDeviceClass(log, device);

    // Create the MQTT client and wait for it to finish initialising
    const mqtt = new deviceClass.mqttConstructor(log, config, persist, device);
    mqtt.on('error', err => { logError(log, 'MQTT Event', err); });
    await mqtt.waitUntilInitialised(MQTT_CACHE_FALLBACK_DELAY);

    // Create the Dyson device itself
    return new deviceClass(log, config, device, mqtt as UnionToIntersection<typeof mqtt>, device.api);
}

// Test whether a specific model is supported
export function isSupportedModel(rootTopic: string): boolean {
    return DYSON_DEVICE_TYPES.some((device) => device.model.type === rootTopic);
}

// Select the most appropriate device type
function selectDeviceClass(log: AnsiLogger, device: DeviceConfigMqttWithApi): DysonDeviceType {
    // Find all classes that support this root topic
    const { rootTopic, variant } = device;
    let description = `MQTT root topic ${rootTopic}`;
    const allCandidates = DYSON_DEVICE_TYPES.filter(({ model }) => model.type === rootTopic);
    if (!allCandidates.length) throw new Error(`Unsupported ${description}`);

    // If a variant was specified then use it to refine the selection
    let candidates = allCandidates;
    if (variant !== undefined) {
        // Select the subset that match the product variant, if supplied
        description += ` variant ${variant}`;
        const getVariants = (model: DysonDeviceModel): string[] | undefined => model.variants;
        const getVariantMatches = (withoutVariant = false): DysonDeviceType[] =>
            allCandidates.filter(candidate => getVariants(candidate.model)?.includes(variant) ?? withoutVariant);
        candidates = getVariantMatches(false);
        if (!candidates.length) candidates = getVariantMatches(true);
    } else {
        description += ' (no variant)';
    }

    // Use the first candidate (if there are multiples)
    if (!candidates[0]) throw new Error(`Unsupported ${description}`);
    if (1 < candidates.length) {
        const names = candidates.map(({ model }) => `${model.name} (${model.number})`);
        log.warn(`Multiple implementations found for ${description}; using ${names[0]}`);
        log.warn(`${plural(names.length - 1, 'Alternative implementation')}: ${formatList(names.slice(1))}`);
    }
    return candidates[0];
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

    // Check that devices sharing a type have distinct variants
    const topicVariants = new Map<string, Set<string>>();
    const topicsWithDuplicates = new Set<string>;
    for (const { model } of DYSON_DEVICE_TYPES) {
        const topic = model.type;
        const variants = new Set('variants' in model ? model.variants : ['∅']);
        const seen = topicVariants.get(topic) ?? new Set<string>();
        if (seen.intersection(variants).size) topicsWithDuplicates.add(topic);
        topicVariants.set(topic, seen.union(variants));
    }
    if (topicsWithDuplicates.size) {
        log.warn(`${plural(topicsWithDuplicates.size, 'MQTT root topic')} with non-discriminated variants`
               + ` (${formatList([...topicsWithDuplicates].sort())})`);
    }
}