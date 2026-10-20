// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { readFileSync } from 'node:fs';
import { PLATFORM_NAME } from '../src/settings.js';

/* eslint-disable no-cond-assign */

// Match ANSI codes from the log
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_REGEXP            = /\x1B(?:\[[0-9;]*[msuK])?/g;
// eslint-disable-next-line no-control-regex
const OTHER_CTRL_REGEXP             = /\x1B/g;

// Match log file entries
const LOG_REGEXP                    = /^\[\d\d:\d\d:\d\d.\d\d\d\] \[([^\]]+)\] (.*)$/gm;
const LOG_MQTT_RX_REGEXP            = /^MQTT receive: (\{.*\}) topic '([^']*)'$/;
const LOG_MQTT_TI_TOPIC_REGEXP      = /^MQTT topic '([^']*)':$/;
const LOG_MQTT_TI_VALIDATION_REGEXP = /^\s*[└├│][└├│─ ]+(.*)$/;
const LOG_MQTT_TI_PAYLOAD_REGEXP    = /^ {4}(.*)$/;
const LOG_MQTT_TI_ERROR_REGEXP      = /^\[MQTT Event\] Error: (.*)$/;

// Read the log file from stdin and strip control codes
const rawLog = readFileSync(0).toString();
const log = rawLog.replaceAll(ANSI_ESCAPE_REGEXP, '').replaceAll(OTHER_CTRL_REGEXP, '');

// A (partial) MQTT validation message
interface MqttValidation {
    topic:      string;
    errors:     string[];
    payload:    string[];
}

// Process log files from the plugin
let lineMatch: RegExpExecArray | null;
const mqttPayloads: string[] = [];
let mqttValidation: MqttValidation | undefined;
while ((lineMatch = LOG_REGEXP.exec(log)) !== null) {
    // Only interested in log lines from the plugin
    const [, logName, logLine] = lineMatch;
    if (!logName.startsWith(PLATFORM_NAME)) continue;

    // MQTT messages with validation errors
    let match: RegExpExecArray | null;
    if (match = LOG_MQTT_TI_TOPIC_REGEXP.exec(logLine)) {
        const [, topic] = match;
        mqttValidation = { topic, errors: [], payload: [] };
    } else if (mqttValidation) {
        if (match = LOG_MQTT_TI_VALIDATION_REGEXP.exec(logLine)) {
            const [, error] = match;
            mqttValidation.errors.push(error);
        } else if (match = LOG_MQTT_TI_PAYLOAD_REGEXP.exec(logLine)) {
            const [, payload] = match;
            mqttValidation.payload.push(payload);
        } else if (match = LOG_MQTT_TI_ERROR_REGEXP.exec(logLine)) {
            const [, _error] = match;
            const inspectedPayload = mqttValidation.payload.join('');
            if (!inspectedPayload) console.debug(mqttValidation);
            const payload = JSON.stringify(eval(`(${inspectedPayload})`));
            mqttPayloads.push(payload);
            mqttValidation = undefined;
        } else {
            mqttValidation = undefined;
        }
    }

    // Validated MQTT messages
    if (match = LOG_MQTT_RX_REGEXP.exec(logLine)) {
        const [, payload, _topic] = match;
        mqttPayloads.push(payload);
    }
}

// Output the MQTT log (including messages that failed validation)
for (const payload of mqttPayloads) console.log(payload);