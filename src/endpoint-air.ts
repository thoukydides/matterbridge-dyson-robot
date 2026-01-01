// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    airPurifier,
    airQualitySensor,
    bridgedNode,
    DeviceTypeDefinition,
    humiditySensor,
    MatterbridgeEndpoint,
    temperatureSensor,
    thermostatDevice
} from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { Config, EntityName } from './config-types.js';
import {
    EndpointBase,
    EndpointOptionsBase,
    formatEnumLog
} from './endpoint-base.js';
import { AtLeastOne, ClusterId } from 'matterbridge/matter';
import {
    ActivatedCarbonFilterMonitoring,
    AirQuality,
    ConcentrationMeasurement,
    CarbonDioxideConcentrationMeasurement,
    FanControl,
    FormaldehydeConcentrationMeasurement,
    HepaFilterMonitoring,
    NitrogenDioxideConcentrationMeasurement,
    OnOff,
    Pm10ConcentrationMeasurement,
    Pm25ConcentrationMeasurement,
    RelativeHumidityMeasurement,
    ResourceMonitoring,
    TemperatureMeasurement,
    Thermostat,
    TotalVolatileOrganicCompoundsConcentrationMeasurement
} from 'matterbridge/matter/clusters';
import {
    createActivatedCarbonFilterMonitoringClusterServer,
    createFanControlClusterServer,
    createHepaFilterMonitoringClusterServer,
    createOnOffClusterServer,
    FanControlOptions,
    FilterMonitoringOptions
} from './endpoint-air-purifier.js';
import { Changed, ifValueChanged } from './decorator-changed.js';
import { AN, AV, CN, CV, RI } from './logger-options.js';
import {
    assertIsBoolean,
    assertIsNumber,
    formatList
} from './utils.js';
import {
    createAirQualityClusterServer,
    createTemperatureMeasurementClusterServer,
    createRelativeHumidityMeasurementClusterServer,
    createTotalVolatileOrganicCompoundsConcentrationMeasurementClusterServer,
    createCarbonDioxideConcentrationMeasurementClusterServer,
    createNitrogenDioxideConcentrationMeasurementClusterServer,
    createFormaldehydeConcentrationMeasurementClusterServer,
    createPm25ConcentrationMeasurementClusterServer,
    createPm10ConcentrationMeasurementClusterServer
} from './endpoint-air-quality.js';
import { createThermostatClusterServer } from './endpoint-air-thermostat.js';
import { MaybePromise } from 'matterbridge/matter';
import { logError } from './log-error.js';

// Device-specific endpoint configuration
export type EndpointOptionsAirSensors = {
    [K in keyof UpdateAirSensors as undefined extends UpdateAirSensors[K] ? K : never]-?: boolean
};
export interface EndpointOptionsAir extends EndpointOptionsBase {
    validatedNames:             EntityName[];
    fanControl:                 FanControlOptions;
    hepaFilter?:                FilterMonitoringOptions;
    carbonFilter?:              FilterMonitoringOptions;
    sensors:                    EndpointOptionsAirSensors;
}

// Attribute subscription and command handlers
export type HandlerAir<T> = (newValue: T, oldValue: T) => MaybePromise;
export type HandlerAirMap<T extends Record<string, unknown>> = {
    [K in keyof T & string]: HandlerAir<T[K]>;
};

// On/Off and Fan Control handlers
export interface HandlersAirFan {
    onOff:                      HandlerAir<boolean>;
    airflowDirection:           HandlerAir<FanControl.AirflowDirection>;
    fanMode:                    HandlerAir<FanControl.FanMode>;
    percentSetting:             HandlerAir<number>;
    rockSetting:                HandlerAir<AirFanRockSetting>;
    speedSetting:               HandlerAir<number>;
    windSetting:                HandlerAir<AirWindSetting>;
}

