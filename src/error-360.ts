// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    ModeBase,
    RvcOperationalState,
    ServiceArea
} from 'matterbridge/matter/clusters';
import { VENDOR_ERROR_360 } from './endpoint-360-behavior.js';

// RVC Operational State errors
export class RvcOperationalStateError extends Error {

    // Create a new error
    constructor(
        readonly id:        RvcOperationalState.ErrorState | number,
        readonly label?:    string, // (if a manufacturer-specific id, otherwise undefined)
        readonly details?:  string,
        options?:           ErrorOptions
    ) {
        const idName = RvcOperationalState.ErrorState[id] ?? `0x${id.toString(16)}`;
        let message = label ?? idName;
        if (details) message += ` (${details})`;
        super(message, options);
        Error.captureStackTrace(this, RvcOperationalStateError);
        this.name = `RvcOperationalStateError[${idName}]`;
    }

    // Convert an arbitrary error (or nullish for success) to an ErrorStateStruct
    static toStruct(err?: unknown, defaultId = VENDOR_ERROR_360): RvcOperationalState.ErrorStateStruct {
        return err instanceof RvcOperationalStateError ? {
            errorStateId:       err.id,
            errorStateLabel:    err.label  ?.substring(0, 64) ?? undefined,
            errorStateDetails:  err.details?.substring(0, 64) ?? ''
        } : err ? {
            errorStateId:       defaultId,
            errorStateLabel:    err instanceof Error ? err.message.substring(0, 64) : 'Unknown error',
            errorStateDetails:  ''
        } : {
            errorStateId:       RvcOperationalState.ErrorState.NoError,
            errorStateDetails:  ''
        };
    }

    // Convert an arbitrary error (or nullish for success) to an OperationalCommandResponse
    static toResponse(err?: unknown, defaultId?: number): RvcOperationalState.OperationalCommandResponse {
        return { commandResponseState: RvcOperationalStateError.toStruct(err, defaultId) };
    }

    // Helper function to create a new error class with a specific status code
    static create(
        idName: keyof typeof RvcOperationalState.ErrorState
    ): new (details?: string, options?: ErrorOptions) => RvcOperationalStateError {
        return class extends RvcOperationalStateError {
            constructor(details?: string, options?: ErrorOptions) {
                const id = RvcOperationalState.ErrorState[idName];
                super(id, undefined, details, options);
            }
        };
    }

    // Standard error codes defined by the RVC Operational State Cluster
    static readonly NoError                   = this.create('NoError');
    static readonly UnableToStartOrResume     = this.create('UnableToStartOrResume');
    static readonly UnableToCompleteOperation = this.create('UnableToCompleteOperation');
    static readonly CommandInvalidInState     = this.create('CommandInvalidInState');
    static readonly FailedToFindChargingDock  = this.create('FailedToFindChargingDock');
    static readonly Stuck                     = this.create('Stuck');
    static readonly DustBinMissing            = this.create('DustBinMissing');
    static readonly DustBinFull               = this.create('DustBinFull');
    static readonly WaterTankEmpty            = this.create('WaterTankEmpty');
    static readonly WaterTankMissing          = this.create('WaterTankMissing');
    static readonly WaterTankLidOpen          = this.create('WaterTankLidOpen');
    static readonly MopCleaningPadMissing     = this.create('MopCleaningPadMissing');
}

// RVC Clean/Run Mode ChangeToMode errors
export class ChangeToModeError extends Error {

    // Create a new error
    constructor(
        readonly status:    ModeBase.ModeChangeStatus | number,
        message?:           string,
        options?:           ErrorOptions
    ) {
        super(message, options);
        Error.captureStackTrace(this, ChangeToModeError);
        const statusName = ModeBase.ModeChangeStatus[status];
        this.name = `ChangeToModeError[${statusName ?? `0x${status.toString(16)}`}]`;
    }

    // Convert an arbitrary error (or nullish for success) to a ChangeToModeResponse
    static toResponse(err?: unknown): ModeBase.ChangeToModeResponse {
        return {
            status:     err instanceof ChangeToModeError ? err.status
                        : ModeBase.ModeChangeStatus[err ? 'GenericFailure' : 'Success'],
            statusText: err instanceof Error ? err.message.substring(0, 64) : 'Unable to change mode'
        };
    }

    // Helper function to create a new error class with a specific status code
    static create(
        statusName: keyof typeof ModeBase.ModeChangeStatus
    ): new (message?: string, options?: ErrorOptions) => ChangeToModeError {
        const statusCode = ModeBase.ModeChangeStatus[statusName];
        return class extends ChangeToModeError {
            constructor(message?: string, options?: ErrorOptions) {
                message ??= `ChangeToMode status ${statusName}`;
                super(statusCode, message, options);
            }
        };
    }

    // Standard status codes defined by the Mode Base Cluster
    static readonly Success         = this.create('Success');
    static readonly UnsupportedMode = this.create('UnsupportedMode');
    static readonly GenericFailure  = this.create('GenericFailure');
    static readonly InvalidInMode   = this.create('InvalidInMode');
}

// Service Area SelectAreas errors
export class SelectAreaError extends Error {

    // Create a new error
    constructor(readonly status: ServiceArea.SelectAreasStatus | number, message?: string, options?: ErrorOptions) {
        super(message, options);
        Error.captureStackTrace(this, SelectAreaError);
        const statusName = ServiceArea.SelectAreasStatus[status];
        this.name = `SelectAreaError[${statusName ?? `0x${status.toString(16)}`}]`;
    }

    // Convert an arbitrary error (or nullish for success) to a SelectAreasResponse
    static toResponse(err?: unknown): ServiceArea.SelectAreasResponse {
        return {
            status:     err instanceof SelectAreaError ? err.status
                        : ServiceArea.SelectAreasStatus[err ? 'InvalidInMode' : 'Success'],
            statusText: err instanceof Error ? err.message.substring(0, 256) : 'Unable to select areas'
        };
    }

    // Helper function to create a new error class with a specific status code
    static create(
        statusName: keyof typeof ServiceArea.SelectAreasStatus
    ): new (message?: string, options?: ErrorOptions) => SelectAreaError {
        const statusCode = ServiceArea.SelectAreasStatus[statusName];
        return class extends SelectAreaError {
            constructor(message?: string, options?: ErrorOptions) {
                message ??= `SelectArea status ${statusName}`;
                super(statusCode, message, options);
            }
        };
    }

    // Standard status codes defined by the Service Area cluster
    static readonly Success         = this.create('Success');
    static readonly UnsupportedArea = this.create('UnsupportedArea');
    static readonly InvalidInMode   = this.create('InvalidInMode');
    static readonly InvalidSet      = this.create('InvalidSet');
}