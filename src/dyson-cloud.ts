// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import {
    Config,
    ConfigLocalAccount,
    ConfigRemoteAccount,
    DeviceConfigLocalMqtt,
    DysonAccount,
    DysonAccountLogin
} from './config-types.js';
import { createDecipheriv } from 'crypto';
import {
    DysonAccountStatus,
    DysonIoTCredentialsResponse,
    DysonLocalBrokerCredentials
} from './dyson-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import NodePersist from 'node-persist';
import { DysonCloudAPI } from './dyson-cloud-api.js';
import { assertIsDefined, columns, formatMilliseconds, MS, plural } from './utils.js';
import { isSupportedModel } from './dyson-device.js';
import { DeviceConfigMqtt, DeviceConfigRemoteMqtt } from './dyson-mqtt-client-live.js';
import { DysonCloudStatusCodeError } from './dyson-cloud-error.js';
import { setTimeout } from 'node:timers/promises';
import { logError } from './log-error.js';
import { PrefixLogger } from './logger-prefix.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';

// Devices accessed via IoT MQTT can also use the Dyson cloud API
type WithAPI<T> = T & { api?: DysonCloudAPIDevice; };
export type DeviceConfigMqttWithApi = WithAPI<DeviceConfigMqtt>;

// Persistent storage for an account
interface PersistTokenData {
    token:          string;
    created:        number;
}
interface PersistChallengeData {
    challengeId:    string;
    created:        number;
}
interface PersistData {
    token:          PersistTokenData;
    challenge:      PersistChallengeData;
}
type PersistKey = keyof PersistData;

// Cache of recently issued AWS IoT credentials
interface IoTCredentialsData {
    credentials:    DysonIoTCredentialsResponse;
    created:        number;
}

// Retry back-off timings
const BACKOFF_MIN           =  1 * MS;  // 1 second minimum backoff
const BACKOFF_MAX           = 60 * MS;  // 1 minute maximum backoff
const BACKOFF_FACTOR        = 2;        // Double backoff on each failure

// A Dyson cloud API interface
export class DysonCloud<T extends Config = Config> {

    // The Dyson API
    readonly api: Promise<DysonCloudAPI>;

    // Construct a new Dyson cloud API interface
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    T,
        readonly persist:   NodePersist.LocalStorage,
        readonly account?:  DysonAccount
    ) {
        this.api = this.createApi();
    }

    // Create a Dyson API client, with Bearer token if available
    async createApi(): Promise<DysonCloudAPI> {
        let china = false;
        let token: string | undefined;

        // Attempt to use the configuration to configure the API client
        if (this.account) {
            china = this.account.china;
            if ('token' in this.account) {
                // Configuration provides the Bearer token explicitly
                token = this.account.token;
                this.log.debug(`Using configured MyDyson account token: ${token}`);
            } else {
                // Attempt to use the email and password to find a stored token
                const persist = await this.getPersistent(this.account, 'token');
                if (persist) {
                    token = persist.token;
                    const age = formatMilliseconds(Date.now() - persist.created);
                    this.log.debug(`MyDyson account authorised ${age} ago: ${token}`);
                } else {
                    this.log.warn('MyDyson account requires authorisation');
                }
            }
        } else {
            this.log.debug('No MyDyson account configuration provided');
        }

        // Create the API client
        const api = new DysonCloudAPI(this.log, this.config, china, token);

        // Perform a dummy version read before using the API for anything else
        await api.getVersion();
        return api;
    }

    // Construct a persistent storage key from account details
    getPersistentStorageKey(account: DysonAccountLogin, type: PersistKey): string {
        const { email } = account;
        return `${email}:${type}`;
    }

    // Retrieve stored data for an account, if any
    async getPersistent<K extends PersistKey>(account: DysonAccountLogin, type: K): Promise<PersistData[K] | undefined> {
        const key = this.getPersistentStorageKey(account, type);
        return await this.persist.getItem(key) as PersistData[K] | undefined;
    }

    // Store new data for an account
    async setPersistent<K extends PersistKey>(account: DysonAccountLogin, type: K, value: PersistData[K]): Promise<void> {
        const key = this.getPersistentStorageKey(account, type);
        await this.persist.setItem(key, value);
    }
}

// A Dyson cloud API interface for authorising the account
export class DysonCloudAuth extends DysonCloud {

    // Construct a new Dyson cloud API interface
    constructor(
        log:                AnsiLogger,
        config:             Config,
        persist:            NodePersist.LocalStorage,
        readonly account:   DysonAccountLogin
    ) {
        super(log, config, persist, account);
    }

