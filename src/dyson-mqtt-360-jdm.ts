// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { DYSON_MQTT_CONFIG_360, DysonMqtt360 } from './dyson-mqtt-360.js';
import { Config } from './config-types.js';
import NodePersist from 'node-persist';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { DysonMqttConfig } from './dyson-mqtt.js';
import { TypeMap as DysonMsgMap360 } from './ti/dyson-360-msg-types.js';
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
import {
    logCheckerValidation,
    validateDysonTypeSuiteCore
} from './dyson-mqtt-parse.js';
import { Dyson360JdmMsgBase, Dyson360JdmResponseCode, JDM_VERSION } from './dyson-360-jdm-types.js';
import {
    Dyson360JdmProp,
    Dyson360JdmPropValues
} from './dyson-360-jdm-props-types.js';
import { formatList, MS, plural, tryListener } from './utils.js';
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

// All known properties (must match Dyson360JdmProp)
const JDM_PROPS_ALL = [
    'airdry_frequency',
    'alarm',
    'auto_water_complete_flag',
    'auto_water_self_check',
    'back_to_wash',
    'back_wash_time',
    'back_wash_type',
    'charge_state',
    'child_lock',
    'clean_id',
    'clean_wash_attachment',
    'cleaning_area',
    'cleaning_time',
    'cur_path',
    'current_map_id',
    'detergent_consumed',
    'detergent',
    'dock_hypa',
    'dust_action',
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
    'mode',
    'mop_life',
    'mop_pad_life',
    'oob_state',
    'order_total',
    'privacy',
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
    'work_mode',
    'work_time'
] as const satisfies Dyson360JdmProp[];

// Properties to never poll
const JDM_PROPS_EXCLUDE: Dyson360JdmProp[] = [
    'cur_path'          // Incrementally pushed (or request if required)
];

// Properties to only poll once when (re)connected
const JDM_PROPS_ONCE: Dyson360JdmProp[] = [
    // Values pushed when they change
    'back_to_wash',
    'charge_state',
    'cleaning_area',
    'clean_id',
    'cleaning_time',
    'dock_hypa',
    'fault',
    'hypa',
    'main_brush',
    'mode',
    'oob_state',
    'quantity',
    'side_brush',
    'station_act',
    'status',
    'sweep_type',
    'taskBeginTs',
    'work_mode',
    'work_time',

    // Values that are only relevant to schedules
    'order_total'
];

// Sets of properties to poll
const JDM_PROPS_POLL_CONNECTED = JDM_PROPS_ALL           .filter(prop => !JDM_PROPS_EXCLUDE.includes(prop));
const JDM_PROPS_POLL_PERIODIC  = JDM_PROPS_POLL_CONNECTED.filter(prop => !JDM_PROPS_ONCE   .includes(prop));

// Sanitised JDM command and status type maps
type MessagesInTypeMap<T> = {
    [K in keyof T as T[K] extends { method?: infer M } ? (string extends M ? never : K) : never]: T[K]
};
export type Dyson360JdmCommandTypeMap   = MessagesInTypeMap<Dyson360JdmCommandRawTypeMap>;
export type Dyson360JdmStatusTypeMap    = MessagesInTypeMap<Dyson360JdmStatusRawTypeMap>;

// Method name to message type maps
type MessagesByMethod<T extends Record<string, { method?: string }>> = {
    [K in keyof T as NonNullable<T[K]['method']>]: T[K];
}
export type Dyson360JdmCommandMap       = MessagesByMethod<Dyson360JdmCommandTypeMap>;
export type Dyson360JdmStatusMap        = MessagesByMethod<Dyson360JdmStatusTypeMap>;

