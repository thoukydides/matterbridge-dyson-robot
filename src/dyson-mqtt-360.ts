// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config, DeviceConfig } from './config-types.js';
import { DysonMqtt, DysonMqttConfig } from './dyson-mqtt.js';
import {
    checkers as dysonMsgCheckers360,
    TypeMap as DysonMsgMap360
} from './ti/dyson-360-msg-types.js';
import { tryListener } from './utils.js';
import {
    Dyson360MsgCurrentState,
    Dyson360MsgStateChange
} from './dyson-360-msg-types.js';
import {
    Dyson360CleaningMode,
    Dyson360CleaningType,
    Dyson360PowerMode
} from './dyson-360-types.js';
import { DysonModeReason } from './dyson-types.js';

// Configuration of a Dyson MQTT client for robot vacuums
const DYSON_MQTT_CONFIG_360: DysonMqttConfig<DysonMsgMap360> = {
    topics: {
        command:    '@/@/command',
        subscribe: ['@/@/status'],
        other:     ['@/initialconnection/credentials',
                    '@/initialconnection/status']
    },
    messages: {
        prefix:     'Dyson360Msg',
        checkers:   dysonMsgCheckers360
    }
};

// Dyson robot vacuum status
export type DysonMqttStatus360 = Omit<Dyson360MsgCurrentState, 'msg' | 'time'>;

// Dyson robot vacuum supported commands
export type DysonMqtt360Action = 'START' | 'PAUSE' | 'RESUME' | 'ABORT';

// Dyson MQTT client for robot vacuums
export class DysonMqtt360 extends DysonMqtt<DysonMsgMap360, DysonMqttStatus360> {

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, device: DeviceConfig) {
        super(log, config, device, DYSON_MQTT_CONFIG_360);

        // Handle MQTT events
        this.on('subscribed', tryListener(this, async () =>
            // Request the current status when (re)connected
            this.publish('REQUEST-CURRENT-STATE'))
        ).on('message', tryListener(this, msg => {
            // Update the robot vacuum state from the received messages
            switch (msg.msg) {
            case 'STATE-CHANGE':
                msg = this.convertStateChange(msg);
                // (fallthrough)
            case 'CURRENT-STATE':
                this.updateState(msg);
                break;
            }
        }));
    }

    // Convert a STATE-CHANGE message to CURRENT-STATE format
    convertStateChange(msg: Dyson360MsgStateChange): Dyson360MsgCurrentState {
        const { msg: _, newstate: state, oldstate, endOfClean, ...otherFields } = msg;
        return { msg: 'CURRENT-STATE', state, ...otherFields };
    }

    // Update the robot vacuum state from a received message
    updateState(msg: Dyson360MsgCurrentState): void {
        // Copy most fields from the message to the state
        const { msg: _msg, time, ...status } = msg;
        this.status.faults = undefined; // (ensure faults get cleared)
        Object.assign(this.status, status);

        // State is fully initialised after the first message has been received
        if (!this.status.initialised) {
            this.status.initialised = true;
            this.log.info('MQTT client initialisation complete');
        }
    }

    // Publish a robot vacuum command to perform an action
    commandAction(msg: DysonMqtt360Action): Promise<void> {
        switch (msg) {
        case 'START':
            return this.publish('START', {
                'mode-reason':  DysonModeReason.LocalApp,
                fullCleanType:  Dyson360CleaningType.Immediate,
                cleaningMode:   this.status.defaultCleaningMode && Dyson360CleaningMode.Global
            });
        case 'PAUSE':
        case 'RESUME':
        case 'ABORT':
            return this.publish(msg, {
                'mode-reason':  DysonModeReason.LocalApp
            });
        }
    }

    // Publish a robot vacuum command to set the default power level
    commandPower(defaultVacuumPowerMode: Dyson360PowerMode): Promise<void> {
        return this.publish('STATE-SET', {
            'mode-reason':  DysonModeReason.LocalApp,
            data:           { defaultVacuumPowerMode }
        });
    }
}