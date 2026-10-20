// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DYSON_MQTT_CONFIG_360, DysonMqtt360 } from './dyson-mqtt-360.js';
import { Config } from './config-types.js';
import NodePersist from 'node-persist';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { DysonMqttConfig } from './dyson-mqtt.js';
import { checkers as dysonMsgCheckers360 } from './ti/dyson-360-msg-types.js';
import { checkers as dysonJdmCheckers360 } from './ti/dyson-360-jdm-types.js';
import { checkers as dysonJdmPropsCheckers360 } from './ti/dyson-360-jdm-props-types.js';
import { checkers as dysonJdmCommandCheckers360 } from './ti/dyson-360-jdm-command-types.js';
import { checkers as dysonJdmStatusCheckers360 } from './ti/dyson-360-jdm-status-types.js';
import { DysonMqttTopic } from './dyson-mqtt-subscribe.js';
import { ICheckerSuite } from 'ts-interface-checker';
import {
    Dyson360JdmMsg,
    Dyson360JdmResponseCode,
    JDM_VERSION
} from './dyson-360-jdm-types.js';
import {
    Dyson360JdmProp,
    Dyson360JdmPropValues
} from './dyson-360-jdm-props-types.js';
import { formatList, MS, plural, tryListener } from './utils.js';
import { Dyson360JdmMapStatus } from './dyson-360-jdm-status-types.js';
import { DysonMqttFiltered } from './dyson-mqtt-filter.js';
import { isDeepStrictEqual } from 'node:util';
import { getTiStringUnion, TiSuiteTagType } from './ti-tagged-utils.js';
import { assertWithChecker, TiTaggedChecker } from './ti-tagged-checker.js';

// Add JDM topic subscriptions to MQTT configuration
const DYSON_MQTT_CONFIG_360_JDM: DysonMqttConfig<typeof dysonMsgCheckers360> = {
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

// All known properties
const JDM_PROPS_ALL = getTiStringUnion(dysonJdmPropsCheckers360, 'Dyson360JdmProp') as Set<Dyson360JdmProp>;

// Properties to poll once when (re)connected
const JDM_PROPS_POLL_CONNECTED = JDM_PROPS_ALL.difference(new Set<Dyson360JdmProp>([
    'cur_path'          // Incrementally pushed (or request if required)
]));

// Properties to poll periodically
const JDM_PROPS_POLL_PERIODIC  = JDM_PROPS_POLL_CONNECTED.difference(new Set<Dyson360JdmProp>([
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
]));

// Checker suites for JDM MQTT messages
type DysonMqttJdmChecker<T extends ICheckerSuite> = TiTaggedChecker<T, 'method', Dyson360JdmMsg>;

// Method name to message type maps
export type Dyson360JdmCommandMap       = TiSuiteTagType<typeof dysonJdmCommandCheckers360, 'method'>;
export type Dyson360JdmStatusMap        = TiSuiteTagType<typeof dysonJdmStatusCheckers360,  'method'>;

// JDM command and status message methods
export type Dyson360JdmCommandMethod    = keyof Dyson360JdmCommandMap;
export type Dyson360JdmStatusMethod     = keyof Dyson360JdmStatusMap;
export type Dyson360JdmEventMethod      = Extract<Dyson360JdmStatusMethod, `event.${string}`>;
export type Dyson360JdmResponseMethod   = Extract<Dyson360JdmStatusMethod, `service.${string}` | 'prop.get' | 'prop.set'>;

// JDM command and status messages
export type Dyson360JdmCommand  <M extends Dyson360JdmCommandMethod = Dyson360JdmCommandMethod> = Dyson360JdmCommandMap[M];
export type Dyson360JdmStatus   <M extends Dyson360JdmStatusMethod  = Dyson360JdmStatusMethod > = Dyson360JdmStatusMap [M];
export type Dyson360JdmEvent    = Dyson360JdmStatus<Dyson360JdmEventMethod>;
export type Dyson360JdmAny      = Dyson360JdmCommand | Dyson360JdmStatus;

// JDM response messages that actually include a data payload
export type Dyson360JdmResponse<M extends Dyson360JdmResponseMethod = Dyson360JdmResponseMethod> = {
    [K in M]: Dyson360JdmStatusMap[K] & Required<Pick<Dyson360JdmStatusMap[K], 'data'>>;
}[M];

// Sanity check that the definitions are consistent
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _PropInSync:      Equal<Dyson360JdmProp, keyof Dyson360JdmPropValues> = true;
const _MethodsInSync:   Equal<Dyson360JdmCommandMethod, Dyson360JdmResponseMethod> = true;

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
    msg:        Dyson360JdmAny;
    time:       number;
    received?:  boolean;
}

