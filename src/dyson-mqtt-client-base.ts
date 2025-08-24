// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import EventEmitter from 'events';
import { AnsiLogger } from 'matterbridge/logger';
import {
    ErrorWithReasonCode,
    IConnackPacket,
    IPublishPacket,
    MqttClient
} from 'mqtt';
import { Config } from './config-types.js';

// Events that can be forwarded from the MQTT client
export interface DysonMqttClientEventMap {
    close:          [];
    connect:        [packet: IConnackPacket];
    error:          [error: Error | ErrorWithReasonCode];
    message:        [topic: string, payload: Buffer, packet: IPublishPacket];
}

// A Dyson MQTT client
export abstract class DysonMqttClient extends EventEmitter<DysonMqttClientEventMap> {

    // Construct a new MQTT client
    constructor(readonly log: AnsiLogger, readonly config: Config) {
        super({ captureRejections: true });
    }

    // Start (re)connecting the MQTT client (resolves after initiating connect)
    abstract connect(): Promise<void>;

    // Forward other MQTT client methods
    abstract publishAsync  (...args: Parameters<MqttClient['publishAsync'  ]>): ReturnType<MqttClient['publishAsync'  ]>;
    abstract subscribeAsync(...args: Parameters<MqttClient['subscribeAsync']>): ReturnType<MqttClient['subscribeAsync']>;
    abstract endAsync      (...args: Parameters<MqttClient['endAsync'      ]>): ReturnType<MqttClient['endAsync'      ]>;
}