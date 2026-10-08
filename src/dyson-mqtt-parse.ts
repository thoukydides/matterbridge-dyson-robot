// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { assertIsDefined, getValidationTree } from './utils.js';
import { CheckerT, IErrorDetail } from 'ts-interface-checker';
import { checkers as dysonMsgCheckers } from './ti/dyson-types.js';
import { DysonMsg } from './dyson-types.js';
import { INSPECT_VERBOSE } from './logger-options.js';
import { inspect } from 'util';
import { decode, TagDecoder, TagNumber } from 'cbor2';
import 'cbor2/types';

// Message types and checkers
export type DysonMsgAny<T> = {
    [K in keyof T]: T[K] extends DysonMsg ? T[K] : never
}[keyof T];
export type DysonMsgTypeName<T> = Extract<keyof T, string>;
export type DysonMsgCheckers<T> = { [K in DysonMsgTypeName<T>]: CheckerT<T[K]> };

// Configuration required for parsing and checking an MQTT message
export interface DysonMqttParserConfig<T> {
    prefix:     string;                 // Start of message type names
    checkers:   DysonMsgCheckers<T>;    // Checkers for messages types
}

// Parse a received MQTT buffer as JSON and normalise property names
export function dysonMqttParseJSON(log: AnsiLogger, topic: string, normalise: boolean, payload: Buffer): unknown {
    const text = payload.toString();
    try {
        const parsed = JSON.parse(text) as unknown;
        return normalise ? normaliseKeys(parsed) : parsed;
    } catch (cause) {
        logCheckerValidation(log, LogLevel.ERROR, topic, text);
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Failed to parse Dyson MQTT message as JSON: ${message}`, { cause });
    }
};

// If a received MQTT message is CBOR encoded then decode and normalise
export function dysonMqttParseCBOR(log: AnsiLogger, topic: string, normalise: boolean, msg: unknown): unknown {
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
        logCheckerValidation(log, LogLevel.ERROR, topic, msg);
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Failed to parse Dyson MQTT message as CBOR: ${message}`, { cause });
    }
}

// Validate a received Dyson MQTT message
export function assertIsDysonMsg<T>(
    log:        AnsiLogger,
    config:     DysonMqttParserConfig<T>,
    topic:      string,
    msg:        unknown
): asserts msg is DysonMsgAny<T> {

    // Map a message name to the corresponding type checker
    const getCheckerForMsg = <K extends DysonMsgTypeName<T>>(msg: DysonMsg): CheckerT<T[K]> => {
        const { prefix, checkers } = config;

        // Construct the type name for this message
        const msgPascalCase = kebabToPascalCase(msg.msg);
        const typeName = `${prefix}${msgPascalCase}`;
        const assertIsTypeName: (name: string) => asserts name is K = (name): void => {
            if (name in config.checkers) return;
            logCheckerValidation(log, LogLevel.ERROR, topic, msg);
            throw new Error(`Unrecognised Dyson MQTT message type: ${name}`);
        };
        assertIsTypeName(typeName);

        // Return the type checker
        const checker = checkers[typeName];
        checker.setReportedPath(typeName);
        return checker;
    };

    // Check that the message is of the general form expected
    const baseChecker = dysonMsgCheckers.DysonMsg;
    if (!baseChecker.test(msg)) {
        baseChecker.setReportedPath('DysonMsg');
        const validation = baseChecker.validate(msg);
        assertIsDefined(validation);
        logCheckerValidation(log, LogLevel.ERROR, topic, msg, validation);
        throw new Error('Unexpected structure of Dyson MQTT message');
    }

    // Check whether the message type is known
    const checker = getCheckerForMsg(msg);

    // Check that the message is of the form expected for this type
    const validation = checker.validate(msg);
    if (validation) {
        logCheckerValidation(log, LogLevel.ERROR, topic, msg, validation);
        throw new Error('Unexpected structure of Dyson MQTT message');
    }
    const strictValidation = checker.strictValidate(msg);
    if (strictValidation) {
        logCheckerValidation(log, LogLevel.WARN, topic, msg, strictValidation);
        // (Continue processing messages that include unexpected properties)
    }
}

// Log checker validation errors
export function logCheckerValidation(
    log:        AnsiLogger,
    level:      LogLevel,
    topic:      string,
    payload:    unknown,
    errors?:    IErrorDetail[]
): void {
    // Log the formatted message
    log.log(level, `MQTT topic '${topic}':`);
    if (errors) {
        const validationLines = getValidationTree(errors);
        validationLines.forEach(line => { log.log(level, line); });
    }
    const payloadLines = inspect(payload, INSPECT_VERBOSE).split('\n');
    payloadLines.forEach(line => { log.info(`    ${line}`); });
};

// Convert a string from kebab-case (or FLAMING-KEBAB-CASE) to PascalCase
function kebabToPascalCase(str: string): string {
    return str.toLowerCase().split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

// Convert a string from kebab-case or 'space case' to camelCase
function kebabToCamelCase(str: string): string {
    return str.replace(/[-\s]([a-z])/g, (_, letter: string) => letter.toUpperCase());
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