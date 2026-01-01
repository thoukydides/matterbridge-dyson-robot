// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { isDeepStrictEqual } from 'node:util';
import { DysonMsg } from './dyson-types.js';
import { AnsiLogger } from 'matterbridge/logger';

// Filter result
export type DysonMqttFiltered = 'duplicate' | 'reordered';

// Filter received Dyson MQTT messages for reordering and duplication
export class DysonMqttFilter {

    // The most recent message of each type (indexed by msg)
    readonly lastMsg = new Map<string, DysonMsg>;

    // Create a new message filter
    constructor(readonly log: AnsiLogger) {}

    // Filter a received message
    filter(msg: DysonMsg): DysonMqttFiltered | undefined {
        const lastMsg = this.lastMsg.get(msg.msg);
        if (lastMsg) {
            if (msg.time && lastMsg.time && msg.time < lastMsg.time) {
                return 'reordered';
            }
            if ((msg.time || lastMsg.time) && isDeepStrictEqual(msg, lastMsg)) {
                // (don't filter messages without timestamps)
                return 'duplicate';
            }
        }
        this.lastMsg.set(msg.msg, structuredClone(msg));
    }
}