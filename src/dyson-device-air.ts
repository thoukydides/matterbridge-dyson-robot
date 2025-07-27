// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { DysonDeviceAirBase } from './dyson-device-air-base.js';
import { DysonDeviceAirWithHeat as DysonDeviceAirHeatMixin } from './dyson-device-air-heat.js';

// =============================================================================
// Dyson Pure (Hot)+Cool Link family...

// Dyson Pure Cool Link
export class DysonDeviceAirCoolLink extends DysonDeviceAirBase {
    static readonly model = { type: '475', number: 'TP02', name: 'Pure Cool Link' };
    static readonly filters = { hepa: ['972426-01'] };
}

// Dyson Pure Cool Link alias without significant functional differences
export class DysonDeviceAirCoolLinkDesk extends DysonDeviceAirCoolLink {
    static readonly model = { type: '469', number: 'DP01', name: 'Pure Cool Link Desk' };
    static readonly filters = { hepa: ['972425-01'] };
}

// -----------------------------------------------------------------------------

// Dyson Pure Hot+Cool Link
export class DysonDeviceAirHotCoolLink extends DysonDeviceAirHeatMixin(DysonDeviceAirCoolLink) {
    static readonly model = { type: '455', number: 'HP02', name: 'Pure Hot+Cool Link' };
    static readonly filters = { hepa: ['972425-01'] };
}

// Dyson Pure Hot+Cool Link alias without significant functional differences
export class DysonDeviceAirHotCoolLinkA extends DysonDeviceAirHotCoolLink {
    static readonly model = { type: '455A', number: 'HP02', name: 'Pure Hot+Cool Link' };
}

// =============================================================================
// Dyson Pure Cool family...

// Common base class for Dyson Pure (Humidify|Hot+)Cool family devices
export abstract class DysonDeviceAirCoolBase extends DysonDeviceAirBase {
    static readonly filters = { hepa: ['965432-01'] };
}

// -----------------------------------------------------------------------------

// Dyson Pure Cool
export class DysonDeviceAirCool extends DysonDeviceAirCoolBase {
    static readonly model = { type: '438', number: 'TP04/TP06', name: 'Pure Cool' };
}

// Dyson Pure Cool aliases without significant functional differences
export class DysonDeviceAirCoolE extends DysonDeviceAirCool {
    static readonly model = { type: '438E', number: 'TP07/TP09', name: 'Pure Cool Formaldehyde' };
}
export class DysonDeviceAirCoolK extends DysonDeviceAirCool {
    static readonly model = { type: '438K', number: 'TP07/TP09', name: 'Pure Cool Formaldehyde' };
}
export class DysonDeviceAirCoolM extends DysonDeviceAirCool {
    static readonly model = { type: '438M', number: 'TP11/PC1', name: 'Pure Cool' };
}
export class DysonDeviceAirCoolDesk extends DysonDeviceAirCool {
    static readonly model = { type: '520', number: 'DP04', name: 'Pure Cool Desk' };
}

// -----------------------------------------------------------------------------

// Dyson Pure Humidify+Cool
export class DysonDeviceAirHumidifyCool extends DysonDeviceAirCoolBase {
    static readonly model = { type: '358', number: 'PH01', name: 'Pure Humidify+Cool' };
}

// Dyson Pure Humidify+Cool aliases without significant functional differences
export class DysonDeviceAirHumidifyCoolE extends DysonDeviceAirHumidifyCool {
    static readonly model = { type: '358E', number: 'PH03', name: 'Pure Humidify+Cool' };
}
export class DysonDeviceAirHumidifyCoolK extends DysonDeviceAirHumidifyCool {
    static readonly model = { type: '358K', number: 'PH04', name: 'Pure Humidify+Cool Formaldehyde' };
}

// -----------------------------------------------------------------------------

// Dyson Pure Hot+Cool
export class DysonDeviceAirHotCool extends DysonDeviceAirHeatMixin(DysonDeviceAirCool) {
    static readonly model = { type: '527', number: 'HP04/HP06', name: 'Pure Hot+Cool' };
}

// Dyson Pure Hot+Cool aliases without significant functional differences
export class DysonDeviceAirHotCoolE extends DysonDeviceAirHotCool {
    static readonly model = { type: '527E', number: 'HP07', name: 'Purifier Hot+Cool' };
}
export class DysonDeviceAirHotCoolK extends DysonDeviceAirHotCool {
    static readonly model = { type: '527K', number: 'HP09', name: 'Purifier Hot+Cool Formaldehyde' };
}
export class DysonDeviceAirHotCoolM extends DysonDeviceAirHotCool {
    static readonly model = { type: '527M', number: 'HP1/HP11', name: 'Purifier Hot+Cool' };
}

// =============================================================================
// Dyson Big+Quiet family...

// All Dyson Big+Quiet devices share the same type code
export class DysonDeviceAirBigQuiet extends DysonDeviceAirBase {
    static readonly model = { type: '664', number: 'BP02/BP03/BP04/BP06', name: 'Purifier Big+Quiet Series' };
    static readonly filters = { hepa: ['972132-01'], carbon: ['972133-03'] };
}

// =============================================================================
// Dyson Cool family... (fan only; no purification)

// Dyson Cool
export class DysonDeviceCool extends DysonDeviceAirBase {
    static readonly model = { type: '739', number: 'CF1/AM12', name: 'Cool' };
    static readonly filters = {};
}

// =============================================================================