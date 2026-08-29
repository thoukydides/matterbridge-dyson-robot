// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    PowerSource,
    RvcOperationalState
} from 'matterbridge/matter/clusters';
import {
    Dyson360ActiveFault,
    Dyson360FaultNextAction,
    Dyson360FaultPresent,
    Dyson360Faults,
    Dyson360FaultStatus,
    Dyson360State
} from './dyson-360-types.js';
import { assert } from 'console';
import { RvcOperationalStateError } from './error-360.js';
import {
    Dyson360FaultCategory,
    Dyson360FaultDetail,
    Dyson360FaultPattern,
    Dyson360FaultPatternOrRange,
    DYSON_360_FAULT_CATEGORIES,
    DYSON_360_FAULT_TRIPLET_CODES,
    DYSON_360_FAULT_STATES,
    DYSON_360_FAULT_SINGLE_CODES
} from './dyson-device-360-faults-table.js';
import { assertIsDefined } from './utils.js';
import { AnsiLogger } from 'matterbridge/logger';

// A fault code pattern triplet in numeric form
type Dyson360FaultTriplet           = [number, number, number];
type Dyson360FaultTripletPattern    = number[];
type Dyson360FaultTripletRange      = [number, number][];

// RVC cluster attributes corresponding to Dyson robot vacuum faults
export interface Dyson360MappedFaults {
    operationalError:       RvcOperationalState.ErrorStateStruct;
    activeBatFaults:        PowerSource.BatFault[];
    activeBatChargeFaults:  PowerSource.BatChargeFault[];
}

// Parse a fault code into numeric form
function parseFaultCode(code: string): Dyson360FaultTriplet | number {
    const parts = code.split('.').map(Number);
    if (parts.some(isNaN)) throw new Error(`Non-numeric fault code: ${code}`);
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    if (parts.length === 1 ) return parts[0] as number;
    if (parts.length === 3) return parts as Dyson360FaultTriplet;
    throw new Error(`Invalid fault code: ${code}`);
}

// Parse a fault pattern triplet into a numeric array
function parseFaultPatternTriplet(codeOrPattern: Dyson360FaultPattern): Dyson360FaultTripletPattern {
    const parts = codeOrPattern.split('.');
    const wildcardIndex = parts.indexOf('#');
    if (wildcardIndex !== -1) parts.length = wildcardIndex;
    return parts.map(Number);
}

// Parse a fault pattern or range triplet into an array of numeric ranges
function parseFaultRangeTriplet(patternOrRange: Dyson360FaultPatternOrRange): Dyson360FaultTripletRange {
    const low   = parseFaultPatternTriplet(Array.isArray(patternOrRange) ? patternOrRange[0] : patternOrRange);
    const high  = parseFaultPatternTriplet(Array.isArray(patternOrRange) ? patternOrRange[1] : patternOrRange);
    assert(low.length === high.length);
    const zipped = low.map((l, i) => [l, high[i]] as [number, number]);
    return zipped;
}

// Test whether a fault code triplet is in a range, returning its specificity
function isFaultInRangeTriplet(patternOrRange: Dyson360FaultPatternOrRange, code: Dyson360FaultTriplet): number {
    const range = parseFaultRangeTriplet(patternOrRange);
    assert(range.length <= code.length);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (range.some(([l, h], i) => code[i]! < l || h < code[i]!)) return 0;
    return range.length;
}

// Find the most specific match for a fault code
function findFaultMatch(fault: string): Dyson360FaultDetail | undefined {
    // Simple lookup for Spot+Scrub Ai single-code format
    const code = parseFaultCode(fault);
    if (typeof code === 'number') return DYSON_360_FAULT_SINGLE_CODES.get(code);

    // Otherwise find the most specific match for a triplet code
    let bestDetail: Dyson360FaultDetail | undefined;
    let bestSpecificity = 0;
    for (const [patternOrRange, detail] of DYSON_360_FAULT_TRIPLET_CODES) {
        const specificity = isFaultInRangeTriplet(patternOrRange, code);
        if (bestSpecificity < specificity) {
            bestSpecificity = specificity;
            bestDetail = detail;
        }
    }
    return bestDetail;
}

