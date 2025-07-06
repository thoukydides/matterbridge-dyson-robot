// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { Behavior, MaybePromise } from 'matterbridge/matter';
import { ClusterModel, FieldElement } from 'matterbridge/matter';
import { ModeBase, RvcOperationalState } from 'matterbridge/matter/clusters';
import {
    RvcCleanModeBehavior,
    RvcOperationalStateBehavior,
    RvcRunModeBehavior
} from 'matterbridge/matter/behaviors';
import { AnsiLogger } from 'matterbridge/logger';
import { ChangeToModeError, RvcOperationalStateError } from './error-360.js';
import { assertIsDefined, assertIsInstanceOf, logError } from './utils.js';

// Robot Vacuum Cleaner Run Mode cluster modes
export enum RvcRunMode360 {
    Idle,
    Cleaning,
    Mapping
}

// Robot Vacuum Cleaner Clean Mode cluster modes
export enum RvcCleanMode360 {
    Quiet,      // Eye: Quiet  Heurist: Quiet  Vis Nav: Quiet
    Quick,      //                             Vis Nav: Quick
    High,       //             Heurist: High
    MaxBoost,   // Eye: Max    Heurist: Max    Vis Nav: Boost
    Auto        //                             Vis Nav: Auto
}

// OperationalStatus manufacturer error
export const VENDOR_ERROR_360 = 0x80;

// Endpoint commands
export interface EndpointCommands360 {
    ChangeRunMode:   (newMode: RvcRunMode360)   => MaybePromise;
    ChangeCleanMode: (newMode: RvcCleanMode360) => MaybePromise;
    Pause:           ()                         => MaybePromise;
    Resume:          ()                         => MaybePromise;
    GoHome:          ()                         => MaybePromise;
}
type EndpointCommand360Args<T extends keyof EndpointCommands360> = Parameters<EndpointCommands360[T]>;
type EndpointHandler360<T extends keyof EndpointCommands360> = (...args: EndpointCommand360Args<T>) => MaybePromise;

// Command handling behaviour for the endpoint
export class BehaviorDevice360 {

    // Registered command handlers
    readonly commands: Partial<EndpointCommands360> = {};

    // Construct new command handling behaviour
    constructor(readonly log: AnsiLogger) {}

    // Set a command handler
    setCommandHandler<Command extends keyof EndpointCommands360>(command: Command, handler: EndpointCommands360[Command]): void {
        if (this.commands[command]) throw new Error(`Handler already registered for command ${command}`);
        this.commands[command] = handler;
    }

    // Execute a command handler
    async executeCommand<Command extends keyof EndpointCommands360>(
        command:    Command,
        ...args:    EndpointCommand360Args<Command>
    ): Promise<void> {
        const handler = this.commands[command];
        if (!handler) throw new Error(`${command} not implemented`);
        await (handler as EndpointHandler360<Command>)(...args);
    }
}
export class Behavior360 extends Behavior {
    static override readonly id = 'dyson-rvc';
    declare state: Behavior360.State;
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Behavior360 {
    export class State {
        device!: BehaviorDevice360;
    }
}

// Implement command handlers for the RVC Run Mode cluster
export class RvcRunModeServer360 extends RvcRunModeBehavior {

    // ChangeToMode command handler
    async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
        const { device } = this.agent.get(Behavior360).state;
        const { log } = device;
        try {
            // Check whether it is a valid request
            log.debug(`RVC Run Mode command: ChangeToMode ${newMode}...`);
            const supported = this.state.supportedModes.some(({ mode }) => mode === newMode);
            if (!supported) throw new ChangeToModeError.UnsupportedMode;

            // Attempt to change the mode
            await device.executeCommand('ChangeRunMode', newMode);

            // Success
            log.debug(`RVC Run Mode command: ChangeToMode ${newMode} - OK`);
            return ChangeToModeError.toResponse();
        } catch (err) {
            logError(log, 'RVC Run Mode ChangeToMode', err);
            return ChangeToModeError.toResponse(err);
        }
    }
}

// Implement command handlers for the RVC Clean Mode cluster
export class RvcCleanModeServer360 extends RvcCleanModeBehavior {

    // ChangeToMode command handler
    async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
        const { device } = this.agent.get(Behavior360).state;
        const { log } = device;
        try {
            // Check whether it is a valid request
            log.debug(`RVC Clean Mode command: ChangeToMode ${newMode}...`);
            const supported = this.state.supportedModes.some(({ mode }) => mode === newMode);
            if (!supported) throw new ChangeToModeError.UnsupportedMode;

            // Attempt to change the mode
            await device.executeCommand('ChangeCleanMode', newMode);

            // Success
            log.debug(`RVC Clean Mode command: ChangeToMode ${newMode} - OK`);
            return ChangeToModeError.toResponse();
        } catch (err) {
            logError(log, 'RVC Clean Mode ChangeToMode', err);
            return ChangeToModeError.toResponse(err);
        }
    }
}

// Implement command handlers for the RVC Operational State cluster
export class RvcOperationalStateServer360 extends RvcOperationalStateBehavior {

    static {
        const schema = RvcOperationalStateServer360.schema;
        assertIsInstanceOf(schema, ClusterModel);

        // Add a manufacturer-specific ErrorState value
        extendEnum(schema, 'ErrorStateEnum', [
            FieldElement({
                name:           'OtherError',
                id:             VENDOR_ERROR_360,
                conformance:    'O',
                description:    'The device has an error that is not covered by the Matter-defined error states'
            })
        ]);
    }

    // Common command handler
    async command(
        command: 'Pause' | 'Resume' | 'GoHome',
        defaultErrorId: RvcOperationalState.ErrorState
    ): Promise<RvcOperationalState.OperationalCommandResponse> {
        const { device } = this.agent.get(Behavior360).state;
        const { log } = device;
        try {
            log.debug(`RVC Operational State command: ${command}...`);
            await device.executeCommand(command);
            log.debug(`RVC Operational State command: ${command} - OK`);
            return RvcOperationalStateError.toResponse();
        } catch (err) {
            logError(log, `RVC Operational State ${command}`, err);
            return RvcOperationalStateError.toResponse(err, defaultErrorId);
        }
    }

    // Pause command handler
    override pause():  Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('Pause', RvcOperationalState.ErrorState.CommandInvalidInState as number);
    }

    // Resume command handler
    override resume(): Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('Resume', RvcOperationalState.ErrorState.UnableToStartOrResume as number);
    }

    // GoHome command handler
    override goHome(): Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('GoHome', RvcOperationalState.ErrorState.CommandInvalidInState as number);
    }
}

// Extend a Matter.js schema enum with new values
function extendEnum(schema: ClusterModel, name: string, values: FieldElement[]): void {
    const element = schema.datatypes.find(e => e.name === name);
    assertIsDefined(element);
    for (const value of values) {
        // Re-use any existing definition of the same value
        if (element.children.some(e => e.id === value.id)) continue;

        // Ensure new values have unique names
        let name = value.name;
        let suffix = 0;
        while (element.children.some(e => e.name === name)) name += `_${++suffix}`;
        element.children = [...element.children, { ...value, name }];
    }
}