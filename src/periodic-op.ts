// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { logError } from './log-error.js';
import { setTimeout } from 'node:timers/promises';
import { MaybePromise } from 'matterbridge/matter';
import { assertIsDefined } from './utils.js';

// Configuration of a periodic operation
export interface PeriodicOpConfig {
    name:           string;
    interval:       number;
    intervalRapid?: number;
    op:             () => MaybePromise;
}

// Periodically perform an operation
export class PeriodicOp {

    // Current status
    status: 'stopped' | 'running' | 'stopping' = 'stopped';

    // Timing of the next operation
    lastOpTime = 0;
    rapidUntil = 0;

    // Abort signal used to cancel interval timer
    abortInterval?: AbortController;

    // Construct a new polled operation (initially stopped)
    constructor(readonly log: AnsiLogger, readonly config: PeriodicOpConfig) {}

    // Start the polling operation
    start(): void {
        const wasStopped = this.status === 'stopped';
        this.status = 'running';
        if (wasStopped) void this.doPolling();
    }

    // Stop the polling operation
    stop(): void {
        if (this.status === 'running') {
            this.log.info(`${this.config.name} stopping`);

            // Cancel any timer and prevent rescheduling
            this.status = 'stopping';
            this.abortInterval?.abort();
            this.abortInterval = undefined;
        }
    }

    // Temporarily poll more rapidly
    requestRapid(duration: number): void {
        // Ensure that rapid polling is supported
        if (!this.config.intervalRapid) throw new Error(`${this.config.name} does not support rapid polling`);
        if (this.status !== 'running')  throw new Error(`${this.config.name} cannot be rapid polled when ${this.status}`);

        // Extend the use of rapid polling
        this.rapidUntil = Math.max(this.rapidUntil, Date.now() + duration);

        // Cancel any current interval timer
        this.abortInterval?.abort();
        this.abortInterval = undefined;
    }

    // Is the polling operation active (not stopped)
    get isActive(): boolean {
        return this.status !== 'stopped';
    }

    // Time until the next operation
    get timeUntilNextOp(): number {
        const now = Date.now();
        const interval = this.config[now < this.rapidUntil ? 'intervalRapid' : 'interval'];
        assertIsDefined(interval);
        return Math.max(0, this.lastOpTime + interval - now);
    }

    // Perform the polling
    async doPolling(): Promise<void> {
        this.log.info(`${this.config.name} starting`);
        while (this.status === 'running') {
            try {
                // Wait until it is time for the next operation
                this.abortInterval = new AbortController();
                const { signal } = this.abortInterval;
                await setTimeout(this.timeUntilNextOp, undefined, { signal });

                // Attempt the operation
                this.lastOpTime = Date.now();
                await this.config.op();
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    this.log.debug(`${this.config.name} early wake`);
                } else {
                    logError(this.log, this.config.name, err);
                }
            }
        }
        this.status = 'stopped';
        this.log.info(`${this.config.name} stopped`);
    }
}