// JDM command and status message methods
export type Dyson360JdmCommandMethod    = keyof Dyson360JdmCommandMap;
export type Dyson360JdmStatusMethod     = keyof Dyson360JdmStatusMap;
export type Dyson360JdmEventMethod      = Extract<Dyson360JdmStatusMethod, `event.${string}`>;
export type Dyson360JdmResponseMethod   = Extract<Dyson360JdmStatusMethod, `service.${string}` | 'prop.get' | 'prop.set'>;

// JDM command and status messages
export type Dyson360JdmCommand  <M extends Dyson360JdmCommandMethod = Dyson360JdmCommandMethod> = Dyson360JdmCommandMap[M];
export type Dyson360JdmStatus   <M extends Dyson360JdmStatusMethod  = Dyson360JdmStatusMethod > = Dyson360JdmStatusMap [M];
export type Dyson360JdmEvent    = Dyson360JdmStatus<Dyson360JdmEventMethod>;
export type Dyson360JdmMsg      = Dyson360JdmCommand | Dyson360JdmStatus;

// JDM response messages that actually include a data payload
export type Dyson360JdmResponse<M extends Dyson360JdmResponseMethod = Dyson360JdmResponseMethod> = {
    [K in M]: Dyson360JdmStatusMap[K] & Required<Pick<Dyson360JdmStatusMap[K], 'data'>>;
}[M];

// Sanity check that the definitions are consistent
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _PropTypesInSync:     Equal<Dyson360JdmProp, keyof Dyson360JdmPropValues> = true;
const _PropValuesInSync:    Equal<Dyson360JdmProp, (typeof JDM_PROPS_ALL)[number]> = true;
const _MethodsInSync:       Equal<Dyson360JdmCommandMethod, Dyson360JdmResponseMethod> = true;

// Events that can be emitted by the JDM MQTT client (using the 'event' event)
export type DysonMqtt360JdmEventArgs =
    ['jdm_props_updated']
  | ['jdm_command',         msg:    Dyson360JdmCommand]
  | ['jdm_event',           msg:    Dyson360JdmEvent]
  | ['jdm_status',          msg:    Dyson360JdmStatus]
  | ['jdm_map_status',      msg:    Dyson360JdmMapStatus];
export type DysonMqtt360JdmMqttEvent = DysonMqtt360JdmEventArgs[0];

// Timeout when waiting for a JDM response to a command
const JDM_COMMAND_TIMEOUT = 10 * MS;        // 10 seconds

// Details of recent messages for duplicate detection and method identification
const JDM_RECENT_MAX_AGE = 5 * 60 * MS;     // 5 minutes
type JdmTopicType = 'command' | 'status';
interface RecentJdmMsg {
    type:       JdmTopicType;
    msg:        Dyson360JdmMsg;
    time:       number;
    received?:  boolean;
}

// Dyson MQTT client for robot vacuums with JDM MQTT topics
export class DysonMqtt360Jdm extends DysonMqtt360<DysonMqtt360JdmEventArgs> {

    // Cache of robot properties
    readonly jdmProps: Dyson360JdmPropValues = {};

    // Recent JDM messages for duplicate filtering
    readonly jdmRecentMsgs: RecentJdmMsg[] = [];

