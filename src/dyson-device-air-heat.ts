// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { Thermostat } from 'matterbridge/matter/clusters';
import { DysonDeviceAirBase } from './dyson-device-air-base.js';
import { DysonMqttStatusAir } from './dyson-mqtt-air.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import { EndpointsAir } from './endpoint-air.js';
import { AbstractConstructor, assertIsDefined } from './utils.js';
import {
    DysonAirFanState,
    DysonAirHeatingMode,
    DysonAirHeatingStatus
} from './dyson-air-types.js';
import { numeric } from './dyson-device-air-quality.js';
import { DysonEntityDescription } from './dyson-device-base.js';

// Mixin to add heating to a Dyson air treatment device
export function DysonDeviceAirHeatMixin<TBase extends AbstractConstructor<DysonDeviceAirBase>>(Base: TBase) {
    abstract class DysonDeviceAirWithHeat extends Base {

        // Mixin constructor
        constructor(...args: any[]) {
            super(...args as ConstructorParameters<TBase>);
        }

        // Install handlers
        override async installHandlers(endpoints: EndpointsAir): Promise<void> {
            await super.installHandlers(endpoints);
            await endpoints.setThermostatHandlers({
                occupiedHeatingSetpoint: setpoint =>
                    this.setTargetTemperature(setpoint / 100),
                systemMode: mode => {
                    switch (mode) {
                    case Thermostat.SystemMode.Heat:
                    case Thermostat.SystemMode.EmergencyHeat:
                        return this.setHeating(true);
                    case Thermostat.SystemMode.Off:
                    default:
                        return this.setHeating(false);
                    }
                }
            });
        }

        // Set the heating target temperature
        async setTargetTemperature(celsius: number): Promise<void> {
            this.log.info(`Enabling heating with target temperature ${celsius} °C`);
            const hmod = DysonAirHeatingMode.Heat;
            await this.setState({ hmax: celsius, hmod });
        }

        // Enable or disable heating
        async setHeating(heat: boolean): Promise<void> {
            this.log.info(`${heat ? 'Enabling' : 'Disabling'} heating`);
            // Turn power on when enabling heating, but not when disabling
            await this.setState({ hmod: DysonAirHeatingMode[heat ? 'Heat' : 'Cool'] });
        }

        // List of endpoint function names and descriptions to validate
        override getEntities(): DysonEntityDescription[] {
            return [...super.getEntities(), {
                name:           'Thermostat',
                description:    'Heating control'
            }];
        }

        // Update cluster attributes when the MQTT status is updated
        override async updateClusterAttributes(
            status: DysonMqttStatus<DysonMqttStatusAir>
        ): Promise<void> {
            await super.updateClusterAttributes(status);
            const { fnst, hmax, hmod, hsta, tact } = status;
            assertIsDefined(hmax);
            const heatingMode   = hmod === DysonAirHeatingMode.Heat;
            const heat          = hsta === DysonAirHeatingStatus.Heating;
            const fan           = fnst === DysonAirFanState.Running;
            await this.endpoints?.updateThermostat({
                localTemperature:           numeric(tact, 100) ?? null, // centi-°C
                occupiedHeatingSetpoint:    hmax * 100,                 // centi-°C
                piHeatingDemand:            heat ? 100 : 0,             // %
                systemMode: Thermostat.SystemMode[heatingMode ? 'Heat' : 'Off'],
                thermostatRunningState:     { heat, fan }
            });
        }
    };
    return DysonDeviceAirWithHeat;
}