    // Start authentication
    async startAuth(): Promise<boolean> {
        const { email } = this.account;
        const api = await this.api;

        // Check that the email address is registered
        this.log.debug(`Checking email address: ${email}`);
        const userStatus = await api.getUserStatus(email);
        if (userStatus.accountStatus !== DysonAccountStatus.Active) {
            throw new Error(`User account ${email} is not active`);
        }

        try {
            // Start authorisation
            this.log.debug(`Starting authorisation for ${email}`);
            const challengeId = await api.startAuthorisation(email);

            // Authorisation started, so save the challenge ID
            this.log.info(`Account authorisation started: ${challengeId}`);
            const persist: PersistChallengeData = { challengeId, created: Date.now() };
            await this.setPersistent(this.account, 'challenge', persist);
            return true;
        } catch (err) {
            if (err instanceof DysonCloudStatusCodeError && err.statusCode === 429) {
                // Too many requests, so check for a previous challenge
                const challenge = await this.getPersistent(this.account, 'challenge');
                if (challenge) {
                    const { challengeId, created } = challenge;
                    const age = formatMilliseconds(Date.now() - created);
                    this.log.info(`Too many requests; continuing previous authorisation started ${age} ago: ${challengeId}`);
                    return false;
                } else {
                    this.log.warn('Too many requests; no previous authorisation attempt found');
                }
            }
            throw err;
        }
    }

    // Finish authentication
    async finishAuth(otpCode: string): Promise<void> {
        const { email, password } = this.account;
        const api = await this.api;

        // Find the matching challenge ID
        const challenge = await this.getPersistent(this.account, 'challenge');
        if (!challenge) {
            throw new Error(`No authorisation challenge found for ${email}`);
        }

        // Attempt to complete authorisation
        const { challengeId } = challenge;
        this.log.debug(`Completing authorisation for ${email}: ${challengeId}`);
        const authorised = await api.completeAuthorisation(challengeId, email, otpCode, password);

        // Authorisation complete, so store the token
        const { token } = authorised;
        this.log.info(`Account authorisation complete: ${token}`);
        const persist: PersistTokenData = { token, created: Date.now() };
        await this.setPersistent(this.account, 'token', persist);
    }
}

// A Dyson cloud API interface for remote access using account configuration
export class DysonCloudRemote extends DysonCloud<ConfigRemoteAccount> {

    // Cache of recently issued credentials
    readonly cache = new Map<string, IoTCredentialsData>();

    // Construct a new Dyson cloud API interface
    constructor(
        log:        AnsiLogger,
        config:     ConfigRemoteAccount,
        persist:    NodePersist.LocalStorage
    ) {
        super(log, config, persist, config.dysonAccount);
    }

    // Retrieve the list of devices in the account
    async getDevices(): Promise<WithAPI<DeviceConfigRemoteMqtt>[]> {
        // Retrieve a list of devices associated with the account
        const api = await this.api;
        const manifest = await api.getManifest();

        // Extract details of the devices supported by this plugin
        const rows: string[][] = [['Serial Number', 'Name', 'MQTT', 'Model', 'Product Name', 'Firmware', 'Status']];
        const deviceConfigs: WithAPI<DeviceConfigRemoteMqtt>[] = [];
        for (const device of manifest) {
            const { serialNumber, model, type, productName, connectedConfiguration } = device;
            const firmware = connectedConfiguration?.firmware.version;
            const name = device.name ?? productName;
            const deviceLog = new PrefixLogger(this.log, name);
            let status: string;
            if (isSupportedModel(type)) {
                assertIsDefined(device.connectedConfiguration);
                status = 'Supported';
                const { mqttRootTopicLevel: rootTopic } = device.connectedConfiguration.mqtt;
                const deviceApi = api.createDeviceClient(deviceLog, device);
                const getCredentials = async () => this.getIoT(deviceApi);
                deviceConfigs.push({ name, serialNumber, rootTopic, getCredentials, api: deviceApi });
            } else status = '(unsupported)';
            rows.push([serialNumber, `"${name}"`, type, model, productName, firmware ?? '?', status]);
        }
        this.log.info(`${plural(manifest.length, 'device')} in account,`
                    + ` ${plural(deviceConfigs.length, 'device')} selected:`);
        columns(rows).forEach(line => { this.log.info(`    ${line}`); });

        // Return the remote MQTT details of the selected devices
        return deviceConfigs;
    }