// Thermostat handlers
export interface HandlersAirThermostat {
    occupiedHeatingSetpoint:    HandlerAir<number>;
    systemMode:                 HandlerAir<Thermostat.SystemMode>;
}

// Updates to the On/Off and Fan Control cluster attributes
export interface AirFanRockSetting {
    rockLeftRight?:             boolean;
    rockUpDown?:                boolean;
    rockRound?:                 boolean;
}
export interface AirWindSetting {
    sleepWind?:                 boolean;
    naturalWind?:               boolean;
}
export interface UpdateAirFan {
    // Fan Control read-only attribute:
    onOff:                      boolean;
    // Thermostat read/write attributes
    airflowDirection?:          FanControl.AirflowDirection;
    fanMode:                    FanControl.FanMode;
    percentSetting:             number | null;
    rockSetting?:               AirFanRockSetting;
    speedSetting:               number | null; // null = Auto, 0 = Off, or 1 ~ 10
    windSetting?:               AirWindSetting;
    // Thermostat read-only attributes
    percentCurrent:             number;
    speedCurrent:               number; // 0 = Off, or 1 ~ 10
}

// Updates to the Thermostat cluster attributes
export interface UpdateAirThermostatRunningState {
    cool?:                      false;
    coolStage2?:                false;
    heat:                       boolean;
    heatStage2?:                boolean;
    fan:                        boolean;
    fanStage2?:                 boolean;
    fanStage3?:                 boolean;
}
export interface UpdateAirThermostat {
    // Read/write attributes
    occupiedHeatingSetpoint:    number; // centi-°C
    systemMode:                 Thermostat.SystemMode;
    // Read-only attributes
    localTemperature:           number | null; // centi-°C
    piHeatingDemand:            number; // 0% or 100%
    thermostatRunningState:     UpdateAirThermostatRunningState;
}

// Updates to the HEPA and Activated Carbon Filter Monitoring cluster attributes
export interface UpdateAirFilterMonitoringSingle {
    condition:                  number; // %
    changeIndication:           ResourceMonitoring.ChangeIndication;
    inPlaceIndicator:           boolean;
}
export interface UpdateAirFilterMonitoring {
    hepa?:                      UpdateAirFilterMonitoringSingle;
    carbon?:                    UpdateAirFilterMonitoringSingle;
}

// Updates to all of the Air Quality and Measurement cluster attributes
export interface UpdateAirSensors {
    airQuality:                 AirQuality.AirQualityEnum;
    temperature?:               number | null; // centi-°C
    humidity?:                  number | null; // centi-%
    voc?:                       ConcentrationMeasurement.LevelValue;
    co2?:                       number | null; // ppm
    nox?:                       ConcentrationMeasurement.LevelValue;
    hcho?:                      number | null; // µg/m³
    pm25?:                      number | null; // µg/m³
    pm10?:                      number | null; // µg/m³
}

// A Matterbridge endpoint for an air purifier composite device
export class EndpointsAir {

    // Bridge node endpoints
    bridged:        EndpointBase[] = [];

    // Aliases to endpoints for specific clusters
    purifier?:      MatterbridgeEndpoint;           // On/Off + Air Purifier + X Filter Monitoring
    thermostat?:    MatterbridgeEndpoint;           // Thermostat
    airQuality:     MatterbridgeEndpoint[] = [];    // Air Quality + X Measurement
    temperature:    MatterbridgeEndpoint[] = [];    // Temperature Measurement
    humidity:       MatterbridgeEndpoint[] = [];    // Relative Humidity Measurement

    // Decorator support
    changed: Changed;

    // Filter own attribute writes from subscription events
    lastWrite = new Map<string, unknown>;

