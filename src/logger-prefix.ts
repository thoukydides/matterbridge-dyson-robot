// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';

// A logger with an additional prefix
export class PrefixLogger extends AnsiLogger {

    // Create a new logger
    constructor(readonly delegate: AnsiLogger, readonly prefix: string) {
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
        // Call the delegate directly (not super.log) to avoid double-logging
        const savedLogName = this.delegate.logName;
        try {
            this.delegate.logName = `${savedLogName} - ${this.prefix}`;
            this.delegate.log(level, message, ...parameters);
        } finally {
            this.delegate.logName = savedLogName;
        }
    }
}