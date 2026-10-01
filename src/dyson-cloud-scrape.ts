// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { DysonManifestCategory } from './dyson-cloud-types.js';
import { DysonCloud } from './dyson-cloud.js';
import { DysonCloudAPI } from './dyson-cloud-api.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { assertIsDefined, columns, formatList, plural } from './utils.js';
import { logError } from './log-error.js';
import { Dyson360FaultResponseV1 } from './dyson-360-cloud-types.js';
import { DysonAirFaultResponseV1 } from './dyson-air-cloud-types.js';
import { isSupportedModel } from './dyson-device.js';
import { Config } from './config-types.js';

// Scrape the Dyson API for any unsupported products or fault codes
export async function dysonCloudScrape(
    log:        AnsiLogger,
    config:     Config,
    api:        DysonCloud,
    devices:    { api?: DysonCloudAPIDevice }[]
): Promise<void> {
    if (config.debugFeatures.includes('Scrape MQTT Topics')) {
        await dysonCloudScrapeProducts(log, await api.api);
    }
    if (config.debugFeatures.includes('Scrape Fault Codes')) {
        for (const device of devices) {
            if (device.api) await dysonCloudScrapeFaults(log, device.api);
        }
    }
}

// Check for Dyson products that are not supported by this plugin
async function dysonCloudScrapeProducts(log: AnsiLogger, api: DysonCloudAPI): Promise<void> {
    try {
        // Retrieve the product attributes
        const products = await api.getProductAttributesV1();

        // Group candidate products by MQTT root topic
        const byRootTopic = new Map<string, Map<string, Set<string>>>();
        const CATEGORIES: Partial<Record<DysonManifestCategory, string>> = {
            [DysonManifestCategory.AirTreatment]:   'Air Treatment',
            [DysonManifestCategory.RobotVacuum]:    'Robot Vacuum'
        };
        for (const product of Object.values(products)) {
            const { deviceCategory, productName, model, mqttRootTopicLevel: rootTopic } = product;
            const category = CATEGORIES[deviceCategory];
            if (!productName || !rootTopic || !category) continue;
            if (/\b(test|dummy)\b/i.test(productName)) continue;
            const name = `[${category}] ${productName}`;
            let nameMap = byRootTopic.get(rootTopic);
            if (!nameMap) byRootTopic.set(rootTopic, nameMap = new Map<string, Set<string>>());
            let modelSet = nameMap.get(name);
            if (!modelSet) nameMap.set(name, modelSet = new Set<string>());
            modelSet.add(model);
        }

        // Filter the root topics to those that are not already supported
        const rootTopics = [...byRootTopic.keys()].sort();
        const unsupportedCount = rootTopics.filter(topic => !isSupportedModel(topic)).length;

        // Display a warning for each unsupported product
        const allDescription = plural(rootTopics.length, 'product MQTT root topic');
        if (unsupportedCount) {
            log.warn(`${unsupportedCount} of ${allDescription} unrecognised by this plugin:`);
        } else {
            log.info(`All ${allDescription} recognised by this plugin:`);
        }
        for (const rootTopic of rootTopics) {
            const nameMap = byRootTopic.get(rootTopic);
            assertIsDefined(nameMap);
            const isSupported = isSupportedModel(rootTopic);
            if (isSupported)    log.info(` ✔️  ${rootTopic}:`);
            else                log.warn (` ❌  ${rootTopic}:`);
            for (const [name, models] of nameMap.entries()) {
                log.log(isSupported ? LogLevel.INFO : LogLevel.WARN,
                        `      ${name} (${formatList([...models])})`);
            }
        }
    } catch (err) {
        logError(log, 'Get product attributes', err);
    }
}

// Attempt to retrieve the list of known fault codes for a device
async function dysonCloudScrapeFaults(log: AnsiLogger, api: DysonCloudAPIDevice): Promise<void> {
    try {
        // Attempt to retrieve the fault codes
        let allFaultCodes: Dyson360FaultResponseV1 | DysonAirFaultResponseV1;
        switch (api.manifest.category) {
        case DysonManifestCategory.RobotVacuum:     allFaultCodes = await api.getFaultDetails360V1(); break;
        case DysonManifestCategory.AirTreatment:    allFaultCodes = await api.getFaultDetailsAirV1(); break;
        default:    throw new Error(`Fault code retrieval not implemented for ${api.manifest.category}`);
        }

        // Sort the fault codes by code, excluding those without a title
        const faultMap = new Map<string, string[]>();
        for (const { codes, title, description, severity } of allFaultCodes) {
            if (!title) continue;
            for (const code of codes) {
                if (faultMap.has(code)) log.warn(`Fault code ${code} duplicated`);
                faultMap.set(code, [code, `[${severity}]`, title, description]);
            }
        }
        const faultCodes = [...faultMap.keys()].sort();

        // Display a summary of the fault codes
        log.info(`${faultCodes.length} of ${plural(allFaultCodes.length, 'reported fault code')} for this device:`);
        const rows = faultCodes.map(code => faultMap.get(code) ?? []);
        columns(rows).forEach(line => { log.info(`    ${line}`); });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.info(`Unable to retrieve fault codes for this device: ${message}`);
    }
}