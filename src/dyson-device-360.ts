// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { BasicInformation } from 'matterbridge/matter/clusters';
import { RvcCleanMode360 } from './endpoint-360-behavior.js';
import {
    Dyson360EyePowerMode,
    Dyson360HeuristPowerMode,
    Dyson360VisNavPowerMode
} from './dyson-360-types.js';
import { DysonDevice360Base, PowerModeMap } from './dyson-device-360-base.js';

// A Dyson 360 Eye device
export class DysonDevice360Eye extends DysonDevice360Base {
    static readonly model = { type: 'N223', number: 'RB01', name: '360 Eye' };

    override getBatteryPartNumber = () => '968734-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Polished,
        primaryColor:   BasicInformation.Color.Nickel // (or Fuchsia for Japan limited edition)
    });

    override getPowerModeMaps = (): PowerModeMap[] => [
        [Dyson360EyePowerMode.Quiet,        RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360EyePowerMode.Max,          RvcCleanMode360.MaxBoost,   'Max']
    ];
}

// A Dyson 360 Heurist device
export class DysonDevice360Heurist extends DysonDevice360Base {
    static readonly model = { type: '276', number: 'RB02', name: '360 Heurist' };

    override getBatteryPartNumber = () => '970049-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerModeMaps = (): PowerModeMap[] => [
        [Dyson360HeuristPowerMode.Quiet,    RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360HeuristPowerMode.High,     RvcCleanMode360.High,       'High'],
        [Dyson360HeuristPowerMode.Max,      RvcCleanMode360.MaxBoost,   'Max']
    ];
}

// A Dyson 360 Vis Nav device
export class DysonDevice360VisNav extends DysonDevice360Base {
    static readonly model = { type: '277', number: 'RB03', name: '360 Vis Nav' };

    override getBatteryPartNumber = () => '967864-02';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Satin,
        primaryColor:   BasicInformation.Color.Blue
    });

    override getPowerModeMaps = (): PowerModeMap[] => [
        [Dyson360VisNavPowerMode.Auto,      RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VisNavPowerMode.Quick,     RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VisNavPowerMode.Quiet,     RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VisNavPowerMode.Boost,     RvcCleanMode360.MaxBoost,   'Boost'],
        [Dyson360VisNavPowerMode.Unknown,   RvcCleanMode360.Auto,       'Auto']
    ];
}

// A Dyson 360 Spot+Scrub device
export class DysonDevice360SpotScrub extends DysonDevice360Base {
    static readonly model = { type: '804', number: 'RB05', name: 'Spot+Scrub' };

    override getBatteryPartNumber = () => '975571-01';

    override getProductAppearance = () => ({
        finish:         BasicInformation.ProductFinish.Matte,
        primaryColor:   BasicInformation.Color.Black
    });

    override getPowerModeMaps = (): PowerModeMap[] => [
        [Dyson360VisNavPowerMode.Auto,      RvcCleanMode360.Auto,       'Auto'],
        [Dyson360VisNavPowerMode.Quick,     RvcCleanMode360.Quick,      'Quick'],
        [Dyson360VisNavPowerMode.Quiet,     RvcCleanMode360.Quiet,      'Quiet'],
        [Dyson360VisNavPowerMode.Boost,     RvcCleanMode360.MaxBoost,   'Boost'],
        [Dyson360VisNavPowerMode.Unknown,   RvcCleanMode360.Auto,       'Auto']
    ];
}

// List of constructors for Dyson robot vacuum devices
export const DYSON_DEVICE_TYPES_360 = [
    DysonDevice360Eye,
    DysonDevice360Heurist,
    DysonDevice360VisNav,
    DysonDevice360SpotScrub
] as const;