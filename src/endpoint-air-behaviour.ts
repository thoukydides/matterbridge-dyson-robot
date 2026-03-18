// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { Thermostat } from 'matterbridge/matter/clusters';
import { ThermostatBehavior } from 'matterbridge/matter/behaviors';
import { Behavior, MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'matterbridge/logger';
import { logError } from './log-error.js';

// Endpoint commands
export interface EndpointCommandsAir {
    SetpointRaiseLower: (request: Thermostat.SetpointRaiseLowerRequest) => MaybePromise;
}
type EndpointCommandAirArgs<T extends keyof EndpointCommandsAir> = Parameters<EndpointCommandsAir[T]>;
type EndpointHandlerAir<T extends keyof EndpointCommandsAir> = (...args: EndpointCommandAirArgs<T>) => MaybePromise;

// Command handling behaviour for the endpoint
export class BehaviorDeviceAir {

    // Registered command handlers
    readonly commands: Partial<EndpointCommandsAir> = {};

    // Construct new command handling behaviour
    constructor(readonly log: AnsiLogger) {}

    // Set a command handler
    setCommandHandler<Command extends keyof EndpointCommandsAir>(command: Command, handler: EndpointCommandsAir[Command]): void {
        if (this.commands[command]) throw new Error(`Handler already registered for command ${command}`);
        this.commands[command] = handler;
    }

    // Execute a command handler
    async executeCommand<Command extends keyof EndpointCommandsAir>(
        command:    Command,
        ...args:    EndpointCommandAirArgs<Command>
    ): Promise<void> {
        const handler = this.commands[command];
        if (!handler) throw new Error(`${command} not implemented`);
        await (handler as EndpointHandlerAir<Command>)(...args);
    }
}
export class BehaviorAir extends Behavior {
    static override readonly id = 'dyson-air';
    declare state: BehaviorAir.State;
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BehaviorAir {
    export class State {
        device!: BehaviorDeviceAir;
    }
}

// Implement command handlers for the Thermostat cluster
export class ThermostatServerAir extends ThermostatBehavior {

    // SetpointRaiseLower command handler
    override async setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): Promise<void> {
        const { device } = this.agent.get(BehaviorAir).state;
        const { log } = device;
        try {
            // Attempt to change the setpoint
            const { mode, amount } = request;
            log.debug(`Thermostat command: SetpointRaiseLower mode=${mode}, amount=${amount}...`);
            await device.executeCommand('SetpointRaiseLower', request);
            log.debug(`Thermostat command: SetpointRaiseLower mode=${mode}, amount=${amount} - OK`);
        } catch (err) {
            logError(log, 'Thermostat SetpointRaiseLower', err);
            throw err;
        }
    }
}