// Find the matches for a robot state in priority order
function getFaultDetails(
    log:            AnsiLogger,
    state:          Dyson360State,
    faults?:        Dyson360Faults,
    activeFaults?:  Dyson360ActiveFault[]
): Dyson360FaultDetail[] {
    const detailList: Dyson360FaultDetail[] = [];
    // Highest priority are specific matches for each active fault
    for (const fault of activeFaults ?? []) {
        if (fault.present !== Dyson360FaultPresent.NotPresent) {
            const detail = findFaultMatch(fault.faultCode);
            const description = [fault.faultCode, fault.nextActionRequired, fault.requiredUserAction].filter(Boolean).join(' ');
            if (detail) {
                log.debug(`Mapped ${description} to ${JSON.stringify(detail)}`);
                if (fault.nextActionRequired !== Dyson360FaultNextAction.LogOnly) {
                    detailList.push(detail);
                }
            } else {
                log.warn(`Received unknown active fault: ${description}`);
            }
        }
    }

    // Next are specific matches for each legacy-format active fault
    for (const [category, fault] of Object.entries(faults ?? {}) as [Dyson360FaultCategory, Dyson360FaultStatus][]) {
        if (fault.active) {
            const detail = findFaultMatch(fault.description);
            if (detail) {
                log.debug(`Mapped ${category} fault ${fault.description} to ${JSON.stringify(detail)}`);
                detailList.push(detail);
            } else {
                log.warn(`Received unknown ${category} fault: ${fault.description}`);
            }
        }
    }

    // Next are mappings from the legacy-format active fault categories
    for (const [category, fault] of Object.entries(faults ?? {}) as [Dyson360FaultCategory, Dyson360FaultStatus][]) {
        if (fault.active) {
            const detail = DYSON_360_FAULT_CATEGORIES[category];
            log.debug(`Mapped ${category} fault category to ${JSON.stringify(detail)}`);
            detailList.push(detail);
        }
    }

    // Lowest priority is any fault from the robot state
    const stateDetail = DYSON_360_FAULT_STATES.get(state);
    if (stateDetail) {
        log.debug(`Mapped ${state} state to ${JSON.stringify(stateDetail)}`);
        detailList.push(stateDetail);
    }
    return detailList;
}

// Map a list of fault details to the most relevant RVC Operational State error
function dyson360FaultDetailsToError(log: AnsiLogger, detailList: Dyson360FaultDetail[]): Error | undefined {
    // If there is an RVC Operational State Error then use the first
    const opError = detailList.find(detail => detail.opError !== undefined);
    if (opError) {
        log.debug(`Selected RVC Operational State Error: ${opError.opError}("${opError.msg}")`);
        assertIsDefined(opError.opError);
        const constructor = RvcOperationalStateError.create(opError.opError);
        return new constructor(opError.msg);
    }

    // Otherwise create a generic Error
    const detail = detailList[0];
    if (detail) {
        log.debug(`Selected manufacturer-specific Error: "${detail.msg}"`);
        return new Error(detail.msg);
    }
}

// Map Dyson robot vacuum state and active faults to cluster attributes
export function mapDyson360Faults(
    log:            AnsiLogger,
    state:          Dyson360State,
    faults?:        Dyson360Faults,
    activeFaults?:  Dyson360ActiveFault[]
): Dyson360MappedFaults {
    // Map the state and active faults to a list of matching fault details
    const detailList = getFaultDetails(log, state, faults, activeFaults);

    // Construct the most relevant RVC Operational State error
    const err = dyson360FaultDetailsToError(log, detailList);
    const operationalError = RvcOperationalStateError.toStruct(err);

    // Construct a list of active battery faults
    const batFaults = new Set(detailList.map(detail => detail.batFault).filter(detail => detail !== undefined));
    if (batFaults.has('Unspecified') && 1 < batFaults.size) batFaults.delete('Unspecified');
    const activeBatFaults = Array.from(batFaults, name => PowerSource.BatFault[name]);

    // Construct a list of active battery charger faults
    const chargeFaults = new Set(detailList.map(detail => detail.chargeFault).filter(detail => detail !== undefined));
    if (chargeFaults.has('Unspecified') && 1 < chargeFaults.size) chargeFaults.delete('Unspecified');
    const activeBatChargeFaults = Array.from(chargeFaults, name => PowerSource.BatChargeFault[name]);

    // Return the resulting attribute values
    return { operationalError, activeBatFaults, activeBatChargeFaults };
}