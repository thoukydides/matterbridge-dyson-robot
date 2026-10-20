// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { checkers as dysonMsgCheckers } from './ti/dyson-types.js';
import { decode, TagDecoder, TagNumber } from 'cbor2';
import 'cbor2/types';
import { logCheckerValidation } from './ti-tagged-checker.js';

// Parse a received MQTT buffer as JSON and normalise property names
export function dysonMqttParseJSON(log: AnsiLogger, context: string, normalise: boolean, payload: Buffer): unknown {
    const text = payload.toString();
    try {
        const parsed = JSON.parse(text) as unknown;
        return normalise ? normaliseKeys(parsed) : parsed;
    } catch (cause) {
        logCheckerValidation(log, LogLevel.ERROR, context, text);
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Failed to parse Dyson MQTT message as JSON: ${message}`, { cause });
    }
};

// If a received MQTT message is CBOR encoded then decode and normalise
export function dysonMqttParseCBOR(log: AnsiLogger, context: string, normalise: boolean, msg: unknown): unknown {
    if (!dysonMsgCheckers.DysonMsgCBOR.strictTest(msg)) return msg;
    try {
        // Decode the CBOR, converting date since epoch to ISO datetime string
        const octets = new Uint8Array(Buffer.from(msg.bin, 'base64'));
        const decoded = decode(octets, { tags: new Map<TagNumber, TagDecoder>([
            [1, ({ contents }) => new Date((contents as number) * 1000).toISOString()]
        ])});

        // Normalise the keys and rename the "tmsp" field to "time"
        const normalised = normalise ? normaliseKeys(decoded) : decoded;
        if (normalised === null || typeof normalised !== 'object')            return normalised;
        if (!('tmsp' in normalised) || typeof normalised.tmsp !== 'string')   return normalised;
        const { tmsp, ...rest } = normalised;
        return { time: tmsp, ...rest };
    } catch (cause) {
        logCheckerValidation(log, LogLevel.ERROR, context, msg);
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Failed to parse Dyson MQTT message as CBOR: ${message}`, { cause });
    }
}

// Recursively convert property names from snake-case to camelCase
function normaliseKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) {
        return obj.map(item => normaliseKeys(item));
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) =>
            [kebabToCamelCase(key), normaliseKeys(value)]));
    }
    return obj;
}

// Convert a string from kebab-case or 'space case' to camelCase
function kebabToCamelCase(str: string): string {
    return str.replace(/[-\s]([a-z])/g, (_, letter: string) => letter.toUpperCase());
}