// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { DysonManifestCategory } from './dyson-cloud-types.js';
import { DysonCloud } from './dyson-cloud.js';
import { DysonCloudAPI } from './dyson-cloud-api.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { assertIsDefined, columns, formatList, plural } from './utils.js';
import { logError } from './log-error.js';
import { isSupportedModel } from './dyson-device.js';
import { Config } from './config-types.js';

// Scrape the Dyson API for any unsupported products or fault codes
export async function dysonCloudScrape(
    log:        AnsiLogger,
    config:     Config,
    cloudApi:   DysonCloud,
    devices:    { api?: DysonCloudAPIDevice }[]
): Promise<void> {
    const api = await cloudApi.api;
    if (config.debugFeatures.includes('Scrape MQTT Topics')) {
        // Scrape list of products
        await dysonCloudScrapeProducts(log, api);
    }
    if (config.debugFeatures.includes('Scrape Fault Codes')) {
        if (config.debugScrapeSN) {
            // Scrape faults for a single serial number
            const deviceApi = api.createDeviceClient(log, config.debugScrapeSN);
            await dysonCloudScrapeFaults(log, deviceApi);
        } else {
            // Scrape faults for all devices with a cloud API
            for (const device of devices) {
                if (device.api) await dysonCloudScrapeFaults(log, device.api);
            }
        }
    }
}

// Check for Dyson products that are not supported by this plugin
async function dysonCloudScrapeProducts(log: AnsiLogger, api: DysonCloudAPI): Promise<void> {
    try {
        // Retrieve the product attributes
        const products = await api.getProductAttributesV1();

        // Group candidate products by MQTT root topic
        interface ProductEntry { variants: Set<string>, models: Set<string> }
        interface ProductTopic { topic: string, names: Map<string, ProductEntry> };
        const byRootTopic = new Map<string, ProductTopic>();
        const CATEGORIES = [DysonManifestCategory.RobotVacuum, DysonManifestCategory.AirTreatment];
        for (const product of Object.values(products)) {
            const { deviceCategory, productName, model, variant, mqttRootTopicLevel: topic } = product;

            // Exclude products that are not relevant to this plugin
            const categoryIndex = CATEGORIES.indexOf(deviceCategory);
            if (categoryIndex === -1)                   continue;
            if (!productName || !topic)                 continue;
            if (/\b(test|dummy)\b/i.test(productName))  continue;

            // Collect identifiers by MQTT topic and product name
            const sortKey = `${categoryIndex}_${topic}`;
            let nameMap = byRootTopic.get(sortKey);
            if (!nameMap) byRootTopic.set(sortKey, nameMap = { topic, names: new Map<string, ProductEntry>() });
            const name = productName.replaceAll('™', '');
            let entry = nameMap.names.get(name);
            if (!entry) nameMap.names.set(name, entry = { variants: new Set<string>(), models: new Set<string>() });
            entry.variants.add(variant);
            entry.models.add(model);
        }

        // Filter the root topics to those that are not already supported
        const topics = [...byRootTopic.keys()].sort().map(key => byRootTopic.get(key)) as ProductTopic[];
        const unsupportedCount = topics.filter(({ topic }) => !isSupportedModel(topic)).length;
        const allDescription = plural(topics.length, 'applicable product MQTT root topic');
        if (unsupportedCount) {
            log.warn(`${unsupportedCount} of ${allDescription} unrecognised by this plugin:`);
        } else {
            log.info(`All ${allDescription} recognised by this plugin:`);
        }

        // Display a warning for each unsupported product
        const rows: string[][] = [['', 'MQTT', 'Product Name', 'Models', 'Variants']];
        for (const { topic, names } of topics) {
            assertIsDefined(names);
            const isSupported = isSupportedModel(topic);
            rows.push(isSupported ? ['✔️', `${topic}:`] : ['❌', `${topic}:`]);

            // Format the different names for this product
            const allVariants = names.values().reduce((set, { variants }) => set.union(variants), new Set<string>());
            const formatModels   = (models:   Set<string>) => `(${[...models].sort().join('/')})`;
            const formatVariants = (variants: Set<string>) =>
                allVariants.size === 1 ? '' : [...variants].sort().map(v => v || '∅').join(' ');
            rows.push(...[...names.entries()]
                .map(([name, { models, variants }]) => ['', '', name, formatModels(models), formatVariants(variants)])
                .sort(([,,, modelA], [,,, modelB]) => (modelA ?? '').localeCompare(modelB ?? '')));
        }
        for (const line of columns(rows)) {
            const level = line.includes('❌') ? LogLevel.WARN : LogLevel.INFO;
            log.log(level, `    ${line}`);
        }
    } catch (err) {
        logError(log, 'Get product attributes', err);
    }
}

// Attempt to retrieve the list of known fault codes for a device
async function dysonCloudScrapeFaults(log: AnsiLogger, api: DysonCloudAPIDevice): Promise<void> {
    const deviceName = api.modelName ? `${api.modelName} (${api.modelNumber})` : api.serialNumber;
    try {
        // Attempt to retrieve the fault codes
        const allFaultCodes = await api.getFaultDetailsV1();

        // Group the fault descriptions by code, excluding those without a title
        const faultMap = new Map<string, string[]>();
        const undocumentedFaults = new Set<string>();
        for (const { codes, title, description, severity } of allFaultCodes) {
            for (const code of codes) {
                if (title) {
                    if (faultMap.has(code)) log.warn(`Fault code ${code} duplicated for ${deviceName}`);
                    faultMap.set(code, [code, `[${severity}]`, title, description]);
                } else {
                    undocumentedFaults.add(code);
                }
            }
        }

        // Display a summary of the documented fault codes
        const faultCodes = sortStrings([...faultMap.keys()]);
        log.info(`${faultCodes.length} of ${plural(allFaultCodes.length, 'reported fault code')} for ${deviceName}:`);
        const rows = faultCodes.map(code => faultMap.get(code) ?? []);
        columns(rows).forEach(line => { log.info(`    ${line}`); });

        // List any fault codes without descriptions
        if (undocumentedFaults.size) {
            const listOfCodes = formatList(sortStrings([...undocumentedFaults], true));
            log.info(`${plural(undocumentedFaults.size, 'fault code')} without description: ${listOfCodes}`);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.info(`Unable to retrieve fault codes for ${deviceName}: ${message}`);
    }
}

// Sort strings numerically if all numbers, otherwise lexicographically
function sortStrings(values: string[], merge = false): string[] {
    // Sort the strings appropriately based on their values
    const allNumeric = values.every(s => /^\d+$/.test(s));
    if (!allNumeric) return values.toSorted();
    const sorted = values.toSorted((a, b) => Number(a) - Number(b));
    if (!merge || !sorted.length) return sorted;

    // Merge adjacent numeric strings
    const ranges = sorted.reduce<[string, string][]>((acc, value) => {
        const last = acc.at(-1);
        if (last?.[1] === String(Number(value) - 1))    last[1] = value;
        else                                            acc.push([value, value]);
        return acc;
    }, []);
    return ranges.map(([start, end]) => start === end ? start : `${start}-${end}`);
}
