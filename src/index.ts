// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { Matterbridge, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformDyson } from './platform.js';

// Register the platform with Matterbridge
export default function initializePlugin(
    matterbridge:   Matterbridge,
    log:            AnsiLogger,
    config:         PlatformConfig
): PlatformDyson {
    return new PlatformDyson(matterbridge, log, config);
}
