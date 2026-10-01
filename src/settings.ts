// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { Config } from './config-types.js';
import PACKAGE from '../package.json' with { type: 'json' };

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
    enableServerRvc:        true,
    simpleModeTagsRvc:      true,
    logMapStyle:            'Matterbridge',
    debug:                  false,
    debugFeatures:          [],
    unregisterOnShutdown:   false
};

// Vendor name
export const VENDOR_NAME = 'Dyson';
export const VENDOR_ID   = 0x139E; // Dyson's official Matter Vendor ID