    // Construct a new endpoint
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly options:   EndpointOptionsAir
    ) {
        // Construct the separately bridged devices, if enabled
        this.createAirPurifierEndpoint();
        this.createThermostatEndpoint();
        this.createHumiditySensorEndpoint();
        this.createTemperatureSensorEndpoint();
        this.createAirQualitySensorEndpoint();

        // Construct the composed air purifier device, if enabled
        const parent = this.createAirPurifierEndpoint(true);
        if (parent) {
            this.createThermostatEndpoint(parent);
            this.createHumiditySensorEndpoint(parent);
            this.createTemperatureSensorEndpoint(parent);
            this.createAirQualitySensorEndpoint(parent);
        }

        // Prepare the decorator support
        this.changed = new Changed(log);
    }

    // Create an Air Purifier device
    createAirPurifierEndpoint(composed = false): MatterbridgeEndpoint | undefined {
        // Create the endpoint
        if (this.purifier) return;
        const endpointName = composed ? 'Composed Air Purifier' : 'Air Purifier';
        const endpoint = this.createDevice(endpointName, [airPurifier]);
        if (!endpoint) return;
        this.purifier = endpoint;

        // Create the device-specific clusters
        const { fanControl, hepaFilter, carbonFilter } = this.options;
        createOnOffClusterServer(endpoint);
        createFanControlClusterServer(endpoint, fanControl);
        if (hepaFilter)   createHepaFilterMonitoringClusterServer(endpoint, hepaFilter);
        if (carbonFilter) createActivatedCarbonFilterMonitoringClusterServer(endpoint, carbonFilter);
        return endpoint;
    }

    // Create a Humidity Sensor device
    createHumiditySensorEndpoint(parent?: MatterbridgeEndpoint): MatterbridgeEndpoint | undefined {
        // Create the endpoint
        if (!this.options.sensors.humidity) return;
        const endpoint = this.createDevice('Humidity Sensor', [humiditySensor], parent);
        if (!endpoint) return;
        this.humidity.push(endpoint);

        // Create the device-specific clusters
        createRelativeHumidityMeasurementClusterServer(endpoint);
        return endpoint;
    }

    // Create a Temperature Sensor device
    createTemperatureSensorEndpoint(parent?: MatterbridgeEndpoint): MatterbridgeEndpoint | undefined {
        // Create the endpoint
        if (!this.options.sensors.temperature) return;
        const endpoint = this.createDevice('Temperature Sensor', [temperatureSensor], parent);
        if (!endpoint) return;
        this.temperature.push(endpoint);

        // Create the device-specific clusters
        createTemperatureMeasurementClusterServer(endpoint);
        return endpoint;
    }

    // Create a Thermostat device
    createThermostatEndpoint(parent?: MatterbridgeEndpoint): MatterbridgeEndpoint | undefined {
        // Create the endpoint
        if (this.thermostat) return;
        const endpoint = this.createDevice('Thermostat', [thermostatDevice], parent);
        if (!endpoint) return;
        this.thermostat = endpoint;

        // Create the device-specific clusters
        createThermostatClusterServer(endpoint);
        return endpoint;
    }

    // Create an Air Quality Sensor device
    createAirQualitySensorEndpoint(parent?: MatterbridgeEndpoint): MatterbridgeEndpoint | undefined {
        // Create the endpoint
        const endpoint = this.createDevice('Air Quality Sensor', [airQualitySensor, temperatureSensor, humiditySensor], parent);
        if (!endpoint) return;
        this.airQuality.push(endpoint);

        // Create the device-specific clusters
        const { sensors } = this.options;
        createAirQualityClusterServer(endpoint);
        if (sensors.temperature) {
            createTemperatureMeasurementClusterServer(endpoint);
            this.temperature.push(endpoint);
        }
        if (sensors.humidity) {
            createRelativeHumidityMeasurementClusterServer(endpoint);
            this.humidity.push(endpoint);
        }
        if (sensors.voc)  createTotalVolatileOrganicCompoundsConcentrationMeasurementClusterServer(endpoint);
        if (sensors.co2)  createCarbonDioxideConcentrationMeasurementClusterServer(endpoint);
        if (sensors.nox)  createNitrogenDioxideConcentrationMeasurementClusterServer(endpoint);
        if (sensors.hcho) createFormaldehydeConcentrationMeasurementClusterServer(endpoint);
        if (sensors.pm25) createPm25ConcentrationMeasurementClusterServer(endpoint);
        if (sensors.pm10) createPm10ConcentrationMeasurementClusterServer(endpoint);
        return endpoint;
    }

    // Create a device as either a bridged node or a child endpoint
    createDevice(
        endpointName:   EntityName,
        definition:     AtLeastOne<DeviceTypeDefinition>,
        parent?:        MatterbridgeEndpoint
    ) {
        const { config, options } = this;
        const debug = config.debugFeatures.includes('Log Endpoint Debug');

        // Construct a unique Matter.js endpoint identifier
        const id = `${options.id}-${endpointName.toLowerCase()}`;

        if (parent) {
            // Create a child endpoint with an Identify cluster
            const endpoint = parent.addChildDeviceType(endpointName, definition, { id }, debug);
            endpoint.createDefaultIdentifyClusterServer();
            return endpoint;
        } else {
            // Only create the bridged node if allowed by the configuration
            if (!this.options.validatedNames.includes(endpointName)) return;

            // Construct other unique identifiers for this bridged node
            const { basicInformation: deviceBasicInformation } = options;
            const matterbridgeDeviceName = `${this.options.matterbridgeDeviceName} (${endpointName})`;
            const suffix = `-${this.bridged.length}`;
            const uniqueId = `${deviceBasicInformation.uniqueId.substring(0, 32 - suffix.length)}${suffix}`;
            const nodeOptions: EndpointOptionsBase = {
                id,
                matterbridgeDeviceName,
                basicInformation: {
                    ...deviceBasicInformation,
                    uniqueId
                }
            };

            // Create a bridged node endpoint
            // (includes Identify and Bridged Device Basic Information clusters)
            const endpoint = new EndpointBase(this.log, config, nodeOptions, [bridgedNode, ...definition]);
            this.bridged.push(endpoint);
            return endpoint;
        }
    }

    // All bridged device endpoints
    get bridgedNodeEndpoints(): EndpointBase[] {
        return this.bridged;
    }

    // Install On/Off and Fan Control cluster handlers
    async setFanControlHandlers(handlers: HandlersAirFan): Promise<void> {
        const endpoint = this.purifier;
        if (!endpoint) return;

        // Subscribe to Fan Control read/write attributes
        const keys: (keyof HandlersAirFan)[] = ['fanMode', 'percentSetting', 'rockSetting', 'speedSetting', 'windSetting'];
        await this.subscribeAttributes(endpoint, FanControl.Cluster.id, 'Fan Control', handlers, keys);

        // Install On/Off command handlers
        const setOnOff = async (command: string, newValue?: boolean): Promise<void> => {
            this.log.debug(`On/Off command: ${command}`);
            const oldValue = endpoint.getAttribute(OnOff.Cluster.id, 'onOff', this.log) as unknown;
            assertIsBoolean(oldValue);
            newValue ??= !oldValue; // (for Toggle command)

            // Call the handler and then update the attribute
            await handlers.onOff(newValue, oldValue);
            await endpoint.setAttribute(OnOff.Cluster.id, 'onOff', newValue, this.log);
        };
        endpoint.addCommandHandler('on',     () => { void setOnOff('On',  true); });
        endpoint.addCommandHandler('off',    () => { void setOnOff('Off', false); });
        endpoint.addCommandHandler('toggle', () => { void setOnOff('Toggle'); });
    }

    // Install Thermostat cluster handlers
    async setThermostatHandlers(handlers: HandlersAirThermostat): Promise<void> {
        const endpoint = this.thermostat;
        if (!endpoint) return;

        // Subscribe to Thermostat read/write attributes
        await this.subscribeAttributes(endpoint, Thermostat.Cluster.id, 'Thermostat', handlers);

        // Install Thermostat command handler
        endpoint.addCommandHandler('setpointRaiseLower', async ({ request }) => {
            const { mode, amount } = request as Thermostat.SetpointRaiseLowerRequest;
            this.log.debug(`Thermostat SetpointRaiseLower command: ${Thermostat.SetpointRaiseLowerMode[mode]} ${amount}`);
            if ([Thermostat.SetpointRaiseLowerMode.Heat, Thermostat.SetpointRaiseLowerMode.Both].includes(mode)) {
                // Treat the command as a write to occupiedHeatingSetpoint
                const oldValue = endpoint.getAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', this.log) as unknown;
                assertIsNumber(oldValue);
                const newValue = oldValue + amount * 10;

                // Call the handler and then update the attribute
                await handlers.occupiedHeatingSetpoint(newValue, oldValue);
                await endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', newValue, this.log);
            }
        });
    }

    // Subscribe to attribute updates
    async subscribeAttributes<T extends Record<keyof T, unknown>>(
        endpoint:   MatterbridgeEndpoint,
        clusterId:  ClusterId,
        name:       string,
        handlers:   HandlerAirMap<T>,
        keys?:      (keyof T & string)[]
    ): Promise<void> {
        keys ??= Object.keys(handlers) as (keyof T & string)[];
        await Promise.all(keys.map(async key => {
            const description = `${name} ${key}`;

            // Wrapper around handler to trap errors and flush the change cache
            const handler = (newValue: T[typeof key], oldValue: T[typeof key], context: { offline?: boolean }): void => {
                // Ignore reflected local writes (and duplicates)
                if (context.offline === true) return;

                // Call the handler and then ensure the next update gets applied
                this.log.info(`${CN}${description}${RI}: ${JSON.stringify(oldValue)} → ${CV}${JSON.stringify(newValue)}${RI}`);
                void (async () => {
                    try {
                        await handlers[key](newValue, oldValue);
                        this.updateNextStatus();
                    } catch (err) {
                        logError(this.log, description, err);
                    }
                })();
            };

            // Register the handler
            const success = await endpoint.subscribeAttribute(clusterId, key, handler, this.log);
            if (!success) this.log.warn(`${description} subscription failed`);
        }));
    }

    // Update the Bridged Device Basic Information cluster attributes
    @ifValueChanged
    async updateReachable(reachable: boolean): Promise<void> {
        await Promise.all(this.bridged.map(e => e.updateReachable(reachable)));
    }

    // Update the On/Off and Fan Control cluster attributes
    @ifValueChanged
    async updateFanControl(fan: UpdateAirFan): Promise<void> {
        const endpoint = this.purifier;
        if (!endpoint) return;

        // Matterbridge detects missing bitmap values as changes, so set defaults
        if (fan.rockSetting) fan.rockSetting = {
            rockLeftRight: false, rockUpDown: false, rockRound: false,
            ...fan.rockSetting
        };
        if (fan.windSetting) fan.windSetting = {
            sleepWind: false, naturalWind: false,
            ...fan.windSetting
        };

        // Log the new values
        const { onOff, airflowDirection, fanMode, percentSetting, rockSetting,
            speedSetting, windSetting, percentCurrent, speedCurrent } = fan;
        this.log.info(`${AN}On/Off${RI}: ${onOff ? 'On' : 'Off'}`);
        const logParts = [
            `current speed ${AV}${speedCurrent}${RI} (${AV}${percentCurrent}${RI} %)`,
            `set speed ${AV}${speedSetting}${RI} (${AV}${percentSetting}${RI} %)`,
            formatEnumLog(FanControl.FanMode, fanMode)
        ];
        if (rockSetting?.rockLeftRight) logParts.push('rock left/right');
        if (rockSetting?.rockUpDown)    logParts.push('rock up/down');
        if (rockSetting?.rockRound)     logParts.push('rock round');
        if (windSetting?.sleepWind)     logParts.push('sleep wind');
        if (windSetting?.naturalWind)   logParts.push('natural wind');
        if (airflowDirection !== undefined) {
            logParts.push(formatEnumLog(FanControl.AirflowDirection, airflowDirection));
        }
        this.log.info(`${AN}Fan Control${RI}: ${formatList(logParts)}`);

        // Perform the cluster attribute updates
        await endpoint.updateAttribute(OnOff.Cluster.id, 'onOff', onOff, this.log);
        const fanAttributes = ['airflowDirection', 'fanMode', 'percentSetting', 'rockSetting',
                               'speedSetting', 'windSetting', 'percentCurrent', 'speedCurrent'] as const;
        for (const attribute of fanAttributes) {
            const value = fan[attribute];
            if (value !== undefined) await endpoint.updateAttribute(FanControl.Cluster.id, attribute, value, this.log);
        }
    }

    // Update the Thermostat cluster attributes
    @ifValueChanged
    async updateThermostat(thermostat: UpdateAirThermostat): Promise<void> {
        const endpoint = this.thermostat;
        if (!endpoint) return;

        // Matterbridge detects missing bitmap values as changes, so set defaults
        thermostat.thermostatRunningState = {
            cool: false, heatStage2: false, coolStage2: false, fanStage2: false, fanStage3: false,
            ...thermostat.thermostatRunningState
        };

        // Log the new values
        const { occupiedHeatingSetpoint, systemMode, localTemperature,
            piHeatingDemand, thermostatRunningState } = thermostat;
        const logParts = [
            formatEnumLog(Thermostat.SystemMode, systemMode),
            `demand ${AV}${piHeatingDemand}${RI} %`,
            `target ${AV}${(occupiedHeatingSetpoint / 100).toFixed(2)}${RI} °C`
        ];
        if (localTemperature !== null) {
            logParts.push(`currently ${AV}${(localTemperature / 100).toFixed(2)}${RI} °C`);
        }
        if      (thermostatRunningState.heat)       logParts.push('heating');
        if      (thermostatRunningState.fanStage3)  logParts.push('fan stage 3');
        else if (thermostatRunningState.fanStage2)  logParts.push('fan stage 2');
        else if (thermostatRunningState.fan)        logParts.push('fan stage 1');
        this.log.info(`${AN}Thermostat${RI}: ${formatList(logParts)}`);

        // Perform the cluster attribute updates
        const attributes = ['occupiedHeatingSetpoint', 'systemMode', 'localTemperature',
                            'piHeatingDemand', 'thermostatRunningState'] as const;
        for (const attribute of attributes) {
            await endpoint.updateAttribute(Thermostat.Cluster.id, attribute, thermostat[attribute], this.log);
        }
    }

    // Update the HEPA and Activated Carbon Filter Monitoring cluster attributes
    @ifValueChanged
    async updateFilterMonitoring(filters: UpdateAirFilterMonitoring): Promise<void> {
        const updateCluster = async (
            clusterId: ClusterId,
            name: string,
            { condition, changeIndication, inPlaceIndicator }: UpdateAirFilterMonitoringSingle
        ): Promise<void> => {
            // Log the new values
            this.log.info(`${AN}${name} Filter${RI}: ${AV}${condition}${RI}% `
                        + formatEnumLog(ResourceMonitoring.ChangeIndication, changeIndication)
                        + `${inPlaceIndicator ? '' : ' not'} installed`);

            // Perform the cluster attribute updates
            const endpoint = this.purifier;
            await endpoint?.updateAttribute(clusterId, 'condition',        condition,        this.log);
            await endpoint?.updateAttribute(clusterId, 'changeIndication', changeIndication, this.log);
            if (inPlaceIndicator) await endpoint?.updateAttribute(clusterId, 'inPlaceIndicator', inPlaceIndicator, this.log);
        };

        // Update the status of both filters
        const { hepa, carbon } = filters;
        if (hepa)   await updateCluster(HepaFilterMonitoring.Cluster.id, 'HEPA', hepa);
        if (carbon) await updateCluster(ActivatedCarbonFilterMonitoring.Cluster.id, 'Activated Carbon', carbon);
    }

    // Update all of the Air Quality and Measurement cluster attributes
    @ifValueChanged
    async updateSensors(measurements: UpdateAirSensors): Promise<void> {
        const { airQuality, temperature, humidity, voc, co2, nox, hcho, pm25, pm10 } = measurements;

        // Log the new values
        const logMeasurements: string[] = [];
        const logEnum = <T extends Record<string, number | string>>(
            value:      (T[keyof T] extends number ? T[keyof T] : never) | undefined,
            enumType:   T,
            suffix:     string
        ) => {
            if (value === undefined) return;
            logMeasurements.push(`${formatEnumLog(enumType, value)} ${suffix}`);
        };
        const logNumber = (
            value:      number | null | undefined,
            transform:  ((v: number) => number | string) | undefined,
            suffix:     string
        ) => {
            if (value === undefined) return;
            const formatted = transform && value !== null ? transform(value) : value;
            logMeasurements.push(`${AV}${formatted}${RI} ${suffix}`);
        };
        logEnum  (airQuality,   AirQuality.AirQualityEnum,              'air quality');
        logNumber(temperature,  (v: number) => (v / 100).toFixed(2),    '°C');
        logNumber(humidity,     (v: number) => (v / 100).toFixed(2),    '% RH');
        logEnum  (voc,          ConcentrationMeasurement.LevelValue,    'VOC');
        logNumber(co2,          undefined,                              'ppm CO2');
        logEnum  (nox,          ConcentrationMeasurement.LevelValue,    'NOx');
        logNumber(hcho,         undefined,                              'µg/m³ H-CHO');
        logNumber(pm25,         undefined,                              'µg/m³ PM2.5');
        logNumber(pm10,         undefined,                              'µg/m³ PM10');
        this.log.info(`${AN}Air Quality Measurements${RI}: ${formatList(logMeasurements)}`);

        // Perform the cluster attribute updates
        const attributes: [MatterbridgeEndpoint[], ClusterId, string, number | null | undefined][] = [
            [this.airQuality,  AirQuality                                           .Cluster.id, 'airQuality',    airQuality],
            [this.temperature, TemperatureMeasurement                               .Cluster.id, 'measuredValue', temperature],
            [this.humidity,    RelativeHumidityMeasurement                          .Cluster.id, 'measuredValue', humidity],
            [this.airQuality,  TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id, 'levelValue',    voc],
            [this.airQuality,  CarbonDioxideConcentrationMeasurement                .Cluster.id, 'measuredValue', co2],
            [this.airQuality,  NitrogenDioxideConcentrationMeasurement              .Cluster.id, 'levelValue',    nox],
            [this.airQuality,  FormaldehydeConcentrationMeasurement                 .Cluster.id, 'measuredValue', hcho],
            [this.airQuality,  Pm25ConcentrationMeasurement                         .Cluster.id, 'measuredValue', pm25],
            [this.airQuality,  Pm10ConcentrationMeasurement                         .Cluster.id, 'measuredValue', pm10]
        ];
        const updatePromises = attributes.flatMap(([endpoints, clusterId, attribute, value]) =>
            value === undefined ? [] : endpoints.map(e => e.updateAttribute(clusterId, attribute, value, this.log)));
        await Promise.all(updatePromises);
    }

    // Ensure that the next MQTT status update is applied to the clusters
    updateNextStatus(): void {
        this.changed.flush('updateFanControl');
        this.changed.flush('updateThermostat');
    }
}