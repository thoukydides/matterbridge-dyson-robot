// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DYSON_MQTT_CONFIG_360, DysonMqtt360 } from './dyson-mqtt-360.js';
import { Config } from './config-types.js';
import NodePersist from 'node-persist';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';

// Add JDM topic subscriptions to MQTT configuration
const DYSON_MQTT_CONFIG_360_JDM = DYSON_MQTT_CONFIG_360;
DYSON_MQTT_CONFIG_360_JDM.topics.subscribe = [
    ...DYSON_MQTT_CONFIG_360.topics.subscribe,
    '@/@/command/jdm',
    '@/@/status/jdm'
];

// Dyson MQTT client for robot vacuums with JDM MQTT topics
export class DysonMqtt360JDM extends DysonMqtt360 {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, persist: NodePersist.LocalStorage, device: DeviceConfigMqtt) {
        super(log, config, persist, device, DYSON_MQTT_CONFIG_360_JDM);
    }
}