// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { dyson360MapState, DysonDevice360Base } from './dyson-device-360-base.js';
import { EndpointOptions360 } from './endpoint-360.js';
import { AbstractConstructor, assertIsDefined } from './utils.js';
import { RvcCleanMode360, RvcRunMode360 } from './endpoint-360-behavior.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { DysonMqttStatus360 } from './dyson-mqtt-360.js';
import { Dyson360FullCleanAction } from './dyson-360-types.js';
import { DysonDevice360Command } from './dyson-device-360-commands.js';
import { RvcCleanModeLabels } from './endpoint-360-rvc.js';

// Additional RVC Clean Mode labels used for mopping
const MOP_CLEAN_MODE_LABELS: RvcCleanModeLabels = [
    [RvcCleanMode360.Mop,            'Mop'],
    [RvcCleanMode360.VacuumAndMop,   'Vacuum and Mop']
];

// Mixin to add mopping support to a Dyson robot vacuum device
export function DysonDevice360MopMixin<TBase extends AbstractConstructor<DysonDevice360Base>>(Base: TBase) {
    abstract class DysonDevice360WithMop extends Base {

        // Mop-related RVC Clean Mode override from the current cleaning session
        mopCleanMode: RvcCleanMode360 | undefined;

        // Add mop cleaning capability
        getEndpointOptions(): EndpointOptions360 {
            const endpointOptions = super.getEndpointOptions();
            endpointOptions.rvcOperationalState.supportsCleaningMop = true;
            endpointOptions.rvcCleanMode.labels.push(...MOP_CLEAN_MODE_LABELS);
            return endpointOptions;
        }

        // Reject requests to enable mopping for global cleans
        makePowerCommand(cleanMode: RvcCleanMode360): DysonDevice360Command {
            const isMopping = MOP_CLEAN_MODE_LABELS.some(([mode]) => mode === cleanMode);
            if (isMopping) throw new Error('Global clean mopping is not implemented');
            return super.makePowerCommand(cleanMode);
        }

        // Override the RVC Clean Mode when actively mopping
        override mapCleanMode(status: DysonMqttStatus<DysonMqttStatus360>): RvcCleanMode360 {
            const cleanMode = super.mapCleanMode(status);

            // Flush the last override when not cleaning
            const { runMode } = dyson360MapState(status.state);
            if (runMode !== RvcRunMode360.Cleaning) this.mopCleanMode = undefined;

            // Override the RVC Clean Mode for mop-related activity
            const CLEAN_ACTION_MAP: Record<Dyson360FullCleanAction, RvcCleanMode360 | undefined> = {
                [Dyson360FullCleanAction.None]:                 this.mopCleanMode,  // Preserve last used override
                [Dyson360FullCleanAction.Vacuuming]:            undefined,          // Use the vacuum power level
                [Dyson360FullCleanAction.Mopping]:              RvcCleanMode360.Mop,
                [Dyson360FullCleanAction.VacuumingAndMopping]:  RvcCleanMode360.VacuumAndMop
            };
            assertIsDefined(status.fullCleanAction);
            this.mopCleanMode = CLEAN_ACTION_MAP[status.fullCleanAction];
            if (this.mopCleanMode !== undefined) return this.mopCleanMode;
            return cleanMode;
        }
    }
    return DysonDevice360WithMop;
}


