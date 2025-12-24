// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonMqtt360, DysonMqtt360Action } from './dyson-mqtt-360.js';
import { Endpoint360 } from './endpoint-360.js';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import { Dyson360CleaningProgramme, Dyson360State } from './dyson-360-types.js';
import { CN, CV, RI } from './logger-options.js';
import { ChangeToModeError, RvcOperationalStateError, SelectAreaError } from './error-360.js';
import { MS } from './utils.js';

// Action to perform in each Dyson robot vacuum state
type StateAction =
    undefined                       // Invalid          => Immediate fail
  | true                            // No-op            => Immediate success
  | Lowercase<DysonMqtt360Action>   // Perform command  => Immediate success
  | DysonMqtt360Action;             // Perform command  => Wait for state change
const STATE_COLUMNS =                       ['Idle',   'Cleaning', 'ZoneClean', 'Mapping',  'Pause',    'Resume',   'GoHome'] as const;
const STATE_MAP: Record<Dyson360State, StateAction[]> = {
    [Dyson360State.MachineOff]:             [true,      undefined,  undefined,  undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultCallHelpline]:      ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultContactHelpline]:   ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultCritical]:          ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultGettingInfo]:       ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultLost]:              ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultOnDock]:            ['abort',   'START',    'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultOnDockCharged]:     ['abort',   'START',    'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultOnDockCharging]:    ['abort',   'START',    'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultReplaceOnDock]:     ['abort',   'START',    'START',    undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultReturnToDock]:      ['abort',   'START',    'START',    undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultRunningDiagnostic]: ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultUserRecoverable]:   ['abort',   'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FullCleanAbandoned]:     [true,      'START',    undefined,  undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanAborted]:       [true,      'START',    undefined,  undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanCharging]:      ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanDiscovering]:   ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanFinished]:      [true,      'START',    undefined,  undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanInitiated]:     ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanNeedsCharge]:   ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanPaused]:        ['ABORT',   true,       undefined,  undefined,  undefined,  'RESUME',   'ABORT'     ],
    [Dyson360State.FullCleanRunning]:       ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanTraversing]:    ['ABORT',   true,       undefined,  undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.InactiveCharged]:        [true,      'START',    'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.InactiveCharging]:       [true,      'START',    'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.InactiveDischarging]:    [true,      'START',    'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.MappingAborted]:         [true,      'START',    undefined,  undefined,  undefined,  undefined,  true        ],
    [Dyson360State.MappingCharging]:        ['ABORT',   'START',    undefined,  true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingFinished]:        [true,      'START',    undefined,  undefined,  undefined,  undefined,  true        ],
    [Dyson360State.MappingInitiated]:       ['ABORT',   'START',    undefined,  true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingNeedsCharge]:     ['ABORT',   'START',    undefined,  true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingPaused]:          ['ABORT',   'START',    undefined,  true,       undefined,  'RESUME',   'ABORT'     ],
    [Dyson360State.MappingRunning]:         ['ABORT',   'START',    undefined,  true,       'PAUSE',    undefined,  'ABORT'     ]
};
type StateTarget = typeof STATE_COLUMNS[number];

// Timeout waiting for the next update
const UPDATE_TIMEOUT = 5 * MS; // 5 seconds

// A command to issue
export interface Device360Command {
    description:    string;
    command:        () => Promise<void>;
    condition:      () => boolean;
}

// Attach command handlers to a Dyson robot vacuum device RVC endpoint
export class Device360CommandHandlers {

    // Abort previous operations that are still in progress
    abort?: AbortController;

    // Create a new command handler
    constructor (
        readonly log:       AnsiLogger,
        readonly mqtt:      DysonMqtt360,
        readonly endpoint:  Endpoint360
    ) {
        // Handle RVC Operational State Pause/Resume/GoHome commands
        const operationStateAction = async (target: StateTarget): Promise<void> => {
            if (!await this.setTarget(`${CN}RVC Operational State ${CV}${target}${RI}`, target)) {
                throw new RvcOperationalStateError.CommandInvalidInState();
            }
        };
        this.endpoint.setCommandHandler360('Pause',  () => operationStateAction('Pause'));
        this.endpoint.setCommandHandler360('Resume', () => operationStateAction('Resume'));
        this.endpoint.setCommandHandler360('GoHome', () => operationStateAction('GoHome'));

        // Handle RVC Run Mode cluster ChangeToMode commands
        this.endpoint.setCommandHandler360('ChangeRunMode', async newMode => {
            const target = RvcRunMode360[newMode] as keyof typeof RvcRunMode360;
            if (!await this.setTarget(`${CN}RVC Run Mode${RI} ChangeToMode ${formatEnumLog(RvcRunMode360, newMode)}`, target)) {
                throw new ChangeToModeError.InvalidInMode();
            }
        });
    }

