// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { DYSON_MQTT_CONFIG_360, DysonMqtt360 } from './dyson-mqtt-360.js';
import { Config } from './config-types.js';
import NodePersist from 'node-persist';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { DysonMqttConfig } from './dyson-mqtt.js';
import { TypeMap as DysonMsgMap360 } from './ti/dyson-360-msg-types.js';
import { checkers as dysonJdmCheckers360 } from './ti/dyson-360-jdm-types.js';
import {
    checkers as dysonJdmCommandCheckers360,
    TypeMap as Dyson360JdmCommandRawTypeMap
} from './ti/dyson-360-jdm-command-types.js';
import {
    checkers as dysonJdmStatusCheckers360,
    TypeMap as Dyson360JdmStatusRawTypeMap
} from './ti/dyson-360-jdm-status-types.js';
import { DysonMqttTopic } from './dyson-mqtt-subscribe.js';
import { CheckerT, ICheckerSuite } from 'ts-interface-checker';
import { logCheckerValidation, validateDysonTypeSuiteCore } from './dyson-mqtt-parse.js';
import { Dyson360JdmResponseCode, Dyson360JdmResponseResult, JDM_VERSION } from './dyson-360-jdm-types.js';
import { Dyson360JdmProp, Dyson360JdmPropValues } from './dyson-360-jdm-props-types.js';
import { assertIsDefined, formatList, MS, plural } from './utils.js';
import { Dyson360JdmMapStatus } from './dyson-360-jdm-status-types.js';
import { DysonMqttFiltered } from './dyson-mqtt-filter.js';
import { isDeepStrictEqual } from 'node:util';

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
            '@/@/command/jdm',
            '@/@/status/jdm/map'
        ]
    }
};

// Timeout when waiting for a JDM response to a command
const JDM_COMMAND_TIMEOUT = 10 * MS;    // 10 seconds

// Properties to poll
const POLL_PROPS_360_JDM: Dyson360JdmProp[] = [
    'airdry_frequency',
    'alarm',
    'auto_water_complete_flag',
    'auto_water_self_check',
    'back_to_wash',
    'back_wash_time',
    'back_wash_type',
    'charge_state',
    'child_lock',
    'clean_wash_attachment',
    // 'cleaning_area',
    'cleaning_time',
    // 'cur_path',
    'current_map_id',
    'detergent_consumed',
    'detergent',
    'dock_hypa',
    // 'dust_action',
    'dust_auto_state',
    'empty_bin_time',
    'empty_bin_type',
    'fault',
    'global_clean_status',
    'hot_water_mop',
    'hot_water_switch',
    'hypa',
    'ioniser',
    'main_brush',
    'mop_life',
    'mop_pad_life',
    'oob_state',
    // 'order_total',
    'quantity',
    'quiet_begin_time',
    'quiet_end_time',
    'quiet_is_open',
    'robot_auto_updown_type',
    'side_brush',
    'station_act',
    'status',
    'store_demo_mode',
    'sweep_type',
    'taskBeginTs',
    'voice_type',
    'volume',
    'wash_back_frequency',
    'work_mode'
    // 'work_time'
];

// Sanitised JDM command and status type maps
type MessagesInTypeMap<T> = { [K in keyof T as T[K] extends { method: string } ? K : never]: T[K] };
export type Dyson360JdmCommandTypeMap   = MessagesInTypeMap<Dyson360JdmCommandRawTypeMap>;
export type Dyson360JdmStatusTypeMap    = MessagesInTypeMap<Dyson360JdmStatusRawTypeMap>;

// Method name to message type maps
type MessagesByMethod<T extends Record<string, { method: string }>> = {
    [K in keyof T as T[K]['method']]: T[K];
}
export type Dyson360JdmCommandMap       = MessagesByMethod<Dyson360JdmCommandTypeMap>;
export type Dyson360JdmStatusMap        = MessagesByMethod<Dyson360JdmStatusTypeMap>;

// JDM command and status message methods
export type Dyson360JdmCommandMethod    = keyof Dyson360JdmCommandMap;
export type Dyson360JdmStatusMethod     = keyof Dyson360JdmStatusMap;
export type Dyson360JdmEventMethod      = Extract<Dyson360JdmStatusMethod, `event.${string}`>;

