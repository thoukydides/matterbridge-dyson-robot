// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { PlatformConfig } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { checkers } from './ti/config-types.js';
import { IErrorDetail } from 'ts-interface-checker';
import { deepMerge, getValidationTree } from './utils.js';
import { DEFAULT_CONFIG, PLUGIN_NAME } from './settings.js';
import { Config } from './config-types.js';
import { inspect } from 'util';
import { INSPECT_VERBOSE } from './logger-options.js';

// Check that the configuration is valid
export function checkConfiguration(log: AnsiLogger, config: PlatformConfig): asserts config is Config & PlatformConfig {
    // Apply default values
    Object.assign(config, deepMerge(DEFAULT_CONFIG, config));

    // Ensure that all required fields are provided and are of suitable types
    const checker = checkers.Config;
    checker.setReportedPath('<PLATFORM_CONFIG>');
    const strictValidation = checker.strictValidate(config);
    if (!checker.test(config)) {
        log.error('Plugin configuration errors:');
        logCheckerValidation(log, config, LogLevel.ERROR, strictValidation);
        throw new Error('Invalid plugin configuration');
    }

    // Warn of extraneous fields in the configuration
    if (strictValidation) {
        log.warn('Unsupported fields in plugin configuration will be ignored:');
        logCheckerValidation(log, config, LogLevel.WARN, strictValidation);
    }
}

// Log configuration checker validation errors
function logCheckerValidation(log: AnsiLogger, config: PlatformConfig, level: LogLevel, errors: IErrorDetail[] | null): void {
    const errorLines = errors ? getValidationTree(errors) : [];
    errorLines.forEach(line => { log.log(level, line); });
    log.info(`${PLUGIN_NAME}.config.json:`);
    const configLines = inspect(config, INSPECT_VERBOSE).split('\n');
    configLines.forEach(line => { log.info(`    ${line}`); });
}