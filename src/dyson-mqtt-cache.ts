// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import EventEmitter from 'events';
import { AnsiLogger } from 'matterbridge/logger';
import NodePersist from 'node-persist';

// Cache version
const MQTT_CACHE_VERSION = 1;

// Events that can be emitted by the MQTT cache manager
export interface DysonMqttCacheEventMap<S> {
    error:      [unknown];  // Error event (from EventEmitter)
    restored:   [S];        // Cached status restored
}

// Cache Dyson MQTT status to allow start-up when device is offline
export class DysonMqttCache<S> extends EventEmitter<DysonMqttCacheEventMap<S>> {

    // Create a new MQTT cache
    constructor(
        readonly log:           AnsiLogger,
        readonly persist:       NodePersist.LocalStorage,
        readonly serialNumber:  string
    ) {
        super({ captureRejections: true });

        // Attempt to restore any previously cached status
        void this.restore();
    }

    // Construct a persistent storage key for the cache
    get key(): string {
        return `mqtt-cache-v${MQTT_CACHE_VERSION}:${this.serialNumber}`;
    }

    // Retrieve the cached status, if any
    async restore(): Promise<void> {
        const status = await this.persist.getItem(this.key) as S | undefined;
        if (!status) return;
        this.emit('restored', status);
    }

    // Store the current status in the cache
    async store(status: S): Promise<void> {
        await this.persist.setItem(this.key, status);
    }
}