// JDM command and status messages
export type Dyson360JdmCommand<M extends Dyson360JdmCommandMethod = Dyson360JdmCommandMethod> = Dyson360JdmCommandMap[M];
export type Dyson360JdmStatus <M extends Dyson360JdmStatusMethod  = Dyson360JdmStatusMethod > = Dyson360JdmStatusMap [M];
export type Dyson360JdmEvent  <M extends Dyson360JdmEventMethod   = Dyson360JdmEventMethod  > = Dyson360JdmStatusMap [M];
export type Dyson360JdmMsg = Dyson360JdmCommand | Dyson360JdmStatus;

// Sanity check that the definitions are consistent
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _PropsInSync: Equal<Dyson360JdmProp, keyof Dyson360JdmPropValues> = true;
type ResponseMethods = Extract<Dyson360JdmStatusMethod, `service.${string}` | 'prop.get' | 'prop.set'>;
const _MethodsInSync: Equal<Dyson360JdmCommandMethod, ResponseMethods> = true;

// Events that can be emitted by the JDM MQTT client (using the 'event' event)
export type DysonMqtt360JdmEventArgs =
    ['jdm_props_updated']
  | ['jdm_command',         msg:    Dyson360JdmCommand]
  | ['jdm_event',           msg:    Dyson360JdmEvent]
  | ['jdm_status',          msg:    Dyson360JdmStatus]
  | ['jdm_map_status',      msg:    Dyson360JdmMapStatus];
export type DysonMqtt360JdmMqttEvent = DysonMqtt360JdmEventArgs[0];

// Number of recent messages to keep for duplicate filtering
const JDM_RECENT_MESSAGES = 10;

// Dyson MQTT client for robot vacuums with JDM MQTT topics
export class DysonMqtt360Jdm extends DysonMqtt360<DysonMqtt360JdmEventArgs> {

    // Cache of robot properties
    readonly jdmProps: Dyson360JdmPropValues = {};

