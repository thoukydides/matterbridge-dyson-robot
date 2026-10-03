// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { logError } from './log-error.js';
import { columns, formatList, plural } from './utils.js';
import { DYSON_AIR_FAULT_CODES } from './dyson-device-air-faults-table.js';

// Classes of faults
type FaultType = 'error' | 'warning';

// A logger of Dyson air treatment fault codes
export class DysonAirFaultLogger {

    // Last seen active faults
    readonly prevFaults = {
        error:      new Set<string>(),
        warning:    new Set<string>()
    };

    // Online lookup of fault codes
    readonly lookupOnlineCache = new Map<string, string | undefined>();

    // Construct a new fault logger
    constructor(readonly log: AnsiLogger, readonly api?: DysonCloudAPIDevice) {}

    // Detect and log changes in a set of fault codes
    async update(errors?: Set<string>, warnings?: Set<string>): Promise<void> {
        // Identify changes to the list of active faults
        const changes = [
            ...this.detectFaultChanges('error',     errors),
            ...this.detectFaultChanges('warning',   warnings)
        ];
        if (!changes.length) return;

        // If any changes then List all active faults
        const rows = [
            ...await this.describeFaults('error',     errors),
            ...await this.describeFaults('warning',   warnings)
        ];
        this.log.info(`Change detected in active faults: ${formatList(changes)}`);
        this.log.info(`${plural(rows.length, 'active fault')}:`);
        columns(rows).forEach(line => { this.log.info(`    ${line}`); });
    }

    // Detect changes to a set of active faults
    detectFaultChanges(type: FaultType, current = new Set<string>()): string[] {
        // Identify faults which have been added or removed
        const prev      = this.prevFaults[type];
        const added     = [...current.difference(prev)].sort();
        const removed   = [...prev.difference(current)].sort();
        this.prevFaults[type] = current;

        // Log any additions
        const changes: string[] = [];
        if (added.length)   changes.push(`${plural(added.length, `new ${type}`)} (${formatList([...added])})`);
        if (removed.length) changes.push(`${plural(removed.length, `cleared ${type}`)} (${formatList([...removed])})`);
        return changes;
    }

    // Generate descriptions for a set of active faults
    async describeFaults(type: FaultType, faults?: Set<string>): Promise<string[][]> {
        if (!faults?.size) return [];

        // Find descriptions for all active faults
        const rows: string[][] = [];
        for (const faultCode of [...faults].sort()) {
            const msg =
                DYSON_AIR_FAULT_CODES[faultCode]
                ?? await this.findFaultOnline(faultCode)
                ?? 'Unknown fault code';
            rows.push([type, faultCode, msg]);
        }
        return rows;
    }

    // Attempt an online lookup of the fault code
    async findFaultOnline(faultCode: string): Promise<string | undefined> {
        try {
            // Return the cached result if available
            if (this.lookupOnlineCache.has(faultCode)) return this.lookupOnlineCache.get(faultCode);

            // Otherwise attempt to retrieve the fault details from the cloud API
            if (!this.api) return;
            const details = await this.api.getFaultDetailsAirV1(faultCode);
            if (!details.length) throw new Error('No online product support result');
            if (!details.some(d => d.codes.includes(faultCode))) {
                this.log.error('Online product support does not appear to be for the requested fault code');
            }

            // Log detailed support information
            this.log.warn(`Online product support for fault ${faultCode}...`);
            for (const entry of details) {
                const codes = `${plural(entry.codes.length, 'fault code', false)} ${formatList(entry.codes)}`;
                this.log.warn(`[${entry.severity}] "${entry.title}" (${codes}): "${entry.description}"`);
            }

            // Cache and return the combined titles as the fault description
            const msg = formatList(details.map(d => d.title));
            this.lookupOnlineCache.set(faultCode, msg);
            return msg;
        } catch (err) {
            logError(this.log, `Online lookup of fault ${faultCode}`, err);
            this.lookupOnlineCache.set(faultCode, undefined);
        }
    }
}