    // Awaited JDM responses (keyed on MsgId)
    readonly jdmAwaitedResponses = new Map<string, (result: Dyson360JdmStatus | Error) => void>();

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, persist: NodePersist.LocalStorage, device: DeviceConfigMqtt) {
        super(log, config, persist, device, DYSON_MQTT_CONFIG_360_JDM);

        // Handle MQTT events
        this.on('subscribed', tryListener(this, async () => {
            // Request the current status when (re)connected
            await this.getJdmProps(JDM_PROPS_POLL_CONNECTED);
        }));
    }

    // Parse a received message
    override parseReceived(topic: string, topicStatus: DysonMqttTopic, msg: unknown): void {
        if (topic.endsWith('/command/jdm')) {
            // Validate a received JDM command
            this.assertIsJdmType(dysonJdmCommandCheckers360, 'Dyson360JdmCommandBase', topic, msg, false);
            this.assertIsJdmMsg<Dyson360JdmCommandTypeMap>(
                dysonJdmCommandCheckers360, 'Dyson360JdmCommand', topic, msg);

            // Filter, log, and emit an event for the validated command message
            const filter = this.filterJdmMsg('command', msg);
            this.logPayload('receive', topic, msg, filter);
            if (!filter) this.emit('event', 'jdm_command', msg);
        } else if (topic.endsWith('/status/jdm')) {
            // Validate, log, and emit JDM status updates
            this.assertIsJdmType(dysonJdmStatusCheckers360, 'Dyson360JdmStatusBase', topic, msg, false);
            const settleAwaited = this.jdmAwaitedResponses.get(msg.msgId);
            try {
                this.assertIsJdmMsg<Dyson360JdmStatusTypeMap>(
                    dysonJdmStatusCheckers360, 'Dyson360JdmStatus', topic, msg);

                // If this is a prop.get or prop.post then update cached properties
                if (msg.method === 'prop.get')  this.updateJdmProps(msg.data);
                if (msg.method === 'prop.post') this.updateJdmProps(msg.params);

                // Resolve any promise waiting for this response
                settleAwaited?.(msg);
            } catch (cause) {
                // Reject any promise waiting for this response
                settleAwaited?.(new Error('Response failed validation', { cause }));
                throw cause;
            }

            // Filter, log, and emit events for the validated status message
            const filter = this.filterJdmMsg('status', msg);
            this.logPayload('receive', topic, msg, filter);
            if (!filter) {
                // Emit an event for JDM events
                this.emit('event', 'jdm_status', msg);
                if (isJdmEvent(msg)) this.emit('event', 'jdm_event', msg);
            }
        } else if (topic.endsWith('/status/jdm/map')) {
            // Validate and log JDM map status updates
            this.assertIsJdmType(dysonJdmStatusCheckers360, 'Dyson360JdmMapStatus', topic, msg);
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

    // Map a message method to its type name
    assertIsJdmMsg<T extends Record<string, Dyson360JdmMsgBase>>(
        checkers:   Record<keyof T, CheckerT<unknown>>,
        prefix:     string,
        topic:      string,
        msg:        Dyson360JdmMsgBase
    ): asserts msg is T[keyof T] {
        // Attempt to determine the method for this message
        const method = msg.method ?? this.getJdmMethodFromMsgId(msg.msgId);

        // Construct the type name for this message
        const msgPascalCase = methodToPascalCase(method);
        const typeName = `${prefix}${msgPascalCase}`;
        const assertIsTypeName: (name: string) => asserts name is Extract<keyof T, string> = (name): void => {
            if (name in checkers) return;
            logCheckerValidation(this.log, LogLevel.ERROR, topic, msg);
            throw new Error(`Unrecognised JDM message method: ${name}`);
        };
        assertIsTypeName(typeName);

        // Use the selected checker to validate the message
        this.assertIsJdmType(checkers, typeName, topic, msg);
    };

    // Validate a message using a specific checker
    assertIsJdmType<K extends string, T extends Record<K, CheckerT<unknown>>>(
        checkers: T, typeName: K, topic: string, msg: unknown, strict = true
    ): asserts msg is T[K] extends CheckerT<infer R> ? R : never {
        // Select and prepare the checker
        const checker = checkers[typeName];
        checker.setReportedPath(typeName);

        // Use the checker to validate the message
        const validation = checker.validate(msg);
        if (validation) {
            logCheckerValidation(this.log, LogLevel.ERROR, topic, msg, validation);
            throw new Error('Unexpected structure of JDM message');
        }
        const strictValidation = checker.strictValidate(msg);
        if (strict && strictValidation) {
            logCheckerValidation(this.log, LogLevel.WARN, topic, msg, strictValidation);
            // (Continue processing messages that include unexpected properties)
        }
    }

    // Add a message to the recent history if not already included
    getOrAddRecentJdmMsg(type: JdmTopicType, msg: Dyson360JdmMsg): RecentJdmMsg {
        // Prune old messages from the history
        const keepIndex = this.jdmRecentMsgs.findIndex(r => Date.now() <= r.time + JDM_RECENT_MAX_AGE);
        if (0 < keepIndex) this.jdmRecentMsgs.splice(0, keepIndex);

        // Check whether the message is already in the history
        const matchingMsgId = this.jdmRecentMsgs.filter(r => r.type === type && r.msg.msgId === msg.msgId);
        let recentMsg = matchingMsgId.find(r => isDeepStrictEqual(r.msg, msg));
        if (!recentMsg) {
            if (matchingMsgId.length) this.log.warn(`Duplicate JDM msgId detected: ${msg.msgId}`);
            recentMsg = { type, msg, time: Date.now() };
            this.jdmRecentMsgs.push(recentMsg);
        }
        return recentMsg;
    }

    // Attempt to determine method from a msgId
    getJdmMethodFromMsgId(msgId: string): string {
        const methods = new Set(this.jdmRecentMsgs
            .filter(r => r.type === 'command' && r.msg.msgId === msgId)
            .map(r => r.msg.method));
        if (1 < methods.size) throw new Error(`Unable to determine JDM method (multiple commands found with msgId ${msgId})`);
        const method = methods.values().next().value;
        if (!method) throw new Error(`Unable to determine JDM method (no command found with msgId ${msgId})`);
        return method;
    }

    // Filter duplicate messages
    filterJdmMsg(type: JdmTopicType, msg: Dyson360JdmMsg): DysonMqttFiltered | undefined {
        const recent = this.getOrAddRecentJdmMsg(type, msg);
        if (recent.received) return 'duplicate';
        recent.received = true;
    }

    // Modify property values (with read back afterwards to verify)
    async setJdmProps(setPropValues: Partial<Dyson360JdmPropValues>): Promise<void> {
        const property = Object.keys(setPropValues).sort() as Dyson360JdmProp[];

        // Perform the write and read back the new property values
        const setResponse = await this.jdmCommand('prop.set', setPropValues);
        // (setResponse.code=1 indicates a requested value is null)
        const getResponse = await this.jdmCommand('prop.get', { property });
        // (Cached values are updated via parseReceived and updateJdmProps)

        // Check the status and new value for each property written
        const failures: string[] = [];
        for (const prop of property) {
            // Did the prop.set return success for this property?
            const fail: string[] = [];
            const result = setResponse.data.property.find(p => p.prop === prop);
            if (!result) fail.push('set result missing');
            else if (result.code !== Dyson360JdmResponseCode.Success) fail.push(`result ${result.code}`);

            // Did the prop.get return the value written for this property?
            const value = getResponse.data[prop];
            if (value === undefined) fail.push('get value missing');
            else if (!isDeepStrictEqual(value, setPropValues[prop])) {
                fail.push(`value mismatch (${JSON.stringify(setPropValues[prop])} ≠ ${JSON.stringify(value)})`);
            }
            if (fail.length) failures.push(`${prop} (${formatList(fail)})`);
        }
        if (failures.length) {
            throw new Error(`Failed to set ${plural(failures.length, 'JDM property')}: ${formatList(failures)}`);
        }
    }

    // Retrieve current property values (updating cached values from result)
    async getJdmProps(props: Dyson360JdmProp[] = JDM_PROPS_POLL_PERIODIC): Promise<Dyson360JdmPropValues> {
        // Request the specified properties and verify they were returned
        const property = [...new Set(props)].sort();
        const response = await this.jdmCommand('prop.get', { property });
        // (Cached values are updated via parseReceived and updateJdmProps)
        const missing = property.filter(prop => response.data[prop] === undefined);
        if (missing.length) {
            throw new Error(`Failed to get ${plural(missing.length, 'JDM property')}: ${formatList(missing)}`);
        }
        return response.data;
    }

    // Publish a JDM command, wait for the response, and check its status
    async jdmCommand<M extends Dyson360JdmCommandMethod>(
        method: M, params: Dyson360JdmCommand<M>['params']
    ): Promise<Dyson360JdmResponse<M>> {
        // Publish the command, ensuring that any response is captured
        const msgId = this.makeJdmMsgId();
        const responsePromise = this.waitForJdmResponse(msgId);
        try {
            await this.publishJdmCommandRaw(msgId, method, params);

            // Wait for the response and verify that its method matches
            const response = await responsePromise;
            const assertIsResponse: (msg: Dyson360JdmStatus) => asserts msg is Dyson360JdmResponse<M> = (msg): void => {
                if (msg.method && msg.method !== method) throw new Error(`Method mismatch (${response.method} ≠ ${method})`);
                if (msg.data === undefined)              throw new Error('No data in response');
            };
            assertIsResponse(response);
            return response;
        } catch (cause) {
            throw new Error(`JDM command ${method} failed`, { cause });
        } finally {
            // Cancel waiting for a response (if publishing failed)
            this.jdmAwaitedResponses.get(msgId)?.(new Error('Abandoned'));
        }
    }

    // Generate a random message identifier
    makeJdmMsgId(): string {
        for (;;) {
            // Ensure the msgId is unique and non-zero
            const msgId = (1 + Math.floor(Math.random() * (2 ** 32 - 1))).toString();
            if (!this.jdmRecentMsgs.some(r => r.msg.msgId === msgId)) return msgId;
        }
    }

    // Publish a JDM command
    async publishJdmCommandRaw<M extends Dyson360JdmCommandMethod>(
        msgId: string, method: M, params: Dyson360JdmCommand<M>['params']
    ): Promise<void> {
        const time = new Date().toISOString();
        const msg = { msgId, method, time, version: JDM_VERSION, params } as Dyson360JdmCommand;
        this.getOrAddRecentJdmMsg('command', msg);
        await this.publishTo('/jdm', msg);
    }

    // Wait for a JDM response (with a timeout)
    async waitForJdmResponse(msgId: string): Promise<Dyson360JdmStatus> {
        const promise = new Promise<Dyson360JdmStatus>((resolve, reject) => {
            const settle = (result: Dyson360JdmStatus | Error): void => {
                clearTimeout(timeout);
                this.jdmAwaitedResponses.delete(msgId);
                if (result instanceof Error)    reject(result);
                else                            resolve(result);
            };
            const timeout = setTimeout(() => { settle(new Error('Response timeout')); }, JDM_COMMAND_TIMEOUT);
            this.jdmAwaitedResponses.set(msgId, settle);
        });
        promise.catch(() => undefined); // (prevent unhandled rejection)
        return promise;
    }
}

// Ensure that the type names all match their method names
validateDysonJdmTypeSuite(dysonJdmCommandCheckers360,  'Dyson360JdmCommand');
validateDysonJdmTypeSuite(dysonJdmStatusCheckers360,   'Dyson360JdmStatus');
function validateDysonJdmTypeSuite(suite: ICheckerSuite, prefix: string): void {
    const makeTypename = (method: string) => `${prefix}${methodToPascalCase(method)}`;
    validateDysonTypeSuiteCore(suite, 'method', makeTypename);
}

// Is a status message an event
function isJdmEvent(msg: Dyson360JdmStatus): msg is Dyson360JdmEvent {
    return msg.method?.startsWith('event.') ?? false;
}

// Convert a string from Heterogeneous casing to PascalCase
function methodToPascalCase(str: string): string {
    return str
        .replace(/(?<![A-Za-z0-9])([a-z])/g, (_, letter: string) => letter.toUpperCase())
        .replace(/[^A-Za-z0-9]/g, '');
}