// Dyson MQTT client for robot vacuums with JDM MQTT topics
export class DysonMqtt360Jdm extends DysonMqtt360<DysonMqtt360JdmEventArgs> {

    // Checker suites for JDM messages
    readonly commandCheckers:   DysonMqttJdmChecker<typeof dysonJdmCommandCheckers360>;
    readonly statusCheckers:    DysonMqttJdmChecker<typeof dysonJdmStatusCheckers360>;

    // Cache of robot properties
    readonly jdmProps:          Dyson360JdmPropValues = {};

    // Recent JDM messages for duplicate filtering
    readonly jdmRecentMsgs:     RecentJdmMsg[] = [];

    // Awaited JDM responses (keyed on MsgId)
    readonly jdmAwaitedResponses = new Map<string, (result: Dyson360JdmStatus | Error) => void>();

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, persist: NodePersist.LocalStorage, device: DeviceConfigMqtt) {
        super(log, config, persist, device, DYSON_MQTT_CONFIG_360_JDM);

        // Create the checker suites for JDM messages
        this.commandCheckers    = this.makeJdmCheckerSuite(dysonJdmCommandCheckers360);
        this.statusCheckers     = this.makeJdmCheckerSuite(dysonJdmStatusCheckers360);

        // Handle MQTT events
        this.on('subscribed', tryListener(this, async () => {
            // Request the current status when (re)connected
            await this.getJdmProps(JDM_PROPS_POLL_CONNECTED);
        }));
    }

    // Parse a received message
    override parseReceived(topic: string, topicStatus: DysonMqttTopic, msg: unknown): void {
        const context = `MQTT topic '${topic}'`;
        if (topic.endsWith('/command/jdm')) {
            // Validate a received JDM command
            this.commandCheckers.assertIsTagged(context, msg);
            this.commandCheckers.assertIsTag(context, msg);

            // Filter, log, and emit an event for the validated command message
            const filter = this.filterJdmMsg('command', msg);
            this.logPayload('receive', topic, msg, filter);
            if (!filter) this.emit('event', 'jdm_command', msg);
        } else if (topic.endsWith('/status/jdm')) {
            // Validate, log, and emit JDM status updates
            this.statusCheckers.assertIsTagged(context, msg);
            const settleAwaited = this.jdmAwaitedResponses.get(msg.msgId);
            try {
                const defaultMethod = msg.method ?? this.getJdmMethodFromMsgId(msg.msgId);
                this.statusCheckers.assertIsTag(context, msg, defaultMethod);

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
            assertWithChecker(this.log, context, 'Dyson JDM map status',
                              dysonJdmStatusCheckers360.Dyson360JdmMapStatus, msg);
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

    // Add a message to the recent history if not already included
    getOrAddRecentJdmMsg(type: JdmTopicType, msg: Dyson360JdmAny): RecentJdmMsg {
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
    filterJdmMsg(type: JdmTopicType, msg: Dyson360JdmAny): DysonMqttFiltered | undefined {
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
    async getJdmProps(props: Set<Dyson360JdmProp> = JDM_PROPS_POLL_PERIODIC): Promise<Dyson360JdmPropValues> {
        // Request the specified properties and verify they were returned
        const property = [...props].sort();
        const response = await this.jdmCommand('prop.get', { property });
        // (Cached values are updated via parseReceived and updateJdmProps)
        const missing = property.filter(prop => response.data[prop] === undefined);
        if (missing.length) {
            this.log.debug(`Failed to get ${plural(missing.length, 'JDM property')}: ${formatList(missing)}`);
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

    // Create checker suites
    makeJdmCheckerSuite<T extends ICheckerSuite>(checkers: T): DysonMqttJdmChecker<T> {
        return new TiTaggedChecker(this.log, {
            description:    'Dyson MQTT JDM message',
            checkerSuite:   checkers,
            tagged: {
                path:       'DysonJdmMsg',
                checker:    dysonJdmCheckers360.Dyson360JdmMsg,
                key:        'method'
            }
        });
    }
}

// Is a status message an event
function isJdmEvent(msg: Dyson360JdmStatus): msg is Dyson360JdmEvent {
    return msg.method?.startsWith('event.') ?? false;
}