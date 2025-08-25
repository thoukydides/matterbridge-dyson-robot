// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { INSPECT_SINGLE_LINE, MM, MP, MR, RD, SR, ST } from './logger-options.js';
import { Config } from './config-types.js';
import { MS, tryListener } from './utils.js';
import EventEmitter from 'events';
import { DysonMsg } from './dyson-types.js';
import {
    DysonMqttParserConfig,
    DysonMsgAny,
    dysonMqttParse
} from './dyson-mqtt-parse.js';
import {
    DysonMqttSubscribe,
    DysonMqttSubscribeConfig
} from './dyson-mqtt-subscribe.js';
import { DysonMqttConnection } from './dyson-mqtt-connect.js';
import { inspect } from 'util';
import { DysonMQTTFilter, DysonMqttFiltered } from './dyson-mqtt-filter.js';
import { AsyncEventEmitter } from './async-eventemitter.js';
import {
    DeviceConfigMqtt,
    DysonMqttClientLocal,
    DysonMqttClientRemote
} from './dyson-mqtt-client-live.js';
import { DysonMqttClientMock } from './dyson-mqtt-client-mock.js';
import { DysonMqttClient } from './dyson-mqtt-client-base.js';

// Configuration of a Dyson MQTT client
export interface DysonMqttConfig<T> {
    topics:     DysonMqttSubscribeConfig;
    messages:   DysonMqttParserConfig<T>;
}

// Status data, with device reachability
export interface DysonMqttStatusBase {
    reachable:      boolean;
    initialised:    boolean;
    stopped:        boolean;
};
export type DysonMqttStatus<T> = T & DysonMqttStatusBase;

// Events that can be emitted by the MQTT client
export interface DysonMqttEventMapBase {
    error:          [unknown];          // Error event (from EventEmitter)
    subscribed:     [];                 // Online and subscriptions configured
    status:         [];                 // State updated (not necessarily changed)
}
export interface DysonMqttEventMap<T> extends DysonMqttEventMapBase {
    message:        [DysonMsgAny<T>];   // MQTT message received and checked
}

// Tuple of parameters for publishing a message
export type PublishArgs<T, O extends string> = {
    [K in keyof T]: T[K] extends DysonMsg
        ? (Omit<T[K], O | 'msg'> extends Record<string, never>
           ? [T[K]['msg']]
           : [T[K]['msg'], Omit<T[K], O | 'msg'>])
        : never
}[keyof T];

// Minimum disconnection time before indicating device not reachable
const MIN_DOWN_TIME = 5 * MS; // 5 seconds

// Messages that indicate that the device is unreachable
const UNREACHABLE_MESSAGES = ['GOODBYE', 'GONE-AWAY'];

// Non-generic interface
export interface DysonMqttLike extends EventEmitter {
    waitUntilInitialised(): Promise<void>;
    stop(): Promise<void>;
}

