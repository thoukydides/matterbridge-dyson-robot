// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { formatMilliseconds, logError, MS } from './utils.js';
import { setTimeout } from 'node:timers/promises';
import { DysonMqttClient } from './dyson-mqtt-client.js';

// Reconnection back-off timings
const BACKOFF_MIN           =  1 * MS;  // 1 second minimum backoff
const BACKOFF_MAX           = 60 * MS;  // 1 minute maximum backoff
const BACKOFF_FACTOR        = 2;        // Double backoff on each failure
const BACKOFF_RESET_UPTIME  = 10 * MS;  // >10 second connection to use MIN

// Manage a Dyson MQTT broker connection
export class DysonMqttConnection {

    // Abandon reconnection attempts
    terminate       = new AbortController();

    // Backoff for reconnection attempts
    backoff         = BACKOFF_MIN;
    uptimeStart?:   number;

    // Construct a new MQTT client
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly mqtt:      DysonMqttClient
    ) {
        // Listen to MQTT client events to manage its connection
        this.mqtt.on('connect', () => {
            // Successful connection, so start measuring uptime
            log.info('MQTT client connected to broker');
            if (this.uptimeStart !== undefined) this.log.warn("Unexpected MQTT 'connect' event");
            this.uptimeStart = Date.now();
        }).on('error', err => {
            // Connection attempt failed
            log.error(`MQTT client connection error: ${err.message}`);
            // (Will be followed by 'close' event to trigger reconnection)
        }).on('close', () => {
            // Connection closed, so adjust backoff and retry
            if (this.terminate.signal.aborted) {
                this.log.info('MQTT client connection closed; not reconnecting');
                return;
            } else if (this.uptimeStart) {
                const uptime = Date.now() - this.uptimeStart;
                this.uptimeStart = undefined;
                const description = `MQTT client closed stream after ${formatMilliseconds(uptime)}`;
                if (uptime < BACKOFF_RESET_UPTIME) {
                    // Short connection, so keep the (increased) backoff
                    this.log.warn(description);
                } else {
                    // Stable connection, so reset backoff to its minimum
                    this.log.info(`${description}; resetting reconnection backoff to minimum`);
                    this.backoff = BACKOFF_MIN;
                }
            } else {
                this.log.info('MQTT client closed stream after failed connection attempt');
            }

            // Try to (re)establish the connection again
            void this.reconnect();
        });

        // Attempt the initial connection
        void this.start();
    }

    // Attempt a reconnection
    async reconnect(): Promise<void> {
        try {
            // Wait for the backoff before reconnecting
            this.log.info(`MQTT client reconnecting in ${formatMilliseconds(this.backoff)}...`);
            const { signal } = this.terminate;
            await setTimeout(this.backoff, undefined, { signal });

            // Attempt the reconnection
            this.log.info('MQTT client attempting reconnection...');
            await this.mqtt.connect();

            // Increase backoff for the next attempt
            this.backoff = Math.min(this.backoff * BACKOFF_FACTOR, BACKOFF_MAX);
        } catch (err) {
            if (!(err instanceof Error && err.name === 'AbortError')) {
                logError(this.log, 'MQTT Reconnect', err);
            }
            // (Don't retry if failed before attempting reconnection)
        }
    }

    // Attempt the initial connection
    async start(): Promise<void> {
        try {
            this.log.info('Starting MQTT client...');
            await this.mqtt.connect();
        } catch (err) {
            logError(this.log, 'MQTT Start', err);
            // (Don't retry if failed before attempting connection)
        }
    }

    // Stop the MQTT client
    async stop(): Promise<void> {
        this.log.info('Stopping MQTT client...');
        this.terminate.abort();
        await this.mqtt.endAsync();
        this.log.info('MQTT client stopped');
    }
}