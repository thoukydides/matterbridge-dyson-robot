// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    Matterbridge,
    MatterbridgeDynamicPlatform,
    PlatformConfig
} from 'matterbridge';
import { AnsiLogger, GREEN, LogLevel, RED } from 'matterbridge/logger';
import NodePersist from 'node-persist';
import Path from 'path';
import { checkDependencyVersions } from './check-versions.js';
import { Config } from './config-types.js';
import { checkConfiguration } from './check-configuration.js';
import { FilterLogger } from './logger-filter.js';
import { RI } from './logger-options.js';
import { PLUGIN_NAME } from './settings.js';
import { getDeviceConfigMqtt } from './dyson-mqtt-config.js';
import { createDysonDevice } from './dyson-device.js';
import { DysonDevice } from './dyson-device-base.js';
import { formatList, logError, plural } from './utils.js';
import { PrefixLogger } from './logger-prefix.js';

// A Dyson devices platform
export class PlatformDyson extends MatterbridgeDynamicPlatform {

    // Strongly typed configuration
    declare config: Config & PlatformConfig;

    // Persistent storage
    persist:        NodePersist.LocalStorage;

    // Active devices
    devices:        DysonDevice[] = [];

    // Constructor
    constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
        const filterLog = new FilterLogger(log);
        filterLog.info(`Initialising platform ${PLUGIN_NAME}`);
        super(matterbridge, filterLog, config);

        // Check the dependencies and configuration
        checkDependencyVersions(this);
        checkConfiguration(this.log, config);
        filterLog.configure(config.debugFeatures);

        // Create storage for this plugin (initialised in onStart)
        const persistDir = Path.join(this.matterbridge.matterbridgePluginDirectory, PLUGIN_NAME, 'persist');
        this.persist = NodePersist.create({ dir: persistDir });
    }

    // Check the configuration after it has been updated
    override async onConfigChanged(config: PlatformConfig): Promise<void> {
        this.log.info(`Changed ${PLUGIN_NAME} configuration`);
        checkConfiguration(this.log, config);
        return Promise.resolve();
    }

    // Set the logger level
    override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
        this.log.info(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
        this.log.logLevel = logLevel;
        return Promise.resolve();
    }

    // Create the devices and clusters when Matterbridge loads the plugin
    override async onStart(reason?: string): Promise<void> {
        this.log.info(`Starting ${PLUGIN_NAME}: ${reason ?? 'none'}`);

        // Wait for the platform to start
        await this.ready;
        await this.clearSelect();

        // Initialise persistent storage
        await this.persist.init();

        // Create and register Matter devices for each Dyson device
        await Promise.all(this.config.devices.map(async deviceConfigAny => {
            try {
                // Check whether the device should be created
                const deviceConfig = getDeviceConfigMqtt(deviceConfigAny);
                const { username: serialNumber, name: deviceName} = deviceConfig;
                const deviceLog = new PrefixLogger(this.log, deviceName);
                const device = await createDysonDevice(deviceLog, this.config, deviceConfig);

                // Validate the device as a whole
                this.setSelectDevice(serialNumber, deviceName, undefined, 'hub');
                const validatedDevice = this.validateDevice(serialNumber);

                // Validate the device's main functions
                const entities = device.getEntities();
                const entityResults: string[] = [];
                const validatedEntities = entities.filter(({ name, description }) => {
                    this.setSelectDeviceEntity(serialNumber, name, description, 'component');
                    const result = this.validateEntity(serialNumber, name);
                    entityResults.push(result ? `${GREEN}${name} ✔${RI}` : `${RED}${name} ✘${RI}`);
                    return result;
                }).map(({ name }) => name);

                // Create and register the device's endpoints
                const endpoints = validatedDevice ? device.getEndpoints(validatedEntities) : [];
                if (!endpoints.length) {
                    const lists = !validatedDevice ? ['blackList', 'whiteList'] as const
                        : ['entityBlackList', 'entityWhiteList', 'deviceEntityBlackList'] as const;
                    const filtered = lists.filter(list => this.config[list].length);
                    deviceLog.info(`Device disabled via ${formatList(filtered)}`);
                } else {
                    let description = `Registering ${plural(endpoints.length, 'device')}`;
                    if (entities.length) description += ` with: ${formatList(entityResults)}`;
                    deviceLog.info(description);
                    this.devices.push(device);
                    await Promise.all(endpoints.map(e => this.registerDevice(e)));
                }
            } catch (err) {
                logError(this.log, 'Creating device', err);
            }
        }));
        this.log.info(`Registered ${this.devicesDescription}`);
    }

    // Configure and initialise the devices when the platform is commissioned
    override async onConfigure(): Promise<void> {
        this.log.info(`Configuring ${PLUGIN_NAME}`);
        await super.onConfigure();

        // Configure and start polling the devices
        await Promise.all(this.devices.map(async device => {
            try {
                await device.start();
            } catch (err) {
                logError(device.log, 'Starting device', err);
            }
        }));
        this.log.info(`Configured ${this.devicesDescription}`);
    }

    // Cleanup resources when Matterbridge is shutting down
    override async onShutdown(reason?: string): Promise<void> {
        this.log.info(`Shutting down ${PLUGIN_NAME}: ${reason ?? 'none'}`);
        await super.onShutdown(reason);

        // Stop polling the devices
        await Promise.all(this.devices.map(async device => {
            try {
                await device.stop();
            } catch (err) {
                logError(device.log, 'Stopping device', err);
            }
        }));
        this.log.info(`Stopped ${this.devicesDescription}`);

        // Remove the devices from Matterbridge during development
        if (this.config.unregisterOnShutdown) {
            await this.unregisterAllDevices();
            this.log.info(`Unregistered ${this.devicesDescription}`);
        }
    }

    // Description of the registered device(s)
    get devicesDescription(): string {
        return plural(this.devices.length, 'Dyson device');
    }
}