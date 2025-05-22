// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import EventEmitter from 'events';
import {
    connect,
    ErrorWithReasonCode,
    IClientOptions,
    IConnackPacket,
    IPublishPacket,
    MqttClient
} from 'mqtt';
import { Config, DeviceConfigLocalMqtt } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MaybePromise } from 'matterbridge/matter';
import { isDeepStrictEqual } from 'util';
import { DysonIoTCredentialsResponse } from './dyson-cloud-types.js';

// Internally generated device configuration for Remote Account
export interface DeviceConfigRemoteMqtt {
    name:           string;
    serialNumber:   string;
    rootTopic:      string;
    getCredentials: () => Promise<DysonIoTCredentialsResponse>;
}
export type DeviceConfigMqtt = DeviceConfigLocalMqtt | DeviceConfigRemoteMqtt;

// Events that can be forwarded from the MQTT client
export interface DysonMqttClientEventMap {
    close:          [];
    connect:        [packet: IConnackPacket];
    error:          [error: Error | ErrorWithReasonCode];
    message:        [topic: string, payload: Buffer, packet: IPublishPacket];
}

// (Re)connections options for the MQTT client
export interface DysonMqttClientOptions {
    brokerUrl:      string;
    options:        IClientOptions;
}

// Default MQTT options
const DEFAULT_OPTIONS: IClientOptions = {
    keepalive:                  10,         // Max 10 seconds between packets
    manualConnect:              true,       // Disable automatic (re)connection
    reconnectOnConnackError:    false,      // Disable automatic connection retry
    reconnectPeriod:            0,          // Disable automatic reconnection
    resubscribe:                true,       // Resubscribe to topics on reconnect
    rejectUnauthorized:         false,      // Allow self-signed certificates
    protocolId:                 'MQIsdp',   // MQTT version 3.1
    protocolVersion:            3
};

// A Dyson MQTT client that supports creating a new client for each connection
export abstract class DysonMqttClient extends EventEmitter<DysonMqttClientEventMap> {

    // The current MQTT client and its options
    private delegate?:      MqttClient;
    private clientOptions?: DysonMqttClientOptions;
    private count = 0;

    // Construct a new MQTT client
    constructor(readonly log: AnsiLogger, readonly config: Config) {
        super({ captureRejections: true });
    }

    // Obtain the (re)connection options
    protected abstract getConnectionOptions(): MaybePromise<DysonMqttClientOptions>;

    // Destroy an MQTT client
    private async destroyClient(mqtt: MqttClient): Promise<void> {
        this.log.debug('Cleaning up MQTT client');

        // Remove any previous event listeners, if any
        mqtt.removeAllListeners('close');
        mqtt.removeAllListeners('connect');
        mqtt.removeAllListeners('error');
        mqtt.removeAllListeners('message');

        // Close the client
        await mqtt.endAsync();
    }

    // Create a new MQTT client
    private createClient(clientOptions: DysonMqttClientOptions): MqttClient {
        this.log.debug(`Creating MQTT client #${++this.count}`);

        // MQTT debug logging, if enabled
        let log: IClientOptions['log'];
        if (this.config.debugFeatures.includes('Log MQTT Client')) {
            const logPrefix = `MQTT client #${this.count}:`;
            log = (...args: unknown[]): void => { this.log.debug(logPrefix, ...args); };
        }

        // Create the new client
        const { brokerUrl, options } = clientOptions;
        const mqtt = connect(brokerUrl, { ...DEFAULT_OPTIONS, log, ...options });

        // Add the new listeners to forward events
        mqtt.on('close',   (...args) => this.emit('close',   ...args));
        mqtt.on('connect', (...args) => this.emit('connect', ...args));
        mqtt.on('error',   (...args) => this.emit('error',   ...args));
        mqtt.on('message', (...args) => this.emit('message', ...args));
        return mqtt;
    }

    // Start (re)connecting the MQTT client (resolves after initiating connect)
    async connect(): Promise<void> {
        // Check whether a new client is required
        const clientOptions = await this.getConnectionOptions();
        if (isDeepStrictEqual(clientOptions, this.clientOptions)) {
            // Connection options are unchanged, so just reconnect
            this.log.debug('Reconnecting existing MQTT client...');
            this.mqtt.reconnect();
        } else {
            // Clean-up the old MQTT client, if any
            if (this.delegate) await this.destroyClient(this.delegate);

            // Create a new MQTT client
            this.clientOptions = structuredClone(clientOptions);
            this.delegate = this.createClient(clientOptions);

            // Initiate the connection
            this.log.debug('Connecting new MQTT client...');
            this.delegate.connect();
        }
    }

    // The current MQTT client
    get mqtt(): MqttClient {
        if (!this.delegate) throw new Error('No MQTT client');
        return this.delegate;
    }

    // Forward other MQTT client methods
    async publishAsync  (...args: Parameters<MqttClient['publishAsync'  ]>) { return this.mqtt.publishAsync  (...args); }
    async subscribeAsync(...args: Parameters<MqttClient['subscribeAsync']>) { return this.mqtt.subscribeAsync(...args); }
    async endAsync      (...args: Parameters<MqttClient['endAsync'      ]>) { return this.mqtt.endAsync      (...args); }
}

// A Dyson MQTT client using a local network connection
export class DysonMqttClientLocal extends DysonMqttClient {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, readonly deviceConfig: DeviceConfigLocalMqtt) {
        super(log, config);
    }

    // Obtain the (re)connection options
    protected getConnectionOptions(): DysonMqttClientOptions {
        const { host, port, serialNumber, password } = this.deviceConfig;
        const brokerUrl = `mqtt://${host}:${port}`;
        const options: IClientOptions = { username: serialNumber, password };
        return { brokerUrl, options };
    }
}

// A Dyson MQTT client using a AWS IoT connection via websockets
export class DysonMqttClientRemote extends DysonMqttClient {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, readonly deviceConfig: DeviceConfigRemoteMqtt) {
        super(log, config);
    }

    // Obtain the (re)connection options
    protected async getConnectionOptions(): Promise<DysonMqttClientOptions> {
        const credentials = await this.deviceConfig.getCredentials();
        const { Endpoint } = credentials;
        const { ClientId, CustomAuthorizerName, TokenKey, TokenSignature, TokenValue } = credentials.IoTCredentials;

        // Prepare and return the connection options
        const brokerUrl = `wss://${Endpoint}/mqtt`;
        const headers: Record<string, string> = {
            [TokenKey]:                         TokenValue,
            'X-Amz-CustomAuthorizer-Name':      CustomAuthorizerName,
            'X-Amz-CustomAuthorizer-Signature': TokenSignature
        };
        const options: IClientOptions = { clientId: ClientId, wsOptions: { headers } };
        return { brokerUrl, options };
    }
}