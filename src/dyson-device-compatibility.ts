// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { PLUGIN_VERSION } from './settings.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Config } from './config-types.js';

// Types of issue that can be created
const DYSON_NEW_ISSUE_URL = 'https://github.com/thoukydides/matterbridge-dyson-robot/issues/new';
export type DysonIssueType = 'bug' | 'compatible';
const DYSON_NEW_ISSUE_TYPES: Record<DysonIssueType, { template: string, labels: string[], title?: string }> = {
    bug: {
        template:   'bug-report.yml',
        labels:     ['bug']
    },
    compatible: {
        template:   'compatible-device.yml',
        labels:     ['compatible device'],
        title:      '[<TOPIC>]: <PRODUCT> confirmed fully supported'
    }
};

/* eslint-disable max-len */

// Compatibility warning message for devices tested against MQTT logs
const DYSON_COMPATIBILITY_MQTT_LOGS =
`Support for <PRODUCT> has only been validated against third-party MQTT message logs. It has not been tested against a physical device.

The plugin is likely to operate correctly. However, there is a low risk of warnings, errors, or incomplete functionality.

If problems occur, please open a GitHub issue and attach a log captured with "Log MQTT Payloads as JSON" enabled:
    <ISSUE_URL_BUG>

If the device operates correctly, please report this so that this warning can be removed and the compatibility list updated:
    <ISSUE_URL_COMPATIBLE>`;

// Compatibility warning message for completely untested device types
const DYSON_COMPATIBILITY_UNTESTED =
`Support for <PRODUCT> has not been tested against real devices or MQTT message logs.

This model appears to be closely related to other validated devices, so the plugin is likely to operate correctly. However, there is a moderate risk of warnings, errors, or missing functionality.

If problems occur, please open a GitHub issue and attach a log captured with "Log MQTT Payloads as JSON" enabled:
    <ISSUE_URL_BUG>

If the device operates correctly, please report this so that this warning can be removed and the compatibility list updated. Include a log captured with "Log MQTT Payloads as JSON" enabled so that it can be added to the plugin's regression tests:
    <ISSUE_URL_COMPATIBLE>`;

// Default message if there are no known compatibility issues
const DYSON_COMPATIBILITY_TESTED =
`No known compatibility issues for <PRODUCT>. If problems occur, please open a GitHub issue and attach a log captured with "Log MQTT Payloads as JSON" enabled:
    <ISSUE_URL_BUG>`;

// README.md filename
const README_MD = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

// Compatibility table from README.md (indexed by MQTT root topic)
type DysonCompatibilityTested = 'physical' | 'mqtt-logs';
let dysonCompatibility: Map<string, DysonCompatibilityTested> | undefined;

/* eslint-enable max-len */

// Generate log messages relating to device compatibility
export class DysonDeviceCompatibility {

    // Template placeholder substitutions
    readonly substitutions = new Map<string, string>();

    // Create a new compatibility message generator
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly product:   string,
        readonly topic:     string,
        readonly firmware?: string
    ) {
        // Prepare the template placeholder substitutions
        this.substitutions.set('<PRODUCT>',                 product);
        this.substitutions.set('<TOPIC>',                   topic);
        this.substitutions.set('<ISSUE_URL_BUG>',           this.makeIssueURL('bug'));
        this.substitutions.set('<ISSUE_URL_COMPATIBLE>',    this.makeIssueURL('compatible'));
    }

    // Substitute any placeholders in the message and log it
    logCompatibility(message?: string): void {
        const suppressWarningDuringTesting = this.config.provisioningMethod === 'Mock Devices';
        const level = suppressWarningDuringTesting || !message ? LogLevel.INFO : LogLevel.WARN;
        const logMessage = this.replacePlaceholders(message ?? DYSON_COMPATIBILITY_TESTED);
        for (const line of logMessage.split('\n')) this.log.log(level, line);
    }

    // Retrieve any compatibility warning for this device
    get warning(): string | undefined {
        dysonCompatibility ??= parseReadmeCompatibilityTable();
        const tested = dysonCompatibility.get(this.topic);
        switch (tested) {
        case 'physical':    return undefined; // (no known compatibility issues)
        case 'mqtt-logs':   return DYSON_COMPATIBILITY_MQTT_LOGS;
        default:            return DYSON_COMPATIBILITY_UNTESTED;
        }
    }

    // Substitute any placeholders in the message template
    replacePlaceholders(message: string): string {
        for (const [key, value] of this.substitutions) message = message.replaceAll(key, value);
        return message.trim();
    }

    // Generate a URL for creating a new GitHub issue
    makeIssueURL(issueType: DysonIssueType): string {
        const { template, labels, title } = DYSON_NEW_ISSUE_TYPES[issueType];
        const url = new URL(DYSON_NEW_ISSUE_URL);
        url.searchParams.set('template',    template);
        url.searchParams.set('labels',      labels.join(','));
        url.searchParams.set('version',     PLUGIN_VERSION);
        url.searchParams.set('appliance',   this.product);
        url.searchParams.set('topic',       this.topic);
        if (title)          url.searchParams.set('title',       this.replacePlaceholders(title));
        if (this.firmware)  url.searchParams.set('firmware',    this.firmware);
        return url.href;
    }
}

// Extract and parse the compatibility table from the README.md file
function parseReadmeCompatibilityTable(): Map<string, DysonCompatibilityTested> {
    // Read the README.md file and extract the Compatibility section
    const readme = readFileSync(README_MD, 'utf-8');
    const start = readme.indexOf('## Compatibility');
    const end   = readme.indexOf('##', start + 1);
    if (start === -1 || end === -1) throw new Error('Unable to find Compatibility table in README.md');
    const section = readme.substring(start, end);

    // Parse the compatibility table
    let headings: Map<string, number> | undefined;
    const parsedTable = new Map<string, DysonCompatibilityTested>();
    const tableRows = section.split('\n').filter(line => line.startsWith('|'));
    for (const line of tableRows) {
        // Split the row into columns
        const columns = line.split('|').map(column => column.trim());
        if (!headings) {
            // Extract the column headings from the first row
            headings = new Map(columns.map((heading, index) => [heading, index]));
        } else if (columns.every(column => /^:?-*:?$/.test(column))) {
            // Ignore delimiter rows
        } else {
            // Extract and parse the columns of interest
            const mqttRootTopic = columns[headings.get('MQTT Root Topic') ?? -1];
            const testedBy      = columns[headings.get('Tested By')       ?? -1];
            const topicMatches  = mqttRootTopic?.match(/(?<=`)\w+(?=`)/g);
            const compatibility = testedBy?.includes('✅') ? 'physical' : testedBy?.includes('📄') ? 'mqtt-logs' : undefined;
            if (!topicMatches || !compatibility) throw new Error(`Failed to parse Compatibility table in README.md: ${line}`);
            for (const topic of topicMatches) parsedTable.set(topic, compatibility);
        }
    }

    // Check that at least one row was successfully parsed
    if (!parsedTable.size) throw new Error('Failed to parse Compatibility table in README.md');
    return parsedTable;
}