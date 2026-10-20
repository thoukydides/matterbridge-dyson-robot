// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { formatList } from './utils.js';
import { DebugFeatures } from './config-types.js';

// Regular expressions for different types of sensitive data
const REGEXP_SERIAL_NUMBER = /[A-Z0-9]{3}-?[A-Z]{2}-?[A-Z]{3}[0-9]{4}[A-Z]?/g;
const REGEXP_CLOUD_TOKEN   = /[0-9A-F]{64}-1/g;
const REGEXP_EMAIL         = /[\w-.]+@([\w-]+\.)+[\w-]+/g;
const REGEXP_UUID_LIKE_HEX = /\b(?:[0-9A-F]{2,}-?){4,}\b/ig;

// A logger with filtering and support for an additional prefix
export class FilterLogger extends AnsiLogger {

    // Configuration
    config = new Set<DebugFeatures>();

    // Log level to be used for debug messages
    debugLevel: LogLevel = LogLevel.DEBUG;

    // Create a new logger
    constructor(readonly delegate: AnsiLogger) {
        super({
            extLog:                     delegate,
            logTimestampFormat:         delegate.logTimestampFormat,
            logCustomTimestampFormat:   delegate.logCustomTimestampFormat
        });
    }

    // Get and set the log level (in the delegate logger)
    get logLevel(): LogLevel         { return this.delegate.logLevel; }
    set logLevel(logLevel: LogLevel) { this.delegate.logLevel = logLevel; }

    // Get and set the log name (in the delegate logger)
    get logName(): string            { return this.delegate.logName; }
    set logName(logName: string)     { this.delegate.logName = logName; }

    // Log a message with sensitive data filtered
    override log(level: LogLevel, message: string, ...parameters: unknown[]): void {
        // Allow debug messages to be logged as a different level
        if (level === LogLevel.DEBUG && this.config.has('Log Debug as Info')) {
            level = LogLevel.INFO;
        }

        // Filter the log message and parameters
        const filteredMessage    = this.filterSensitive(message);
        const filteredParameters = parameters.map(p => this.filterSensitive(p));

        // Call the delegate directly (not super.log) to avoid double-logging
        this.delegate.log(level, filteredMessage, ...filteredParameters);
    }

    // Apply configuration
    configure(config: DebugFeatures[]): void {
        for (const feature of config) this.config.add(feature);
    }

    // Filter sensitive data within a log message or parameter
    filterSensitive<T>(value: T): string | T {
        const { filtered, redacted } = this.filterString(String(value));
        let jsonRedacted = true;
        try { jsonRedacted = this.filterString(JSON.stringify(value)).redacted; } catch { /* empty */ }
        return redacted || jsonRedacted ? filtered : value;
    }

    // Filter sensitive data within a string
    filterString(value: string): { filtered: string, redacted: boolean } {
        let filtered = value
            .replace(REGEXP_CLOUD_TOKEN, v => maskToken('TOKEN',    v))
            .replace(REGEXP_EMAIL,       v => maskToken('EMAIL',    v));
        if (!this.config.has('Log Serial Numbers')) {
            filtered = filtered
                .replace(REGEXP_SERIAL_NUMBER,  v => maskToken('SERIAL_NUMBER', v))
                .replace(REGEXP_UUID_LIKE_HEX,  v => maskTokenInHex(v));
        }
        return { filtered, redacted: filtered !== value };
    }
}

// Mask a serial number in a UUID-like hex string
export function maskTokenInHex(hex: string): string {
    // Convert hex to a string and look for a serial number
    const text = Buffer.from(hex.replaceAll('-', ''), 'hex').toString();
    const match = REGEXP_SERIAL_NUMBER.exec(text);
    if (!match) return hex;

    // Extract the original hex strings before and after the match
    const splitHex = (str: string, octets: number): [string, string] => {
        const REGEXP_HEX_OCTET = /[0-9A-F]{2}/ig;
        let match: RegExpExecArray | null;
        do { match = REGEXP_HEX_OCTET.exec(str); } while (octets--);
        const index = match?.index ?? str.length;
        return [str.substring(0, index), str.substring(index)];
    };
    const token = match[0];
    const [pre, rest] = splitHex(hex, match.index);
    const [, post] = splitHex(rest, token.length);

    // Return the hex string with the serial number masked
    return `${pre}${maskToken('SERIAL_NUMBER_HEX', token)}${post}`;
}

// Mask a token, leaving just the first and final few characters
function maskToken(type: string, token: string, details: Record<string, string> = {}): string {
    const showChars = (frac: number, max: number): number => Math.floor(Math.min(token.length * frac, max));
    let masked = `${token.slice(0, showChars(0.25, 6))}...${token.slice(-showChars(0.25, 4))}`;
    const parts = Object.entries(details).map(([key, value]) => `${key}=${value}`);
    if (parts.length) masked += ` (${formatList(parts)})`;
    return `<${type}: ${masked}>`;
}