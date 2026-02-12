// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { PlatformMatterbridge, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformDyson } from './platform.js';

// Register the platform with Matterbridge
export default function initializePlugin(
    matterbridge:   PlatformMatterbridge,
    log:            AnsiLogger,
    config:         PlatformConfig
): PlatformDyson {
    return new PlatformDyson(matterbridge, log, config);
}
