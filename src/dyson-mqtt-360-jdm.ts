// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DYSON_MQTT_CONFIG_360, DysonMqtt360 } from './dyson-mqtt-360.js';
import { Config } from './config-types.js';
import NodePersist from 'node-persist';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { DysonMqttConfig } from './dyson-mqtt.js';
import { TypeMap as DysonMsgMap360 } from './ti/dyson-360-msg-types.js';
import { checkers as dysonJdmCheckers360 } from './ti/dyson-360-jdm-types.js';
import { DysonMqttTopic } from './dyson-mqtt-subscribe.js';

// Add JDM topic subscriptions to MQTT configuration
const DYSON_MQTT_CONFIG_360_JDM: DysonMqttConfig<DysonMsgMap360> = {
    ...DYSON_MQTT_CONFIG_360,
    topics: {
        ...DYSON_MQTT_CONFIG_360.topics,
        subscribe: [
            ...DYSON_MQTT_CONFIG_360.topics.subscribe,
            '@/@/status/jdm'
        ],
        other: [
            ...DYSON_MQTT_CONFIG_360.topics.other ?? [],
            '@/@/command/jdm'
        ]
    }
};

// Dyson MQTT client for robot vacuums with JDM MQTT topics
export class DysonMqtt360Jdm extends DysonMqtt360 {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, persist: NodePersist.LocalStorage, device: DeviceConfigMqtt) {
        super(log, config, persist, device, DYSON_MQTT_CONFIG_360_JDM);
    }

    // Parse a received message
    parseReceived(topic: string, topicStatus: DysonMqttTopic, msg: unknown): void {
        const checker = dysonJdmCheckers360.Dyson360Jdm;
        if (checker.strictTest(msg)) {
            // Just log JDM messages for now
            this.logPayload('receive', topic, msg);
        } else {
            // Parse everything else as standard format messages
            super.parseReceived(topic, topicStatus, msg);
        }
    }
}