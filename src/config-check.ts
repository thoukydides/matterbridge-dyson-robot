// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { PlatformConfig } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { checkers } from './ti/config-types.js';
import { CheckerT, IErrorDetail } from 'ts-interface-checker';
import { deepMerge, getValidationTree } from './utils.js';
import { DEFAULT_CONFIG, PLUGIN_NAME } from './settings.js';
import { Config, DysonAccountLogin, ProvisioningMethod } from './config-types.js';
import { inspect } from 'util';
import { INSPECT_VERBOSE } from './logger-options.js';

// Check that the configuration is valid
export function checkConfiguration(log: AnsiLogger, config: PlatformConfig): asserts config is Config & PlatformConfig {
    // Apply default values
    Object.assign(config, deepMerge(DEFAULT_CONFIG, config));

    // Pick the most appropriate checker for the configuration
    const PROVISIONING_CHECKER = new Map<string, CheckerT<Config>>([
        ['Remote Account',  checkers.ConfigRemoteAccount],
        ['Local Account',   checkers.ConfigLocalAccount],
        ['Local Wi-Fi',     checkers.ConfigLocalWiFi],
        ['Local MQTT',      checkers.ConfigLocalMqtt]
    ] satisfies [ProvisioningMethod, CheckerT<Config>][]);
    const checker = PROVISIONING_CHECKER.get(config.provisioningMethod as string) ?? checkers.Config;

    // Ensure that all required fields are provided and are of suitable types
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

// Extract a validated dysonAccount from the (possibly incomplete) configuration
export function getDysonAccount(log: AnsiLogger, config: PlatformConfig): DysonAccountLogin {
    const account = config.dysonAccount;
    const checker = checkers.DysonAccountLogin;
    checker.setReportedPath('<PLATFORM_CONFIG>.dysonAccount');
    const strictValidation = checker.strictValidate(account);
    if (!checker.test(account)) {
        log.error('Dyson account configuration errors:');
        logCheckerValidation(log, config, LogLevel.ERROR, strictValidation);
        throw new Error('Invalid Dyson account configuration');
    }
    return account;
}

// Log configuration checker validation errors
function logCheckerValidation(log: AnsiLogger, config: PlatformConfig, level: LogLevel, errors: IErrorDetail[] | null): void {
    const errorLines = errors ? getValidationTree(errors) : [];
    errorLines.forEach(line => { log.log(level, line); });
    log.info(`${PLUGIN_NAME}.config.json:`);
    const configLines = inspect(config, INSPECT_VERBOSE).split('\n');
    configLines.forEach(line => { log.info(`    ${line}`); });
}