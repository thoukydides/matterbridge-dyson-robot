// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { MatterbridgeDynamicPlatform } from 'matterbridge';
import { ENGINES, PLUGIN_NAME, PLUGIN_VERSION } from './settings.js';
import semver from 'semver';

// Log critical package and API versions
export function checkDependencyVersions(platform: MatterbridgeDynamicPlatform): void {
    const { log } = platform;
    const versions: [string, string | number, string | undefined][] = [
        // Name             Current version                             Required version
        [PLUGIN_NAME,       PLUGIN_VERSION,                             undefined              ],
        ['Node.js',         process.versions.node,                      ENGINES.node           ],
        ['Matterbridge',    platform.matterbridge.matterbridgeVersion,  ENGINES.matterbridge   ]
    ];

    // Log/check each version against the requirements
    versions.forEach(([name, current, required]) => {
        const semverCurrent = semver.coerce(current);
        if (!required) {
            log.info(`${name} version ${current}`);
        } else if (semverCurrent === null) {
            log.warn(`${name} version ${current} cannot be coerced to semver (require ${required})`);
        } else if (semver.satisfies(semverCurrent, required)) {
            log.info(`${name} version ${current} (satisfies ${required})`);
        } else {
            log.error(`${name} version ${current} is incompatible (require ${required})`);
        }
    });
}