    // Handle RVC Clean Mode cluster ChangeToMode commands
    attachCleanModeHandler(makePowerCommand: (cleanMode: RvcCleanMode360) => Device360Command): void {
        this.endpoint.setCommandHandler360('ChangeCleanMode', async newMode => {
            const { description, command, condition } = makePowerCommand(newMode);
            this.log.info(`${CN}RVC Clean Mode${RI} ChangeToMode ${formatEnumLog(RvcCleanMode360, newMode)} → ${CV}${description}${RI}`);
            await this.issueCommandAndWaitForUpdate(`set power mode ${description}`, command, condition);
        });
    }

    // Handle Service Area cluster SelectAreas commands
    attachSelectAreasHandler(
        makeCleaningProgramme:  (areaIds: number[]) => Promise<Dyson360CleaningProgramme>,
        makeAreaName:           (areaId: number) => string
    ): void {
        this.endpoint.setCommandHandler360('SelectAreas', async newAreas => {
            if (newAreas.length === 0) {
                // An empty list means clean everywhere
                if (!await this.setTarget(`${CN}ServiceArea${RI} SelectAreas everywhere`, 'Cleaning')) {
                    throw new SelectAreaError.InvalidInMode();
                }
            } else {
                const areaNames = newAreas.map(areaId => makeAreaName(areaId));
                const description = `${CN}ServiceArea${RI} ${CV}SelectAreas${RI} [${areaNames.join(', ')}]`;

                // SelectWhileRunning is not supported
                if (!this.targetAction('ZoneClean')) {
                    this.log.info(`${description} → not allowed in current state`);
                    throw new SelectAreaError.InvalidInMode();
                }

                // Publish a command to start the zone configured cleaning
                this.log.info(`${description} → ${CV}ZoneClean${RI}`);
                const cleaningProgramme = await makeCleaningProgramme(newAreas);
                await this.issueCommandAndWaitForUpdate(
                    'perform action ZoneClean', () => this.mqtt.commandAction('START', cleaningProgramme), () => true);
            }
        });
    }

    // Perform a command and wait for a status update
    async issueCommandAndWaitForUpdate (
        description:    string,
        command:        () => Promise<void>,
        condition:      () => boolean
    ): Promise<void> {
        try {
            // Make the operation abortable with a timeout
            this.abort?.abort();
            this.abort = new AbortController();
            const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(UPDATE_TIMEOUT)]);

            // Publish the command
            await command();

            // Wait for an update to satisfy the condition
            while (!condition()) {
                await this.mqtt.onceAsync('status', signal);
            }
        } catch (cause) {
            // Identify the underlying error
            let err = cause instanceof Error ? cause : new Error(String(cause));
            while (err.name === 'AbortError' && err.cause instanceof Error) err = err.cause;

            // Map the error type to a description
            const errMap: Record<string, string> = {
                AbortError:     'Aborted',
                TimeoutError:   'Timed out'
            };
            const result = errMap[err.name] ?? 'Failed to';
            this.log.warn(`${result} ${description}`);
            throw err;
        }
    }

    // Lookup the action required for a particular target
    targetAction(target: StateTarget): StateAction {
        const column = STATE_COLUMNS.indexOf(target);
        return STATE_MAP[this.mqtt.status.state][column];
    };

    // Attempt to set a target state, returning false if not allowed
    async setTarget(description: string, target: StateTarget): Promise<boolean> {
        // Check whether the target is allowed or already satisfied
        const action = this.targetAction(target);
        if (action === undefined) {
            this.log.info(`${description} → not allowed in current state`);
            return false;
        } else if (action === true) {
            this.log.info(`${description} → no action required`);
            return true;
        }

        // Publish a command to change the robot state
        this.log.info(`${description} → ${CV}${action}${RI}`);
        const command = action.toUpperCase() as Uppercase<typeof action>;
        const isTargetAchieved = (action: StateAction): boolean =>
            action === true || action === action?.toLowerCase();
        await this.issueCommandAndWaitForUpdate(
            `perform action ${target}`,
            () => this.mqtt.commandAction(command),
            () => isTargetAchieved(this.targetAction(target))
        );
        return true;
    };
}

// Format an enum value for logging
function formatEnumLog<T extends Record<string, number | string>>(
    enumMap:    T,
    value:      T[keyof T] extends number ? T[keyof T] : never
): string {
    const label = enumMap[value as keyof T];
    return `${CV}${label}${RI} (${CV}${value}${RI})`;
}