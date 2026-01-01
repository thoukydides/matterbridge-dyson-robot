// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { MaybePromise } from 'matterbridge/matter';
import { setTimeout } from 'node:timers/promises';
import { logError } from './log-error.js';

// Status of the operation
export enum PeriodicStatus { 'Stopped', 'Down', 'Up' };

// Configuration of a periodic operation
export interface PeriodicConfig {
    name:       string;
    interval:   number;
    watchdog:   number;
    onOp:       () => MaybePromise;
    onStatus:   (status: PeriodicStatus) => void;
}

// Perform an operation periodically with watchdog timeout
export class Periodic {

    // Is the watchdog being reset before its timeout
    status = PeriodicStatus.Stopped;

    // Abort signal used to cancel timers
    private abortInterval?: AbortController;
    private abortWatchdog?: AbortController;

    // Is this periodic operation enabled
    private enabled = true;

    // Timing of the next operation
    private lastActivityTime = 0;

    // The periodic operation loop
    private runPeriodicPromise: Promise<void>;

    // Start a new periodic operation
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    PeriodicConfig
    ) {
        void this.restartWatchdog();
        this.runPeriodicPromise = this.runPeriodic();
    }

    // Stop the periodic operation, waiting for any in-progress operation
    async stop(): Promise<void> {
        // Terminate the periodic operation and wait for it to complete
        this.enabled = false;
        this.abortInterval?.abort();
        await this.runPeriodicPromise;

        // Stop the watchdog and set the status to 'Stopped'
        this.abortWatchdog?.abort();
        this.setStatus(PeriodicStatus.Stopped);
    }

    // Reset the watchdog and reschedule the next operation
    up(): void {
        // Restart the watchdog timer
        void this.restartWatchdog();

        // Reschedule the next operation
        this.lastActivityTime = Date.now();
        this.abortInterval?.abort();

        // Ensure that the status is 'Up'
        this.setStatus(PeriodicStatus.Up);
    }

    // Set the status
    private setStatus(status: PeriodicStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.config.onStatus(this.status);
        }
    }

    // Perform the operation periodically until stopped
    private async runPeriodic(): Promise<void> {
        while (this.enabled) {
            try {
                // Wait until it is time for the next operation
                this.abortInterval = new AbortController();
                const { signal } = this.abortInterval;
                const timeUntilNextOp =  this.lastActivityTime + this.config.interval - Date.now();
                await setTimeout(timeUntilNextOp, undefined, { signal });

                // Attempt the operation
                await this.config.onOp();

                // Update the time of the last activity (but leave the watchdog)
                this.lastActivityTime = Date.now();
            } catch (err) {
                if (!(err instanceof Error && err.name === 'AbortError')) {
                    logError(this.log, this.config.name, err);
                }
            }
        }
    }

    // (Re)start the watchdog timer
    private async restartWatchdog(): Promise<void> {
        try {
            // Abort any existing watchdog
            this.abortWatchdog?.abort();

            // Start a new watchdog
            this.abortWatchdog = new AbortController();
            const { signal } = this.abortWatchdog;
            await setTimeout(this.config.watchdog, undefined, { signal });

            // The timeout has occurred, so change the status to 'Down'
            this.setStatus(PeriodicStatus.Down);
        } catch (err) {
            if (!(err instanceof Error && err.name === 'AbortError')) {
                logError(this.log, this.config.name, err);
            }
        }
    }
}