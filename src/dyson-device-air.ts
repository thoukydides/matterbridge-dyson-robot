// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonDeviceAirBase } from './dyson-device-air-base.js';
import { DysonDeviceAirHeatMixin } from './dyson-device-air-heat.js';

// =============================================================================
// Dyson Pure (Hot)+Cool Link family...

// Dyson Pure Cool Link
export class DysonDeviceAirCoolLink extends DysonDeviceAirBase {
    static readonly model = { type: '475', number: 'TP02/TP03', name: 'Pure Cool Link' };
    static readonly filters = { hepa: ['972426-01'] };
}

// Dyson Pure Cool Link alias without significant functional differences
export class DysonDeviceAirCoolLinkDesk extends DysonDeviceAirCoolLink {
    static readonly model = { type: '469', number: 'DP01/DP02/DP03', name: 'Pure Cool Link' };
    static readonly filters = { hepa: ['972425-01'] };
}

// -----------------------------------------------------------------------------

// Dyson Pure Hot+Cool Link
export class DysonDeviceAirHotCoolLink extends DysonDeviceAirHeatMixin(DysonDeviceAirCoolLink) {
    static readonly model = { type: '455', number: 'HP02/HP03', name: 'Pure Hot+Cool Link' };
    static readonly filters = { hepa: ['972425-01'] };
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
    static readonly model = { type: '438', number: 'TP04/TP06', name: 'Pure Cool (Cryptomic)' };
}

// Dyson Pure Cool aliases without significant functional differences
export class DysonDeviceAirCoolE extends DysonDeviceAirCool {
    static readonly model = { type: '438E', number: 'TP07', name: 'Pure Cool (Formaldehyde)' };
}
export class DysonDeviceAirCoolK extends DysonDeviceAirCool {
    static readonly model = { type: '438K', number: 'TP07/TP7C/TP09/TP12', name: 'Pure Cool (Formaldehyde / PC2 De-NOx)' };
}
export class DysonDeviceAirCoolM extends DysonDeviceAirCool {
    static readonly model = { type: '438M', number: 'TP11', name: 'Purifier Cool PC1' };
}
export class DysonDeviceAirCoolN extends DysonDeviceAirCool {
    static readonly model = { type: '438N', number: 'TP14', name: 'Find+Follow Purifier Cool PC3' };
    static readonly filters = { hepa: ['974527-01'] };
}
export class DysonDeviceAirCoolDesk extends DysonDeviceAirCool {
    static readonly model = { type: '520', number: 'DP04', name: 'Pure Cool' };
}

// -----------------------------------------------------------------------------

// Dyson Pure Humidify+Cool
export class DysonDeviceAirHumidifyCool extends DysonDeviceAirCoolBase {
    static readonly model = { type: '358', number: 'PH01/PH02', name: 'Pure Humidify+Cool (Cryptomic)' };
}

// Dyson Pure Humidify+Cool aliases without significant functional differences
export class DysonDeviceAirHumidifyCoolE extends DysonDeviceAirHumidifyCool {
    static readonly model = { type: '358E', number: 'PH03/PH04', name: 'Pure Humidify+Cool (Formaldehyde)' };
}
export class DysonDeviceAirHumidifyCoolK extends DysonDeviceAirHumidifyCool {
    static readonly model = { type: '358K', number: 'PH03/PH04/PH05', name: 'Pure Humidify+Cool (Formaldehyde / PH2 De-NOx)' };
}

// -----------------------------------------------------------------------------

// Dyson Pure Hot+Cool
export class DysonDeviceAirHotCool extends DysonDeviceAirHeatMixin(DysonDeviceAirCool) {
    static readonly model = { type: '527', number: 'HP04/HP06', name: 'Pure Hot+Cool (Cryptomic)' };
}

