// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { connect, IClientOptions, MqttClient } from 'mqtt';
import {
    Config,
    DeviceConfig,
    DeviceConfigIoT,
    DeviceConfigMqtt
} from './config-types.js';
import { formatMilliseconds, logError, MS } from './utils.js';
import { setTimeout } from 'node:timers/promises';

// Reconnection back-off timings
const BACKOFF_MIN           =  1 * MS;  // 1 second minimum backoff
const BACKOFF_MAX           = 60 * MS;  // 1 minute maximum backoff
const BACKOFF_FACTOR        = 2;        // Double backoff on each failure
const BACKOFF_RESET_UPTIME  = 10 * MS;  // >10 second connection to use MIN

// Manage a Dyson MQTT broker connection
export abstract class DysonMqttConnection<T extends DeviceConfig = DeviceConfig> {

    // The MQTT client
    readonly mqtt: MqttClient;

    // Abandon reconnection attempts
    terminate       = new AbortController();

    // Backoff for reconnection attempts
    backoff         = BACKOFF_MIN;
    uptimeStart?:   number;

    // Construct a new MQTT client
    constructor(
        readonly log:           AnsiLogger,
        readonly config:        Config,
        readonly deviceConfig:  T,
        brokerUrl:              string,
        extraOptions:           IClientOptions
    ) {
        // MQTT debug logging, if enabled
        let mqttLog: IClientOptions['log'];
        if (this.config.debugFeatures.includes('Log MQTT Client')) {
            mqttLog = (...args: unknown[]): void => { this.log.debug('MQTT client:', ...args); };
        }

        // Common MQTT options
        const options: IClientOptions = {
            log:                        mqttLog,
            keepalive:                  10,         // Max 10 seconds between packets
            manualConnect:              true,       // Disable automatic (re)connection
            reconnectOnConnackError:    false,      // Disable automatic connection retry
            reconnectPeriod:            0,          // Disable automatic reconnection
            resubscribe:                true,       // Resubscribe to topics on reconnect
            rejectUnauthorized:         false,      // Allow self-signed certificates
            protocolId:                 'MQIsdp',   // MQTT version 3.1
            protocolVersion:            3,
            ...extraOptions
        };

        // Create and configure the MQTT client
        this.mqtt = connect(brokerUrl, options);
        this.mqtt.on('connect', () => {
            // Successful connection, so start measuring uptime
            log.info('MQTT client connected to broker');
            if (this.uptimeStart !== undefined) this.log.warn("Unexpected MQTT 'connect' event");
            this.uptimeStart = Date.now();
        }).on('error', err => {
            // Connection attempt failed
            log.error(`MQTT client connection error: ${err.message}`);
            // (Will be followed by 'close' event to trigger reconnection)
        }).on('close', () => {
            // Connection closed, so adjust backoff and retry
            if (this.terminate.signal.aborted) {
                this.log.info('MQTT client connection closed; not reconnecting');
                return;
            } else if (this.uptimeStart) {
                const uptime = Date.now() - this.uptimeStart;
                this.uptimeStart = undefined;
                const description = `MQTT client closed stream after ${formatMilliseconds(uptime)}`;
                if (uptime < BACKOFF_RESET_UPTIME) {
                    // Short connection, so keep the (increased) backoff
                    this.log.warn(description);
                } else {
                    // Stable connection, so reset backoff to its minimum
                    this.log.info(`${description}; resetting reconnection backoff to minimum`);
                    this.backoff = BACKOFF_MIN;
                }
            } else {
                this.log.info('MQTT client closed stream after failed connection attempt');
            }

            // Try to (re)establish the connection again
            void this.reconnect();
        });

        // Attempt the initial connection
        this.log.info('Starting MQTT client...');
        this.mqtt.connect();
    }

    // Attempt a reconnection
    async reconnect(): Promise<void> {
        try {
            // Wait for the backoff before reconnecting
            this.log.info(`MQTT client reconnecting in ${formatMilliseconds(this.backoff)}...`);
            const { signal } = this.terminate;
            await setTimeout(this.backoff, undefined, { signal });

            // Attempt the reconnection
            this.log.info('MQTT client attempting reconnection...');
            this.mqtt.reconnect();

            // Increase backoff for the next attempt
            this.backoff = Math.min(this.backoff * BACKOFF_FACTOR, BACKOFF_MAX);
        } catch (err) {
            if (!(err instanceof Error && err.name === 'AbortError')) {
                logError(this.log, 'MQTT Reconnect', err);
            }
            // (Don't retry if terminated or otherwise failed synchronously)
        }
    }

    // Stop the MQTT client
    async stop(): Promise<void> {
        this.log.info('Stopping MQTT client...');
        this.terminate.abort();
        await this.mqtt.endAsync();
        this.log.info('MQTT client stopped');
    }
}

// Manage a local Dyson MQTT broker connection
export class DysonMqttConnectionLocal extends DysonMqttConnection<DeviceConfigMqtt> {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, deviceConfig: DeviceConfigMqtt) {
        const brokerUrl = `mqtt://${deviceConfig.host}:${deviceConfig.port}`;
        const options: IClientOptions = {
            username:   deviceConfig.username,
            password:   deviceConfig.password
        };
        super(log, config, deviceConfig, brokerUrl, options);
    }
}

// Manage a Dyson IoT cloud MQTT broker connection
export class DysonMqttConnectionIoT extends DysonMqttConnection<DeviceConfigIoT> {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, deviceConfig: DeviceConfigIoT) {
        const brokerUrl = `wss://${deviceConfig.endpoint}/mqtt`;
        const headers: Record<string, string> = {
            [deviceConfig.token_key]:           deviceConfig.token_value,
            'X-Amz-CustomAuthorizer-Name':      deviceConfig.custom_authorizer_name,
            'X-Amz-CustomAuthorizer-Signature': deviceConfig.token_signature
        };
        const options: IClientOptions = {
            clientId:   deviceConfig.client_id,
            wsOptions:  { headers }
        };
        super(log, config, deviceConfig, brokerUrl, options);
    }
}