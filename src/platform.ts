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
import { checkConfiguration, getDysonAccount } from './config-check.js';
import { FilterLogger } from './logger-filter.js';
import { RI } from './logger-options.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { createDysonDevice } from './dyson-device.js';
import { DysonDevice } from './dyson-device-base.js';
import { formatList, plural } from './utils.js';
import { PrefixLogger } from './logger-prefix.js';
import {
    DysonCloudAuth,
    DysonCloudLocal,
    DysonCloudRemote
} from './dyson-cloud.js';
import { DeviceConfigMqtt } from './dyson-mqtt-client.js';
import { getDeviceConfigMqtt } from './dyson-mqtt-config.js';
import { logError } from './log-error.js';

// A Dyson devices platform
export class PlatformDyson extends MatterbridgeDynamicPlatform {

    // Strongly typed configuration
    declare config: Config & PlatformConfig;
    declare log:    FilterLogger;

    // Persistent storage
    persist:        NodePersist.LocalStorage;

    // Active devices
    devices:        DysonDevice[] = [];

    // Constructor
    constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
        log.logName = PLATFORM_NAME;
        const filterLog = new FilterLogger(log);
        filterLog.info(`Initialising platform ${PLUGIN_NAME}`);
        super(matterbridge, filterLog, config);

        // Check the dependencies
        checkDependencyVersions(this);

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

    // Handle action button presses in the Matterbridge frontend
    async onAction(action: string, value?: string, id?: string, config?: PlatformConfig): Promise<void> {
        const { frontend } = this.matterbridge;
        this.log.debug(`Action ${PLUGIN_NAME}: ${action}${value ? ` with ${value}` : ''}${id ? ` for schema ${id}` : ''}`);

        // Select the Dyson account configuration to authorise
        if (config && typeof config === 'object' && Object.keys(config).length) {
            this.log.debug(`Action configuration: ${JSON.stringify(config)}`);
        } else {
            this.log.debug('No configuration provided for action; using saved configuration');
            config = this.config;
        }
        const account = getDysonAccount(this.log, config);
        const { email, china } = account;
        this.log.info(`Account: ${email} (${china ? 'china' : 'global'})`);

        // Handle the specific button that was pressed
        const api = new DysonCloudAuth(this.log, this.config, this.persist, account);
        switch (action) {
        case 'startAuth': {
            // Start authorisation for the configured account
            const success = await api.startAuth();
            this.log.warn('Check your email (and spam filters) for a MyDyson message containing an OTP code');
            this.log.warn('Enter the OTP code and click SUBMIT CODE to complete authorisation');
            if (success) {
                frontend.wssSendSnackbarMessage('MyDyson account authorisation started - enter OTP code from email', 5);
            } else {
                frontend.wssSendSnackbarMessage('Continuing previous MyDyson account authorisation', 5, 'warning');
            }
            break;
        }
        case 'finishAuth':
            // Use the provided OTP code to finish authorisation
            await api.finishAuth(value ?? '');
            this.log.warn('MyDyson account access authorised; Restart Matterbridge');
            frontend.wssSendSnackbarMessage('MyDyson account authorised; restart required', 10, 'success');
            frontend.wssSendRestartRequired();
            break;
        default:
            this.log.error(`Unexpected action: ${action}`);
        }
    }

    // Create the devices and clusters when Matterbridge loads the plugin
    override async onStart(reason?: string): Promise<void> {
        this.log.info(`Starting ${PLUGIN_NAME}: ${reason ?? 'none'}`);

        // Initialise persistent storage
        await this.persist.init();

        // Check the configuration
        checkConfiguration(this.log, this.config);
        this.log.configure(this.config.debugFeatures);

        // Convert the configuration to usable device details
        let mappedDevices: DeviceConfigMqtt[];
        switch (this.config.provisioningMethod) {
        case 'Remote Account': {
            // Obtain list of details from the MyDyson account
            const api = new DysonCloudRemote(this.log, this.config, this.persist);
            mappedDevices = await api.getDevices();
            break;
        }
        case 'Local Account': {
            // Cross-reference the configured devices with the MyDyson account
            const api = new DysonCloudLocal(this.log, this.config, this.persist);
            mappedDevices = await api.getDevices();
            break;
        }
        case 'Local Wi-Fi':
            // Derive the MQTT credentials from the configured Wi-Fi setup credentials
            mappedDevices = this.config.devices.map(getDeviceConfigMqtt);
            break;
        case 'Local MQTT':
            // Configuration is already in the required format for local MQTT
            mappedDevices = this.config.devices;
            break;
        }

        // Wait for the platform to start
        await this.ready;

        // Create and register Matter devices for each Dyson device
        await this.clearSelect();
        await Promise.all(mappedDevices.map(async deviceConfig => {
            try {
                // Check whether the device should be created
                const { serialNumber, name: deviceName} = deviceConfig;
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
                    await Promise.all(endpoints.map(async endpoint => {
                        await this.registerDevice(endpoint);
                        await endpoint.postRegister();
                    }));
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