    // Retrieve the AWS IoT credentials for a single device
    async getIoT(api: DysonCloudAPIDevice): Promise<DysonIoTCredentialsResponse> {
        const { log, serialNumber } = api;
        let backoff = BACKOFF_MIN;
        for (let count = 1;; ++count) {
            try {
                // Try to retrieve the credentials, caching the result
                log.info(`Retrieving AWS IoT credentials (attempt #${count})`);
                const credentials = await api.getIoTCredentials();
                this.cache.set(serialNumber, { credentials, created: Date.now() });
                return credentials;
            } catch (err) {
                // Handle the error
                if (err instanceof DysonCloudStatusCodeError) {
                    switch (err.statusCode) {
                    case 401:
                        // Unauthorised
                        log.error('MyDyson account token expired: giving up');
                        throw err;
                    case 429: {
                        // Too many requests, so use a cached result
                        const cached = this.cache.get(serialNumber);
                        if (cached) {
                            const { credentials, created } = cached;
                            const age = formatMilliseconds(Date.now() - created);
                            log.warn(`Too many requests; trying credentials issued ${age} ago`);
                            return credentials;
                        }
                        break;
                    }
                    }
                }
                logError(log, 'Get IoT Credentials', err);

                // Delay before the next attempt
                log.info(`Retrying AWS IoT credential fetch in ${formatMilliseconds(backoff)}...`);
                await setTimeout(backoff);
                backoff = Math.min(backoff * BACKOFF_FACTOR, BACKOFF_MAX);
            }
        }
    }
}

// A Dyson cloud API interface for local access using account configuration
export class DysonCloudLocal extends DysonCloud<ConfigLocalAccount> {

    // Construct a new Dyson cloud API interface
    constructor(
        log:        AnsiLogger,
        config:     ConfigLocalAccount,
        persist:    NodePersist.LocalStorage
    ) {
        super(log, config, persist, config.dysonAccount);
    }

    // Retrieve the list of devices in the account
    async getDevices(): Promise<WithAPI<DeviceConfigLocalMqtt>[]> {
        // Retrieve a list of devices associated with the account
        const api = await this.api;
        const manifest = await api.getManifest();

        // Attempt to find details in the manifest for each configured device
        const deviceConfigs: WithAPI<DeviceConfigLocalMqtt>[] = [];
        for (const deviceConfig of this.config.devices) {
            const { serialNumber } = deviceConfig;
            const device = manifest.find(d => d.serialNumber === serialNumber);
            if (device) {
                assertIsDefined(device.connectedConfiguration);
                const { localBrokerCredentials, mqttRootTopicLevel: rootTopic } = device.connectedConfiguration.mqtt;
                const name = device.name ?? device.productName;
                const deviceLog = new PrefixLogger(this.log, name);
                const deviceApi = api.createDeviceClient(deviceLog, device);
                const password = decodeLocalBrokerCredentials(localBrokerCredentials).apPasswordHash;
                deviceConfigs.push({ ...deviceConfig, name, password, rootTopic, api: deviceApi });
            } else {
                this.log.error(`Configured device ${serialNumber} is not in MyDyson account`);
            }
        }

        // Next display a summary of all devices in the account
        const rows: string[][] = [['Serial Number', 'Name', 'MQTT', 'Model', 'Product Name', 'Firmware', 'Status']];
        for (const device of manifest) {
            const { serialNumber, name, model, type, productName, connectedConfiguration } = device;
            const firmware = connectedConfiguration?.firmware.version;
            const matched = deviceConfigs.find(d => d.serialNumber === serialNumber);
            let status: string;
            if (matched)                        status = `= ${matched.host}:${matched.port}`;
            else if (isSupportedModel(type))    status = '(unconfigured)';
            else                                status = '(unsupported)';
            rows.push([serialNumber, `"${name}"`, type, model, productName, firmware ?? '?', status]);
        }
        this.log.info(`${plural(manifest.length, 'device')} in MyDyson account,`
                    + ` ${plural(deviceConfigs.length, 'device')} selected:`);
        columns(rows).forEach(line => { this.log.info(`    ${line}`); });

        // Return the remote MQTT details of the selected devices
        return deviceConfigs;
    }
}

// Decode local MQTT broker credentials
function decodeLocalBrokerCredentials(localBrokerCredentials: string): DysonLocalBrokerCredentials {
    // First decode as a base64 string
    const input = Buffer.from(localBrokerCredentials, 'base64');

    // Next decrypt using a fixed AES key and IV
    const key = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const iv = Buffer.alloc(16); // (all zeros)
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(input), decipher.final()]).toString();

    // Finally parse the result as a JSON string
    const parsed = JSON.parse(decrypted) as unknown;
    if (!checkers.DysonLocalBrokerCredentials.test(parsed)) {
        throw new Error(`Unexpected local broker credentials format: ${decrypted}`);
    }
    return parsed;
}