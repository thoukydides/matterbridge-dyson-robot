// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Config } from './config-types.js';

// Read the package.json file
interface PackageJson {
    engines:        Record<string, string>;
    name:           string;
    displayName:    string;
    version:        string;
    homepage:       string;
}
const PACKAGE_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const PACKAGE = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as PackageJson;

// Platform identifiers
export const ENGINES        = PACKAGE.engines;
export const PLUGIN_NAME    = PACKAGE.name;
export const PLATFORM_NAME  = PACKAGE.displayName;
export const PLUGIN_VERSION = PACKAGE.version;
export const PLUGIN_URL     = PACKAGE.homepage;

// Default configuration options
export const DEFAULT_CONFIG: Readonly<Partial<Config>> = {
    whiteList:              [],
    blackList:              [],
    entityWhiteList:        [],
    entityBlackList:        ['Composed Air Purifier', 'Humidity Sensor', 'Temperature Sensor'],
    deviceEntityBlackList:  {},
    provisioningMethod:     'Remote Account',
    ...(process.env.DYSON_TOKEN && {
        dysonAccount: {
            china:      false,
            token:      process.env.DYSON_TOKEN
        }
    }),
    wildcardTopic:          false,
    debug:                  false,
    debugFeatures:          [],
    unregisterOnShutdown:   false
};

// Vendor name
export const VENDOR_NAME = 'Dyson';