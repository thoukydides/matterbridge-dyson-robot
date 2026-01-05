// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/* eslint-disable max-len */

// Compatibility warning message for devices tested against MQTT logs
const PRODUCT_PLACEHOLDER = '<PRODUCT>';
const DYSON_COMPATIBILITY_MQTT_LOGS =
`Support for <PRODUCT> has been validated against third-party MQTT message logs. It has not been tested against a physical device.

The plugin is likely to operate correctly. However, there is a low risk of warnings, errors, or incomplete functionality.

If problems occur, please open a GitHub issue and attach a log captured with "Log MQTT Payloads as JSON" enabled:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/new?template=bug-report.yml

If the device operates correctly, please report this so that this warning can be removed and the compatibility list updated:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/new?template=compatible-device.yml`;

// Compatibility warning message for completely untested device types
const DYSON_COMPATIBILITY_UNTESTED =
`Support for <PRODUCT> has not been tested against real devices or MQTT message logs.

This model appears to be closely related to other validated devices, so the plugin is likely to operate correctly. However, there is a moderate risk of warnings, errors, or missing functionality.

If problems occur, please open a GitHub issue and attach a log captured with "Log MQTT Payloads as JSON" enabled:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/new?template=bug-report.yml

If the device operates correctly, please report this so that this warning can be removed and the compatibility list updated. Include a log captured with "Log MQTT Payloads as JSON" enabled so that it can be added to the plugin's regression tests:
    https://github.com/thoukydides/matterbridge-dyson-robot/issues/new?template=compatible-device.yml`;

/* eslint-enable max-len */

// README.md filename
const README_MD = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

// Parse the README.md file once to extract the compatibility table
const mqttToCompatibility = parseReadmeForCompatibilityTable();

// Generate a compatibility warning for specified device type (MQTT root topic)
export function dysonDeviceCompatibilityWarning(mqttRootTopic: string, product: string): string | undefined {
    // Check whether the compatibility table has an entry for this device
    const testedBy = mqttToCompatibility.get(`\`${mqttRootTopic}\``);

    // Select the appropriate warning message
    if (testedBy === undefined)    return DYSON_COMPATIBILITY_UNTESTED.replaceAll(PRODUCT_PLACEHOLDER, product);
    if (testedBy.includes('✅'))   return undefined;
    if (testedBy.includes('📄'))   return DYSON_COMPATIBILITY_MQTT_LOGS.replaceAll(PRODUCT_PLACEHOLDER, product);
    return `Device compatibility is unknown: ${testedBy}`;
}

// Extract and parse the compatibility table from the README.md file
// (maps MQTT root topic to the Tested By column contents)
function parseReadmeForCompatibilityTable(): Map<string, string> {
    // Read the file and extract the Compatibility section
    const readme = readFileSync(README_MD, 'utf-8');
    const start = readme.indexOf('## Compatibility');
    const end = readme.indexOf('##', start + 1);
    if (start === -1 || end === -1) throw new Error('Unable to find Compatibility table in README.md');
    const section = readme.substring(start, end).split('\n');

    // Parse the compatibility table
    let headings: Map<string, number> | undefined;
    const compatibility = new Map<string, string>();
    for (const line of section) {
        // Split the row into columns
        const columns = line.split('|').map(column => column.trim());
        if (columns.length < 2) continue; // (no table row markup)
        if (!headings) {
            // Extract the column headings from the first row
            headings = new Map(columns.map((heading, index) => [heading, index]));
            continue;
        } else {
            // Extract the columns of interest
            const mqttRootTopic = columns[headings.get('MQTT Root Topic') ?? -1];
            const testedBy      = columns[headings.get('Tested By')       ?? -1];
            if (mqttRootTopic && testedBy) compatibility.set(mqttRootTopic, testedBy);
        }
    }

    // Check that at least one row was successfully parsed
    if (!compatibility.size) throw new Error('Failed to parse Compatibility table in README.md');
    return compatibility;
}