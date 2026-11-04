// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { dyson360MapState, DysonDevice360Base } from './dyson-device-360-base.js';
import { EndpointOptions360, UpdateRvcCleanMode360 } from './endpoint-360.js';
import { AbstractConstructor, assertIsDefined } from './utils.js';
import { RvcRunMode360 } from './endpoint-360-behavior.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { Dyson360FullCleanAction } from './dyson-360-types.js';
import { DysonDevice360Command } from './dyson-device-360-commands.js';
import { RvcCleanModeDefinition, RvcCleanModeOption } from './endpoint-360-rvc.js';

// Additional RVC Clean Mode labels used for mopping
const MOP_CLEAN_MODE_DEFINITIONS: RvcCleanModeDefinition[] = [
    { label: 'Mop',             tags: ['Mop'] },
    { label: 'Vacuum and Mop',  tags: ['Vacuum', 'Mop'] }
];
const MOP_CLEAN_MODE_VARIANTS: RvcCleanModeDefinition[] = [];

// Mixin to add mopping support to a Dyson robot vacuum device
export function DysonDevice360MopMixin<TBase extends AbstractConstructor<DysonDevice360Base>>(Base: TBase) {
    abstract class DysonDevice360WithMop extends Base {

        // Mop-related RVC Clean Mode override from the current cleaning session
        mopCleanModeIndex: number | undefined;

        // Add mop cleaning capability
        override getEndpointOptions(): EndpointOptions360 {
            const endpointOptions = super.getEndpointOptions();
            endpointOptions.rvcOperationalState.supportsCleaningMop = true;
            endpointOptions.rvcCleanMode.modes = [
                ...endpointOptions.rvcCleanMode.modes,
                ...MOP_CLEAN_MODE_DEFINITIONS
            ];
            endpointOptions.rvcCleanMode.mopVariants = MOP_CLEAN_MODE_VARIANTS;
            return endpointOptions;
        }

        // Reject requests to enable mopping for global cleans
        override makeCleanModeCommand(options: RvcCleanModeOption): DysonDevice360Command {
            const { mopIndex } = options;
            if (mopIndex !== undefined) throw new Error('Global clean mopping is not implemented');
            return super.makeCleanModeCommand(options);
        }

        // Override the RVC Clean Mode when actively mopping
        override mapCleanMode(status: DysonMqttStatus<DysonMqttStatus360>): UpdateRvcCleanMode360 {
            const cleanMode = super.mapCleanMode(status);

            // Flush the last override when not cleaning
            const { runMode } = dyson360MapState(status.state);
            if (runMode !== RvcRunMode360.Cleaning) this.mopCleanModeIndex = undefined;

            // Override the RVC Clean Mode for mop-related activity
            const CLEAN_ACTION_MAP: Record<Dyson360FullCleanAction, number | undefined> = {
                [Dyson360FullCleanAction.None]:                 this.mopCleanModeIndex, // Preserve last used override
                [Dyson360FullCleanAction.Vacuuming]:            undefined,              // Use the vacuum power level
                [Dyson360FullCleanAction.Mopping]:              1,
                [Dyson360FullCleanAction.VacuumingAndMopping]:  2
            };
            assertIsDefined(status.fullCleanAction);
            this.mopCleanModeIndex = CLEAN_ACTION_MAP[status.fullCleanAction];
            if (this.mopCleanModeIndex !== undefined) cleanMode.modeIndex = this.mopCleanModeIndex;
            return cleanMode;
        }
    }
    return DysonDevice360WithMop;
}