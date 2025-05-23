// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonMqtt360, DysonMqtt360Action } from './dyson-mqtt-360.js';
import { Endpoint360 } from './endpoint-360.js';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import { Dyson360PowerMode, Dyson360State } from './dyson-360-types.js';
import { CN, CV, RI } from './logger-options.js';
import { ChangeToModeError, RvcOperationalStateError } from './error-360.js';
import { MS } from './utils.js';

// Action to perform in each Dyson robot vacuum state
type StateAction =
    undefined                       // Invalid          => Immediate fail
  | true                            // No-op            => Immediate success
  | DysonMqtt360Action              // Perform command  => Immediate success
  | Lowercase<DysonMqtt360Action>;  // Perform command  => Wait for state change
const STATE_COLUMNS =                       ['Idle',    'Cleaning', 'Mapping',  'Pause',    'Resume',   'GoHome'] as const;
const STATE_MAP: Record<Dyson360State, StateAction[]> = {
    [Dyson360State.MachineOff]:             [true,      undefined,  undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultCallHelpline]:      ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultContactHelpline]:   ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultCritical]:          ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultGettingInfo]:       ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultLost]:              ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultOnDock]:            ['abort',   'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultOnDockCharged]:     ['abort',   'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultOnDockCharging]:    ['abort',   'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FaultReplaceOnDock]:     ['abort',   'START',    undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultReturnToDock]:      ['abort',   'START',    undefined,  undefined,  undefined,  undefined   ],
    [Dyson360State.FaultRunningDiagnostic]: ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FaultUserRecoverable]:   ['abort',   'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.FullCleanAbandoned]:     [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanAborted]:       [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanCharging]:      ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanDiscovering]:   ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanFinished]:      [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.FullCleanInitiated]:     ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanNeedsCharge]:   ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanPaused]:        ['ABORT',   true,       undefined,  undefined,  'RESUME',   'ABORT'     ],
    [Dyson360State.FullCleanRunning]:       ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.FullCleanTraversing]:    ['ABORT',   true,       undefined,  'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.InactiveCharged]:        [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.InactiveCharging]:       [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.InactiveDischarging]:    [true,      'START',    undefined,  undefined,  undefined,  'ABORT'     ],
    [Dyson360State.MappingAborted]:         [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.MappingCharging]:        ['ABORT',   'START',    true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingFinished]:        [true,      'START',    undefined,  undefined,  undefined,  true        ],
    [Dyson360State.MappingInitiated]:       ['ABORT',   'START',    true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingNeedsCharge]:     ['ABORT',   'START',    true,       'PAUSE',    undefined,  'ABORT'     ],
    [Dyson360State.MappingPaused]:          ['ABORT',   'START',    true,       undefined,  'RESUME',   'ABORT'     ],
    [Dyson360State.MappingRunning]:         ['ABORT',   'START',    true,       'PAUSE',    undefined,  'ABORT'     ]
};
type StateTarget = typeof STATE_COLUMNS[number];

// Timeout waiting for the next update
const UPDATE_TIMEOUT = 5 * MS; // 5 seconds

// Attach command handlers to a Dyson robot vacuum device RVC endpoint
export function attachDevice360CommandHandlers(
    log:        AnsiLogger,
    mqtt:       DysonMqtt360,
    endpoint:   Endpoint360,
    powerMap:   (cleanMode: RvcCleanMode360) => Dyson360PowerMode
): void {
    const context: { abort?: AbortController; } = {};

    // Perform a command and wait for a status update
    const issueCommandAndWaitForUpdate = async (
        description:    string,
        command:        () => Promise<void>,
        condition:      () => boolean
    ): Promise<void> => {
        try {
            // Make the operation abortable with a timeout
            context.abort?.abort();
            context.abort = new AbortController();
            const signal = AbortSignal.any([context.abort.signal, AbortSignal.timeout(UPDATE_TIMEOUT)]);

            // Publish the command
            await command();

            // Wait for an update to satisfy the condition
            while (!condition()) {
                await mqtt.onceAsync('status', signal);
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
            log.warn(`${result} ${description}`);
            throw err;

        }
    };

    // Lookup the action required for a particular target
    const targetAction = (target: StateTarget): StateAction => {
        const column = STATE_COLUMNS.indexOf(target);
        return STATE_MAP[mqtt.status.state][column];
    };

    // Attempt to set a target state, returning false if not allowed
    const setTarget = async (description: string, target: StateTarget): Promise<boolean> => {
        // Check whether the target is allowed or already satisfied
        const action = targetAction(target);
        if (action === undefined) {
            log.info(`${description} → not allowed in current state`);
            return false;
        } else if (action === true) {
            log.info(`${description} → no action required`);
            return true;
        }

        // Publish a command to change the robot state
        log.info(`${description} → ${CV}${action}${RI}`);
        const command = action.toUpperCase() as Uppercase<typeof action>;
        const isTargetAchieved = (action: StateAction): boolean =>
            action === true || action === action?.toLowerCase();
        await issueCommandAndWaitForUpdate(
            `perform action ${target}`,
            () => mqtt.commandAction(command),
            () => isTargetAchieved(targetAction(target))
        );
        return true;
    };

    // Handle RVC Operational State Pause/Resume/GoHome commands
    const operationStateAction = async (target: StateTarget): Promise<void> => {
        if (!await setTarget(`${CN}RVC Operational State ${CV}${target}${RI}`, target)) {
            throw new RvcOperationalStateError.CommandInvalidInState();
        }
    };
    endpoint.setCommandHandler360('Pause',  () => operationStateAction('Pause'));
    endpoint.setCommandHandler360('Resume', () => operationStateAction('Resume'));
    endpoint.setCommandHandler360('GoHome', () => operationStateAction('GoHome'));

    // Handle RVC Run Mode cluster ChangeToMode commands
    endpoint.setCommandHandler360('ChangeRunMode', async newMode => {
        const target = RvcRunMode360[newMode] as keyof typeof RvcRunMode360;
        if (!await setTarget(`${CN}RVC Run Mode${RI} ChangeToMode ${formatEnumLog(RvcRunMode360, newMode)}`, target)) {
            throw new ChangeToModeError.InvalidInMode();
        }
    });

    // Reject all RVC Clean Mode cluster ChangeToMode commands
    endpoint.setCommandHandler360('ChangeCleanMode', async newMode => {
        const powerMode = powerMap(newMode);
        log.info(`${CN}RVC Clean Mode${RI} ChangeToMode ${formatEnumLog(RvcCleanMode360, newMode)} → ${CV}${powerMode}${RI}`);
        await issueCommandAndWaitForUpdate(
            `set power mode ${powerMode}`,
            () => mqtt.commandPower(powerMode),
            () => mqtt.status.defaultVacuumPowerMode === powerMode
        );
    });
}

// Format an enum value for logging
function formatEnumLog<T extends Record<string, number | string>>(
    enumMap:    T,
    value:      T[keyof T] extends number ? T[keyof T] : never
): string {
    const label = enumMap[value as keyof T];
    return `${CV}${label}${RI} (${CV}${value}${RI})`;
}