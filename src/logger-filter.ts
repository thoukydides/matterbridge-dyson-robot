// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { formatList } from './utils.js';
import { DebugFeatures } from './config-types.js';

// Regular expressions for different types of sensitive data
const REGEXP_SERIAL_NUMBER = /[A-Z0-9]{3}-[A-Z]{2}-[A-Z0-9]{8}/g;
const REGEXP_CLOUD_TOKEN   = /[0-9A-F]{64}-1/g;
const REGEXP_EMAIL         = /[\w-.]+@([\w-]+\.)+[\w-]+/g;

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
            filtered = filtered.replace(REGEXP_SERIAL_NUMBER, v => maskToken('SERIAL_NUMBER', v));
        }
        return { filtered, redacted: filtered !== value };
    }
}

// Mask a token, leaving just the first and final few characters
function maskToken(type: string, token: string, details: Record<string, string> = {}): string {
    let masked = `${token.slice(0, 4)}...${token.slice(-8)}`;
    const parts = Object.entries(details).map(([key, value]) => `${key}=${value}`);
    if (parts.length) masked += ` (${formatList(parts)})`;
    return `<${type}: ${masked}>`;
}