// Dyson MQTT client for all device types
export abstract class DysonMqtt<T, S>
    extends AsyncEventEmitter<DysonMqttEventMap<T>> implements DysonMqttLike {

    // The MQTT client
    private mqtt:           DysonMqttClient;
    private mqttConnection: DysonMqttConnection;
    private mqttSubscribe:  DysonMqttSubscribe;
    private mqttFilter:     DysonMQTTFilter;

    // The current status
    readonly status = {
        reachable:      false,
        initialised:    false,
        stopped:        false
    } as DysonMqttStatus<S>;

    // Construct a new MQTT client
    constructor(
        readonly log:           AnsiLogger,
        readonly config:        Config,
        readonly deviceConfig:  DeviceConfigMqtt,
        readonly mqttConfig:    DysonMqttConfig<T>
    ) {
        super({ captureRejections: true });

        // Create the MQTT client
        if ('password' in deviceConfig) {
            this.mqtt = new DysonMqttClientLocal(log, config, deviceConfig);
        } else if ('getCredentials' in deviceConfig) {
            this.mqtt = new DysonMqttClientRemote(log, config, deviceConfig);
        } else {
            this.mqtt = new DysonMqttClientMock(log, config, deviceConfig);
        }
        this.mqtt.on('close', tryListener(this, () => { this.updateReachable('mqtt', false); }));

        // Create an MQTT connection manager
        this.mqttConnection = new DysonMqttConnection(log, config, this.mqtt);

        // Manage MQTT topic subscriptions
        const { rootTopic, serialNumber } = deviceConfig;
        this.mqttSubscribe = new DysonMqttSubscribe(
            log, this.mqtt, config, mqttConfig.topics, rootTopic, serialNumber);
        this.mqttSubscribe.on('error', err => this.emit('error', err));
        this.mqttSubscribe.on('subscribed', () => {
            this.emit('subscribed');
            this.updateReachable('mqtt', true);
        });

        // Handle received MQTT messages
        this.mqttFilter = new DysonMQTTFilter(log);
        this.mqtt.on('message', tryListener(this, (topic, payload) => {
            // Check the received topic and message
            const topicStatus = this.mqttSubscribe.checkTopic(topic);
            const normalise = topicStatus !== 'command';
            const msg = dysonMqttParse<T>(log, mqttConfig.messages, topic, normalise, payload);
            const filter = this.mqttFilter.filter(msg);

            // Dispatch the validated message and indicate a status update
            this.logPayload('receive', topic, msg, filter);
            if (!filter && topicStatus === 'subscribed') {
                this.updateReachable('msg', !UNREACHABLE_MESSAGES.includes(msg.msg));
                this.emit('message', msg);
                this.emit('status');
            }
        }));
    }

    // Update the device reachability, with hysteresis on unreachable indications
    downTimerHandle = new Map<string, NodeJS.Timeout>();
    updateReachable(key: 'mqtt' | 'msg', reachable: boolean): void {
        if (reachable) {
            // Cancel any pending down timer for this reason
            const handle = this.downTimerHandle.get(key);
            clearTimeout(handle);
            this.downTimerHandle.delete(key);

            // Mark the device as reachable if there are no active down timers
            if (!this.status.reachable && this.downTimerHandle.size === 0) {
                this.status.reachable = true;
                this.emit('status');
            }
        } else {
            // Only start down timer if not already running
            if (!this.downTimerHandle.has(key) && this.status.reachable && !this.status.stopped) {
                this.log.debug(`Starting down timer for '${key}'`);
                const handle = setTimeout(() => {
                    // Mark the device as not reachable after a delay
                    if (this.status.reachable) {
                        this.log.error('Unreachable');
                        this.status.reachable = false;
                        this.emit('status');
                    }
                }, MIN_DOWN_TIME);
                this.downTimerHandle.set(key, handle);
            }
        }
    }

    // Wait until the device is reachable and all initial state has been received
    async waitUntilInitialised(): Promise<void> {
        while (!this.status.reachable || !this.status.initialised) {
            await this.onceAsync('status');
        }
    }

    // Stop the MQTT client
    async stop(): Promise<void> {
        this.status.stopped = true;
        await this.mqttConnection.stop();
    }

    // Publish a command
    async publish(...[msg, params]: PublishArgs<T, 'time'>): Promise<void> {
        // Construct the full message
        const time = new Date().toISOString();
        const fullMsg = { msg, ...params, time };
        const payload = JSON.stringify(fullMsg);

        // Publish to the command topic
        const topic = this.mqttSubscribe.commandTopic;
        this.logPayload('publish', topic, fullMsg);
        await this.mqtt.publishAsync(topic, payload, { qos: 1, retain: false });
    }

    // Log received or transmitted message payloads
    logPayload(direction: 'publish' | 'receive', topic: string, payload: DysonMsg, filter?: DysonMqttFiltered): void {
        if (!this.config.debugFeatures.includes('Log MQTT Payloads')) return;

        // List the fixed fields first
        const { msg, time, ...other } = payload;
        const properties = [
            `msg: ${direction === 'publish' ? MP : MR}'${msg}'${MM}`,
            `time: ${RD}'${time}'${MM}`
        ];

        // Include the other fields from the message, unless it is a duplicate
        if (filter === 'duplicate') {
            properties.push('...');
        } else {
            properties.push(...Object.entries(other).sort().map(
                ([key, value]) => `${key}: ${inspect(value, INSPECT_SINGLE_LINE)}`
            ));
        }

        // Log the message (formatting with strikethrough if dropped by filter)
        const object = `${MM}{ ${properties.join(', ')} }${RD}`;
        this.log.debug(filter ? `MQTT ${direction}: ${ST}${object}${SR} (${filter})`
                              : `MQTT ${direction}: ${object} topic '${topic}'`);
    }
}