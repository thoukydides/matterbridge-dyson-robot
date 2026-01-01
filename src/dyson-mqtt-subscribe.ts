// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import EventEmitter from 'events';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { formatList, plural, tryListener } from './utils.js';
import { DysonMqttClient } from './dyson-mqtt-client-base.js';

// Configuration required for managing MQTT topic subscriptions
export interface DysonMqttSubscribeConfig {
    command:    string;     // Publish commands
    subscribe:  string[];   // Required receive topics
    other?:     string[];   // Any other expected topics
}

// Events that can be emitted by the MQTT subscription manager
export interface DysonMqttSubscribeEventMap {
    error:      [unknown];  // Error event (from EventEmitter)
    subscribed: [];         // Online and subscriptions configured
}

// Result of checking a topic
export type DysonMqttTopic =  'subscribed' | 'command' | 'expected' | 'unexpected';

// Manage Dyson MQTT topic subscriptions
export class DysonMqttSubscribe extends EventEmitter<DysonMqttSubscribeEventMap> {

    // Construct a new subscription manager
    constructor(
        readonly log:           AnsiLogger,
        readonly mqtt:          DysonMqttClient,
        readonly config:        Config,
        readonly topics:        DysonMqttSubscribeConfig,
        readonly root_topic:    string,
        readonly username:      string
    ) {
        super({ captureRejections: true });

        // (Re)subscribe to topics when the MQTT (re)connects
        mqtt.on('connect', tryListener(this, async _connack => {
            await this.subscribe();
            this.emit('subscribed');
        }));
    }

    // Subscribe to topics when the client (re)connects
    async subscribe(): Promise<void> {
        // Select the required subscription topics
        const replacePlaceholders = (topics: string[]): string[] =>
            topics.map(t => this.replaceTopicPlaceholders(t));
        const topics = replacePlaceholders(this.topics.subscribe);
        if (this.config.wildcardTopic) {
            if (this.config.provisioningMethod !== 'Remote Account') {
                // Use full wildcard topic for local connections
                topics.push('#');
            } else {
                // AWS IoT disconnects on wildcards; subscribe to command topic
                topics.push(this.replaceTopicPlaceholders(this.topics.command));
            }
        }

        // Attempt the subscription
        this.log.debug(`MQTT subscribe: ${formatList(topics)}`);
        const grant = await this.mqtt.subscribeAsync(topics, { qos: 1 });

        // Check whether
        const failures = topics.filter(topic => !grant.some(g => g.topic === topic));
        if (!grant.length) {
            throw new Error(`MQTT subscribe unsuccessful: all ${plural(topics.length, 'topic')} rejected`);
        } else if (failures.length) {
            this.log.warn('MQTT subscribe partially successful: '
                            + `${failures.length} of ${plural(topics.length, 'topic')} rejected`);
            failures.forEach(topic => { this.log.warn(`    '${topic}'`); });
        } else {
            this.log.info(`MQTT subscribe successful: all ${plural(grant.length, 'topic')} granted`);
        }
    }

    // Warn if a received message's topic is unexpected
    checkTopic(topic: string): DysonMqttTopic {
        // Check whether the topic is expected
        const isTopics = (topics: string[]) => topics.some(t => this.replaceTopicPlaceholders(t) === topic);
        if (isTopics([this.topics.command]))    return 'command';
        if (isTopics(this.topics.subscribe))    return 'subscribed';
        if (isTopics(this.topics.other ?? []))  return 'expected';

        // Attempt to diagnose common problems
        const [root_topic, username] = topic.split('/', 2);
        if (root_topic !== this.root_topic) {
            this.log.warn('MQTT topic root (product type) mismatch:'
                        + ` expected '${this.root_topic}', received '${root_topic}'`);
        } else if (username !== this.username) {
            this.log.warn('MQTT topic username (product serial number) mismatch:'
                        + ` expected '${this.username}', received '${username}'`);
        } else {
            this.log.warn(`Unexpected MQTT topic received: ${topic}`);
        }
        return 'unexpected';
    }

    // The full topic for publishing commands
    get commandTopic(): string {
        return this.replaceTopicPlaceholders(this.topics.command);
    }

    // Replace any placeholders in topic
    replaceTopicPlaceholders(topic: string): string {
        return topic
            .replace('@', this.root_topic)
            .replace('@', this.username);
    }
}