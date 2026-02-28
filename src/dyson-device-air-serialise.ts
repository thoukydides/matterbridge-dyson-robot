// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonMqttAir, DysonMqttProductState } from './dyson-mqtt-air.js';
import { formatList, MS, plural } from './utils.js';
import { CC, RI } from './logger-options.js';
import { setImmediate } from 'node:timers/promises';

// Timeout waiting for the next update
const UPDATE_TIMEOUT = 5 * MS; // 5 seconds

// Command serialiser for Dyson air purifier settings
export class DysonAirSerialise {

    // Operation currently in progress
    activePromise?:         Promise<void>;

    // Pending operation
    pendingProductState:    DysonMqttProductState   = {};
    pendingDescriptions:    string[]                = [];
    pendingPromise?:        Promise<void>;

    // Create a new Dyson air purifier command serialiser
    constructor (
        readonly log:           AnsiLogger,
        readonly mqtt:          DysonMqttAir,
        readonly flushChanged:  () => void
    ) {}

    // Queue an MQTT command to set the product state
    async setState(description: string, productState: DysonMqttProductState): Promise<void> {
        if (this.activePromise) this.log.info(`(Delaying: ${description})`);

        // Merge with the pending command
        Object.assign(this.pendingProductState, productState);
        this.pendingDescriptions.push(description);
        this.pendingPromise ??= this.startPending();
        return this.pendingPromise;
    }

    // Wait for any active command to complete and issue a new one
    async startPending(): Promise<void> {
        // Wait for any active command to complete
        try {
            await this.activePromise;
        } catch { /* empty */ }
        await setImmediate();

        // Process the pending command and prepare for the next
        this.activePromise = this.startActive(this.pendingDescriptions, this.pendingProductState);
        this.pendingProductState = {};
        this.pendingDescriptions = [];
        this.pendingPromise = undefined;

        // Wait for the active command to complete
        try {
            await this.activePromise;
        } finally {
            this.activePromise = undefined;
        }
    }

    // Send an MQTT command to set the product state and wait for a status update
    async startActive(descriptions: string[], productState: DysonMqttProductState): Promise<void> {
        // Log details of the command
        if (descriptions.length === 1) {
            this.log.info(descriptions[0] ?? '');
        } else {
            const unique = [...new Set(descriptions.toReversed())].reverse();
            const duplicateCount = descriptions.length - unique.length;
            this.log.info(`Coalescing ${plural(descriptions.length, 'delayed command')}`
                + `${duplicateCount ? ` (${plural(duplicateCount, 'duplicate')} hidden)` : ''}:`);
            for (const description of unique) this.log.info(`    ${description}`);
        }
        const values = Object.entries(productState).map(([key, value]) => `${CC}${key}=${value}${RI}`);
        this.log.info(`Setting state: ${formatList(values)}`);

        // Publish the command and process the next MQTT status update
        await this.mqtt.commandStateSet(productState);
        this.flushChanged();

        // Wait for the next MQTT status update or a timeout
        const timeoutSignal = AbortSignal.timeout(UPDATE_TIMEOUT);
        await this.mqtt.onceAsync('status', timeoutSignal);
    }

    // Should attributes be updated in response to MQTT status messages
    get ignoreMqttUpdates(): boolean {
        // Ignore the status update from a command that will be superseded
        return this.pendingPromise !== undefined;
    }
}