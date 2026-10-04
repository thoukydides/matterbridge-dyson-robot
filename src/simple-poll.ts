// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { MaybePromise } from 'matterbridge/matter';
import { logError } from './log-error.js';
import { setTimeout } from 'node:timers/promises';

// Periodically perform an operation
export class SimplePoll {

    // Current status
    status: 'stopped' | 'running' | 'stopping' = 'stopped';

    // Construct a new polled operation (initially stopped)
    constructor(readonly log: AnsiLogger, readonly description: string, readonly milliseconds: number, readonly op: () => MaybePromise) {}

    // Start the polling operation
    start(): void {
        const wasStopped = this.status === 'stopped';
        this.status = 'running';
        if (wasStopped) void this.doPolling();
    }

    // Stop the polling operation
    stop(): void {
        if (this.status === 'running') {
            this.log.info(`${this.description} stopping`);
            this.status = 'stopping';
        }
    }

    // Is the polling operation active (not stopped)
    get isActive(): boolean {
        return this.status !== 'stopped';
    }

    // Perform the polling
    async doPolling(): Promise<void> {
        this.log.info(`${this.description} starting`);
        while (this.status === 'running') {
            // Try to perform the operation
            try {
                await this.op();
            } catch (err) {
                logError(this.log, this.description, err);
            }

            // Delay until the next iteration
            await setTimeout(this.milliseconds);
        }
        this.status = 'stopped';
        this.log.info(`${this.description} stopped`);
    }
}