// Dyson Pure Hot+Cool aliases without significant functional differences
export class DysonDeviceAirHotCoolE extends DysonDeviceAirHotCool {
    static readonly model = { type: '527E', number: 'HP07/HP09', name: 'Purifier Hot+Cool (Formaldehyde)' };
}
export class DysonDeviceAirHotCoolK extends DysonDeviceAirHotCool {
    static readonly model = { type: '527K', number: 'HP07/HP7C/HP09/HP4B/HP12', name: 'Purifier Hot+Cool (Formaldehyde / HP2 De-NOx)' };
}
export class DysonDeviceAirHotCoolM extends DysonDeviceAirHotCool {
    static readonly model = { type: '527M', number: 'HP11', name: 'Purifier Hot+Cool HP1' };
}
export class DysonDeviceAirHotCoolN extends DysonDeviceAirHotCool {
    static readonly model = { type: '527N', number: 'HP14', name: 'Purifier Hot+Cool' };
}

// =============================================================================
// Dyson Big+Quiet family...

// All Dyson Big+Quiet devices share the same type code
export class DysonDeviceAirBigQuiet extends DysonDeviceAirBase {
    static readonly model = { type: '664', number: 'BP02/BP03/BP04', name: 'Purifier Big+Quiet (Formaldehyde)' };
    static readonly filters = { hepa: ['972132-01'], carbon: ['972133-03'] };
}

// =============================================================================
// Dyson (Hot)+Cool family... (fan only; no purification)

// Dyson Cool
export class DysonDeviceCool extends DysonDeviceAirBase {
    static readonly model = { type: '739', number: 'AM12', name: 'Cool CF1' };
    static readonly filters = {};
}

// -----------------------------------------------------------------------------

// Dyson Hot+Cool
export class DysonDeviceHotCool extends DysonDeviceAirHeatMixin(DysonDeviceCool) {
    static readonly model = { type: '635', number: 'AM15', name: 'Hot+Cool HF1' };
}

// =============================================================================
// Dyson HushJet family...

// Dyson HushJet Purifier Compact
export class DysonDeviceAirHushJetCompact extends DysonDeviceAirBase {
    static readonly model = { type: '897', number: 'SP01', name: 'HushJet Purifier Compact HJ10' };
    static readonly filters = {  hepa: ['975060-01'], carbon: ['975061-01'] };
}

// -----------------------------------------------------------------------------

// Placeholders for newer HushJet models
export class DysonDeviceAirHushJetBigQuiet extends DysonDeviceAirBase {
    static readonly model = { type: '831', number: 'BP10', name: 'HushJet Big+Quiet Purifier' };
    static readonly filters = {}; // HERE - Add when part number known
}
export class DysonDeviceAirHushJetHotCool extends DysonDeviceAirHeatMixin(DysonDeviceAirBase) {
    static readonly model = { type: '918', number: 'JH01', name: 'HushJet Hot Cool Pure+' };
    static readonly filters = {}; // HERE - Add when part number known
}
export class DysonDeviceAirHushJetIoniserUV extends DysonDeviceAirBase {
    static readonly model = { type: '994', number: 'MP01', name: 'HushJet Cool Pure+ Formaldehyde / Ioniser+UV' };
    static readonly filters = {}; // HERE - Add when part number known
}

// =============================================================================

// List of constructors for Dyson air treatment devices
export const DYSON_DEVICE_TYPES_AIR = [
    DysonDeviceAirCoolLink,
    DysonDeviceAirCoolLinkDesk,
    DysonDeviceAirHotCoolLink,
    DysonDeviceAirCool,
    DysonDeviceAirCoolE,
    DysonDeviceAirCoolK,
    DysonDeviceAirCoolM,
    DysonDeviceAirCoolN,
    DysonDeviceAirCoolDesk,
    DysonDeviceAirHumidifyCool,
    DysonDeviceAirHumidifyCoolE,
    DysonDeviceAirHumidifyCoolK,
    DysonDeviceAirHotCool,
    DysonDeviceAirHotCoolE,
    DysonDeviceAirHotCoolK,
    DysonDeviceAirHotCoolM,
    DysonDeviceAirHotCoolN,
    DysonDeviceAirBigQuiet,
    DysonDeviceCool,
    DysonDeviceHotCool,
    DysonDeviceAirHushJetCompact,
    DysonDeviceAirHushJetBigQuiet,
    DysonDeviceAirHushJetHotCool,
    DysonDeviceAirHushJetIoniserUV
] as const;