// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { assertIsDefined, getValidationTree } from './utils.js';
import { CheckerT, IErrorDetail } from 'ts-interface-checker';
import { checkers as dysonMsgCheckers } from './ti/dyson-types.js';
import { DysonMsg } from './dyson-types.js';
import { INSPECT_VERBOSE } from './logger-options.js';
import { inspect } from 'util';

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

// Parse and check a received MQTT message
export function dysonMqttParse<T>(
    log:        AnsiLogger,
    config:     DysonMqttParserConfig<T>,
    topic:      string,
    normalise:  boolean,
    payload:    Buffer
): DysonMsgAny<T> {

    // Parse a raw message buffer as JSON and normalise property names
    const parseAndNormalise = (text: string): unknown => {
        try {
            const parsed = JSON.parse(text) as unknown;
            return normalise ? normaliseKeys(parsed) : parsed;
        } catch (err) {
            logCheckerValidation(LogLevel.ERROR, text);
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to parse Dyson MQTT message as JSON: ${message}`);
        }
    };

    // Check that a received message is known and matches the expected type
    const assertIsDysonMsg: (payload: unknown) => asserts payload is DysonMsgAny<T> = (payload) => {
        // Check that the message is of the general form expected
        const baseChecker = dysonMsgCheckers.DysonMsg;
        if (!baseChecker.test(payload)) {
            baseChecker.setReportedPath('DysonMsg');
            const validation = baseChecker.validate(payload);
            assertIsDefined(validation);
            logCheckerValidation(LogLevel.ERROR, payload, validation);
            throw new Error('Unexpected structure of Dyson MQTT message');
        }

        // Check whether the message type is known
        const checker = getCheckerForMsg(payload);

        // Check that the message is of the form expected for this type
        const validation = checker.validate(payload);
        if (validation) {
            logCheckerValidation(LogLevel.ERROR, payload, validation);
            throw new Error('Unexpected structure of Dyson MQTT message');
        }
        const strictValidation = checker.strictValidate(payload);
        if (strictValidation) {
            logCheckerValidation(LogLevel.WARN, payload, strictValidation);
            // (Continue processing messages that include unexpected properties)
        }
    };

    // Map a message name to the corresponding type checker
    const getCheckerForMsg = <K extends DysonMsgTypeName<T>>(payload: DysonMsg): CheckerT<T[K]> => {
        const { prefix, checkers } = config;

        // Construct the type name for this message
        const msgPascalCase = kebabToPascalCase(payload.msg);
        const typeName = `${prefix}${msgPascalCase}`;
        const assertIsTypeName: (name: string) => asserts name is K = (name): void => {
            if (name in config.checkers) return;
            logCheckerValidation(LogLevel.ERROR, payload);
            throw new Error(`Unrecognised Dyson MQTT message type: ${name}`);
        };
        assertIsTypeName(typeName);

        // Return the type checker
        const checker = checkers[typeName];
        checker.setReportedPath(typeName);
        return checker;
    };

    // Log checker validation errors
    const logCheckerValidation = (level: LogLevel, payload: unknown, errors?: IErrorDetail[]): void => {
        // Log the formatted message
        log.log(level, `MQTT topic '${topic}':`);
        if (errors) {
            const validationLines = getValidationTree(errors);
            validationLines.forEach(line => { log.log(level, line); });
        }
        const payloadLines = inspect(payload, INSPECT_VERBOSE).split('\n');
        payloadLines.forEach(line => { log.info(`    ${line}`); });
    };

    // Parse and check the message
    const msg = parseAndNormalise(payload.toString());
    assertIsDysonMsg(msg);
    return msg;
}

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