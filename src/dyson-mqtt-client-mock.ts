// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config, DeviceConfigMock } from './config-types.js';
import { DysonMqttClient } from './dyson-mqtt-client-base.js';
import {
    IConnackPacket,
    IPublishPacket,
    ISubscriptionGrant,
    MqttClient
} from 'mqtt';
import { readFile } from 'node:fs/promises';
import { assertIsDefined, formatList, MS, plural } from './utils.js';
import { setTimeout } from 'node:timers/promises';

// Interval between messages when replaying the log file
const INITIALISE_INTERVAL   = 35 * MS;  // 35 seconds
const MESSAGE_INTERVAL      = 100;      // 10 milliseconds

// Comments start with # and continue to the end of the line
const COMMENT_REGEXP        = /^#.*|#[^{}]*$/;

// Marker for initialisation delay
const INITIALISE_MARKER     = '---';

// A Dyson MQTT client using a log file as the source of messages
export class DysonMqttClientMock extends DysonMqttClient {

    // The remaining log file lines
    private lines: string[] = [];

    // MQTT topic for the device status
    private topic = '';

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, readonly deviceConfig: DeviceConfigMock) {
        super(log, config);
    }

    // Start (re)connecting the MQTT client (resolves after initiating connect)
    async connect(): Promise<void> {
        // Read and parse the log file, stripping comments and blank lines
        const log = await readFile(this.deviceConfig.filename, 'utf8');
        const lines = log.split('\n');
        this.lines = lines.map(l => l.replace(COMMENT_REGEXP, '').trim()).filter(l => l.length);
        this.log.debug(`MQTT log file contains ${plural(this.lines.length, 'message')}`);

        // Emit a connection event
        const packet: IConnackPacket = { cmd: 'connack', sessionPresent: false };
        this.emit('connect', packet);

        // Start emitting messages from the log file
        void this.emitNextMessage();
    }

    // Emit the next message from the log file, if any
    async emitNextMessage(): Promise<void> {
        // Delay between messages
        await setTimeout(MESSAGE_INTERVAL);

        // Check for more messages
        const line = this.lines.shift();
        if (!line) {
            this.log.debug('End of MQTT log file reached');
            return;
        }
        if (line === INITIALISE_MARKER) {
            // Extra delay for initialisation after the first few messages
            this.log.debug('Pausing MQTT log file playback');
            await setTimeout(INITIALISE_INTERVAL);
            this.log.debug('Resuming MQTT log file playback');
        } else {
            // Assume all messages come from the status topic
            const topic = this.topic;
            const payload = Buffer.from(line);
            const packet: IPublishPacket = { cmd: 'publish', topic, payload, qos: 0, dup: false, retain: false };
            this.emit('message', topic, payload, packet);
        }

        // Emit the next message
        void this.emitNextMessage();
    }

    // Ignore requests to publish messages
    publishAsync(...args: Parameters<MqttClient['publishAsync']>) {
        const [topic] = args;
        this.log.debug(`Ignoring MQTT publish to ${topic}`);
        return Promise.resolve(undefined);
    }

    // Grant subscription requests, but do nothing
    subscribeAsync(...args: Parameters<MqttClient['subscribeAsync']>) {
        const [topicObject] = args;
        const topics = typeof topicObject === 'string' ? [topicObject]
                     : Array.isArray(topicObject)      ? topicObject
                     : Object.keys(topicObject).filter(t => t !== 'resubscribe');
        this.log.debug(`Subscribed to MQTT topics: ${formatList(topics)}`);

        // Select one of the topics as the device status topic
        const statusTopic = topics.find(t => t.includes('status'));
        assertIsDefined(statusTopic);
        this.topic = statusTopic;

        // Return a successful subscription grant for each topic
        const grant: ISubscriptionGrant[] = topics.map(topic => ({ topic, qos: 0 }));
        return Promise.resolve(grant);
    }

    // Stop mocking MQTT messages
    stop() {
        this.log.debug('Stopping mock MQTT client');
        this.lines = [];
        return Promise.resolve();
    }
}