    // Recent JDM messages for duplicate filtering
    readonly jdmRecentMsgs: { command: Dyson360JdmMsg[], status: Dyson360JdmMsg[] } = { command: [], status: [] };

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, persist: NodePersist.LocalStorage, device: DeviceConfigMqtt) {
        super(log, config, persist, device, DYSON_MQTT_CONFIG_360_JDM);
    }

    // Parse a received message
    override parseReceived(topic: string, topicStatus: DysonMqttTopic, msg: unknown): void {
        if (topic.endsWith('/command/jdm')) {
            // Validate, log, and emit JDM commands
            const checker = this.getCheckerForJdm<Dyson360JdmCommandTypeMap>(dysonJdmCommandCheckers360, 'Dyson360JdmCommand', topic, msg);
            this.assertIsJdm(checker, topic, msg);
            const filter = this.filterJdm('command', msg);
            this.logPayload('receive', topic, msg, filter);
            if (!filter) this.emit('event', 'jdm_command', msg);
        } else if (topic.endsWith('/status/jdm')) {
            // Validate, log, and emit JDM status updates
            const checker = this.getCheckerForJdm<Dyson360JdmStatusTypeMap>(dysonJdmStatusCheckers360, 'Dyson360JdmStatus', topic, msg);
            this.assertIsJdm(checker, topic, msg);
            const filter = this.filterJdm('status', msg);
            this.logPayload('receive', topic, msg, filter);
            if (!filter) {
                // If this is a prop.get or prop.post then update cached properties
                if (msg.method === 'prop.get')  this.updateJdmProps(msg.data);
                if (msg.method === 'prop.post') this.updateJdmProps(msg.params);

                // Emit an event for JDM events
                this.emit('event', 'jdm_status', msg);
                if (isJdmEvent(msg)) this.emit('event', 'jdm_event', msg);
            }
        } else if (topic.endsWith('/status/jdm/map')) {
            // Validate and log JDM map status updates
            this.assertIsJdm(dysonJdmStatusCheckers360.Dyson360JdmMapStatus, topic, msg);
            this.logPayload('receive', topic, msg);
            this.emit('event', 'jdm_map_status', msg);
        } else {
            // Parse everything else as standard format messages
            super.parseReceived(topic, topicStatus, msg);
        }
    }

    // Update cached properties and emit an event
    updateJdmProps(newProps: Dyson360JdmPropValues): void {
        Object.assign(this.jdmProps, newProps);
        this.emit('event', 'jdm_props_updated');
    }

    // Map a message name to the corresponding type checker
    getCheckerForJdm<T extends Record<string, unknown>>(
        checkers:   { [K in keyof T]: CheckerT<T[K]> },
        prefix:     string,
        topic:      string,
        msg:        unknown
    ): CheckerT<T[keyof T]> {
        // Check that the message is of the general form expected
        const baseChecker = dysonJdmCheckers360.Dyson360JdmMsg;
        if (!baseChecker.test(msg)) {
            baseChecker.setReportedPath('Dyson360JdmWithMethod');
            const validation = baseChecker.validate(msg);
            assertIsDefined(validation);
            logCheckerValidation(this.log, LogLevel.ERROR, topic, msg, validation);
            throw new Error('JDM message does not include a method name');
        }

        // Construct the type name for this message
        const msgPascalCase = methodToPascalCase(msg.method);
        const typeName = `${prefix}${msgPascalCase}`;
        const assertIsTypeName: (name: string) => asserts name is Extract<keyof T, string> = (name): void => {
            if (name in checkers) return;
            logCheckerValidation(this.log, LogLevel.ERROR, topic, msg);
            throw new Error(`Unrecognised JDM message method: ${name}`);
        };
        assertIsTypeName(typeName);

        // Return the type checker
        const checker = checkers[typeName];
        checker.setReportedPath(typeName);
        return checker;
    };

    // Validate a message using a specific checker
    assertIsJdm<T>(checker: CheckerT<T>, topic: string, msg: unknown): asserts msg is T {
        const validation = checker.validate(msg);
        if (validation) {
            logCheckerValidation(this.log, LogLevel.ERROR, topic, msg, validation);
            throw new Error('Unexpected structure of JDM message');
        }
        const strictValidation = checker.strictValidate(msg);
        if (strictValidation) {
            logCheckerValidation(this.log, LogLevel.WARN, topic, msg, strictValidation);
            // (Continue processing messages that include unexpected properties)
        }
    }

    // Filter duplicate messages
    filterJdm(type: 'command' | 'status', msg: Dyson360JdmMsg): DysonMqttFiltered | undefined {
        const recent = this.jdmRecentMsgs[type];

        // Check whether any recent messages match (all fields identical)
        if (recent.some((recentMsg) => isDeepStrictEqual(recentMsg, msg))) {
            return 'duplicate';
        }

        // Check for msgId collisions
        if (recent.some((recentMsg) => recentMsg.msgId === msg.msgId)) {
            this.log.warn(`JDM ${type} message identifier duplicated: msgId=${msg.msgId}`);
        }

        // Add to the list of recent messages (discarding the oldest)
        if (JDM_RECENT_MESSAGES <= recent.length) recent.shift();
        recent.push(msg);
    }

    // Poll standard property values
    async pollJdmProps(): Promise<void> {
        // Send the command and wait for the response
        const property = POLL_PROPS_360_JDM;
        const _response = await this.jdmCommand('prop.get', { property });
        // (Cached values are updated via parseReceived and updateJdmProps)
    }

    // Publish a JDM command, wait for the response, and check its status
    async jdmCommand<M extends Dyson360JdmCommandMethod>(
        method: M, params: Dyson360JdmCommand<M>['params']
    ): Promise<Dyson360JdmStatus<M>> {
        try {
            const msgId = await this.publishJdmCommand(method, params);
            if ('filename' in this.deviceConfig) {
                // Fake immediate success when using a mock MQTT client
                return { method, msgId, code: Dyson360JdmResponseCode.Success } as Dyson360JdmStatus<M>;
            }
            const response = await this.waitForJdmResponse(method, msgId);
            this.assertJdmStatusSuccess(response);
            return response;
        } catch (cause) {
            const reason = cause instanceof Error
            ? cause.name === 'AbortError' ? 'timed out' : cause.message : String(cause);
            throw new Error(`JDM command ${method}: ${reason}`, { cause });
        }
    }

    // Publish a JDM command, returning the message ID
    async publishJdmCommand<M extends Dyson360JdmCommandMethod>(
        method: M, params: Dyson360JdmCommand<M>['params']
    ): Promise<string> {
        // Construct the full command message
        const common: Omit<Dyson360JdmCommand, 'method' | 'params'> = {
            version:    JDM_VERSION,
            msgId:      makeMsgId()
        };
        const payload = JSON.stringify({ ...common, method, params });

        // Publish to the JDM command topic
        await this.publishTo('/jdm', payload);
        return common.msgId;
    }

    // Wait for a JDM response (throwing AbortError if timeout occurs)
    async waitForJdmResponse<M extends Dyson360JdmCommandMethod>(
        method: M, msgId: string
    ): Promise<Dyson360JdmStatus<M>> {
        const signal = AbortSignal.timeout(JDM_COMMAND_TIMEOUT);
        for (;;) {
            // Wait for a JDM status message
            const [type, msg] = await this.onceAsync('event', signal);
            if (type !== 'jdm_status')  continue;

            // If it is the expected response then return it
            if (msg.msgId !== msgId)    continue;
            if (msg.method === method)  return msg as Dyson360JdmStatus<M>;
            this.log.warn(`JDM command response mismatch for msgId=${msgId} (${msg.method} ≠ ${method})`);
        }
    }

    // Throw an error if a JDM status message indicates failure
    assertJdmStatusSuccess(msg: Dyson360JdmStatus): void {
        const description = `JDM ${msg.method} failed`;
        if ('code' in msg && msg.code !== undefined) {
            // Check the envelope code
            if (msg.code !== Dyson360JdmResponseCode.Success) {
                switch (msg.method) {
                case 'prop.get':                    // At least one property is missing (null)
                case 'service.set_areas_start':     // Always returns code=1?
                case 'service.start_station_act':   // Always returns code=1?
                    this.log.debug(`Ignoring ${description}: code=${msg.code}`);
                    break;
                default:
                    throw new Error(`${description}: code=${msg.code}`);
                }
            }
        }
        if ('data' in msg && msg.data) {
            if ('result' in msg.data && msg.data.result !== undefined) {
                // Check data.result (service.* methods)
                if (msg.data.result !== Dyson360JdmResponseResult.Success) {
                    switch (msg.method) {
                    case 'service.set_areas_start':     // Always returns result=1?
                    case 'service.start_station_act':   // Always returns result=1?
                        this.log.debug(`Ignoring ${description}: result=${msg.data.result}`);
                        break;
                    default:
                        throw new Error(`${description}: result=${msg.data.result}`);
                    }
                }
            }

            // Additional payload checks for some command responses
            switch (msg.method) {
            case 'prop.set': {
                // Each prop.set property written has its own result
                const failures = msg.data.property
                    .filter((prop) => prop.code !== Dyson360JdmResponseCode.Success)
                    .map((prop) => prop.prop);
                if (failures.length) {
                    throw new Error(`${description} for ${plural(failures.length, 'property')}: ${formatList(failures)}`);
                }
            }
                break;
            }
        } else {
            if (msg.method.startsWith('service.')) {
                // A service response without data is a failure
                throw new Error(`${description}: no data`);
            }
        }
    }
}

// Ensure that the type names all match their method names
validateDysonJdmTypeSuite(dysonJdmCommandCheckers360,  'Dyson360JdmCommand');
validateDysonJdmTypeSuite(dysonJdmStatusCheckers360,   'Dyson360JdmStatus');
function validateDysonJdmTypeSuite(suite: ICheckerSuite, prefix: string): void {
    const makeTypename = (method: string) => `${prefix}${methodToPascalCase(method)}`;
    validateDysonTypeSuiteCore(suite, 'method', makeTypename);
}

// Generate a random message identifier
function makeMsgId(): string {
    const id = 1 + Math.floor(Math.random() * (2 ** 32 - 1)); // (avoid 0)
    return id.toString();
}

// Is a status message an event
function isJdmEvent(msg: Dyson360JdmStatus): msg is Dyson360JdmEvent {
    return msg.method.startsWith('event.');
}

// Convert a string from Heterogeneous casing to PascalCase
function methodToPascalCase(str: string): string {
    return str
        .replace(/(?<![A-Za-z0-9])([a-z])/g, (_, letter: string) => letter.toUpperCase())
        .replace(/[^A-Za-z0-9]/g, '');
}