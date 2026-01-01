// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { Endpoint, MaybePromise, NamedHandler } from 'matterbridge/matter';
import { Thermostat } from 'matterbridge/matter/clusters';
import { ThermostatServer } from 'matterbridge/matter/behaviors';
import { MatterbridgeEndpointCommands, MatterbridgeServer } from 'matterbridge';
import type { ClusterType as _ClusterType } from 'matterbridge/matter/types';

// Simplified MatterbridgeServer state
interface MatterbridgeCommandHandler {
    commandHandler: NamedHandler<MatterbridgeEndpointCommands>;
}
type MatterbridgeServerState =
    MatterbridgeCommandHandler                      // Matterbridge >= 3.0.6
  | { deviceCommand: MatterbridgeCommandHandler };  // Matterbridge <= 3.0.5

// Prevent Matterbridge from modifying occupiedHeatingSetpoint itself
export class ThermostatServerAir extends ThermostatServer.with(
    Thermostat.Feature.Heating
) {
    // Just call the handler without implementing any additional functionality
    override setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): MaybePromise {
        const state = this.agent.get(MatterbridgeServer).state as MatterbridgeServerState;
        const commandHandler: NamedHandler<MatterbridgeEndpointCommands> =
            'commandHandler' in state ? state.commandHandler : state.deviceCommand.commandHandler;
        return commandHandler.executeHandler('setpointRaiseLower', {
            request,
            cluster:    ThermostatServer.id,
            attributes: this.state,
            endpoint:   this.endpoint
        });
    }
}

// Create the Thermostat cluster
export function createThermostatClusterServer({ behaviors }: Endpoint): void {
    behaviors.require(ThermostatServerAir.withFeatures(
        Thermostat.Feature.Heating
    ).enable({
        commands: {
            setpointRaiseLower: true
        }
    }), {
        // Constant attributes
        absMinHeatSetpointLimit:             1.00 * 100,    // centi-°C
        absMaxHeatSetpointLimit:            37.00 * 100,    // centi-°C
        controlSequenceOfOperation:         Thermostat.ControlSequenceOfOperation.HeatingOnly,
        hvacSystemTypeConfiguration: {
            heatingStage:       0,
            heatingIsHeatPump:  false,
            heatingUsesFuel:    false
        },
        remoteSensing: {
            localTemperature:   false
        },
        // Variable attributes
        localTemperature:                   null,
        piHeatingDemand:                    0,              // %
        occupiedHeatingSetpoint:            21.00 * 100,    // centi-°C
        systemMode:                         Thermostat.SystemMode.Off,
        thermostatRunningState: {
            heat:               false,
            fan:                false,
            fanStage2:          false,
            fanStage3:          false
        },
        // Unsupported attributes
        acCapacity:                         undefined,
        acCapacityFormat:                   undefined,
        acCoilTemperature:                  undefined,
        acCompressorType:                   undefined,
        acErrorCode:                        undefined,
        acLouverPosition:                   undefined,
        acRefrigerantType:                  undefined,
        acType:                             undefined,
        emergencyHeatDelta:                 undefined,
        localTemperatureCalibration:        undefined,
        maxHeatSetpointLimit:               undefined,
        minHeatSetpointLimit:               undefined,
        outdoorTemperature:                 undefined,
        setpointChangeAmount:               undefined,
        setpointChangeSource:               undefined,
        setpointChangeSourceTimestamp:      undefined,
        setpointHoldExpiryTimestamp:        undefined,
        temperatureSetpointHold:            undefined,
        temperatureSetpointHoldDuration:    undefined,
        thermostatProgrammingOperationMode: undefined
    });
}