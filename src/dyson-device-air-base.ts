// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    DysonDevice,
    DysonDeviceConstructorParams
} from './dyson-device-base.js';
import {
    DysonMqttAir,
    DysonMqttProductState,
    DysonMqttStatusAir
} from './dyson-mqtt-air.js';
import { EntityName } from './config-types.js';
import { MatterbridgeEndpoint } from 'matterbridge';
import {
    FanControl,
    ResourceMonitoring
} from 'matterbridge/matter/clusters';
import { assertIsDefined, formatList, tryListener } from './utils.js';
import { DysonMqttStatus } from './dyson-mqtt.js';
import {
    EndpointsAir,
    EndpointOptionsAir,
    EndpointOptionsAirSensors,
    UpdateAirFilterMonitoring,
    UpdateAirFilterMonitoringSingle,
    UpdateAirFan,
    AirFanRockSetting
} from './endpoint-air.js';
import { PLUGIN_URL, VENDOR_NAME } from './settings.js';
import { mapDysonAirSensorStatus } from './dyson-device-air-quality.js';
import {
    DysonAirAnemometerControlProfile,
    DysonAirAnemometerControlTilt,
    DysonAirAutoMode,
    DysonAirFanAutoPower,
    DysonAirFanDirection,
    DysonAirFanPower,
    DysonAirFanSpeed,
    DysonAirFanState,
    DysonAirNightMode,
    DysonAirOscillation,
    DysonAirTiltAngle,
    DysonAirTiltOscillation
} from './dyson-air-types.js';
import { CC, RI } from './logger-options.js';
import { ifValueChanged } from './decorator-changed.js';

// Mappings between FanMode and SpeedSetting
const FAN_MODE_TO_SPEED_LOW     = 1;
const FAN_MODE_TO_SPEED_MEDIUM  = 5;
const FAN_MODE_TO_SPEED_HIGH    = 10;
const SPEED_TO_FAN_MODE_LOW     = 3; // 1~3: Low
const SPEED_TO_FAN_MODE_MEDIUM  = 6; // 4~6: Medium, 7~9: High

// Lifetime of a Pure (Hot+)Cool Link HEPA filter in operational hours
const PURE_LINK_FILTER_HOURS = 4300;

// Filter lifetime thresholds
const FILTER_CRITICAL =  0; // %
const FILTER_WARNING  = 10; // %

// A Dyson air treatment device
export abstract class DysonDeviceAirBase extends DysonDevice<DysonMqttAir> {

    // The MQTT client and status update listener
    static readonly mqttConstructor = DysonMqttAir;
    mqttListener:       () => void;

    // The air purifier device endpoints
    endpoints?:         EndpointsAir;

    // Supported features
    hasBreeze:          boolean;
    hasCarbonFilter:    boolean;
    hasDirection:       boolean;
    hasLeftRight:       boolean;
    hasUpDown:          boolean;

    // Should FanMode be used (in addition to On/Off) for fan off control
    useFanModeOff = false;

    // Construct a new Dyson device instance
    constructor(...args: DysonDeviceConstructorParams<DysonMqttAir>) {
        super(...args);

        // Identify supported features from the presence of MQTT values
        const { status } = this.mqtt;
        this.hasBreeze          = status.ancp !== undefined;
        this.hasCarbonFilter    = status.cflr !== undefined;
        this.hasDirection       = status.fdir !== undefined;
        this.hasLeftRight       = status.oson !== undefined;
        this.hasUpDown          = status.oton !== undefined;

        // Prepare a listener for MQTT updates
        this.mqttListener = tryListener(this.mqtt, () =>
            this.updateClusterAttributes(this.mqtt.status));
    }

    // Create the endpoint for this device
    makeEndpoints(validatedNames: EntityName[]): EndpointsAir {
        // Static configuration of the air purifier clusters
        const endpointOptions: EndpointOptionsAir = {
            uniqueStorageKey:       this.uniqueId,
            matterbridgeDeviceName: this.deviceName,
            validatedNames,
            deviceBasicInformation: {
                nodeLabel:          this.deviceName,
                partNumber:         this.modelNumber,
                productLabel:       this.modelNumber,
                productName:        this.modelName,
                productUrl:         PLUGIN_URL,
                serialNumber:       this.serialNumber,
                softwareVersion:    this.mqtt.status.version,
                uniqueId:           this.uniqueId,
                vendorName:         VENDOR_NAME
            },
            fanControl: {
                rockSupport: {
                    rockLeftRight:  this.hasLeftRight,
                    rockUpDown:     this.hasUpDown,
                    rockRound:      false
                },
                windSupport: {
                    sleepWind:      true, // Night mode
                    naturalWind:    this.hasBreeze
                },
                directionSupport:   this.hasDirection
            },
            hepaFilter: {
                filterPartNumbers:  this.classStatic.filters.hepa
            },
            carbonFilter:           this.hasCarbonFilter ? {
                filterPartNumbers:  this.classStatic.filters.carbon
            } : undefined,
            sensors:                this.sensorSupport
        };

        // Create the endpoint
        return new EndpointsAir(this.log, this.config, endpointOptions);
    }

    // Install handlers
    async installHandlers(endpoints: EndpointsAir): Promise<void> {
        await endpoints.setFanControlHandlers({
            onOff: onOff => this.setPower(onOff),
            airflowDirection: airflowDirection =>
                this.setDirection(airflowDirection === FanControl.AirflowDirection.Forward),
            fanMode: fanMode => {
                switch (fanMode) {
                case FanControl.FanMode.Auto:   return this.setFanAuto();
                case FanControl.FanMode.Off:    return this.setFanSpeed(0);
                case FanControl.FanMode.Low:    return this.setFanSpeed(FAN_MODE_TO_SPEED_LOW);
                case FanControl.FanMode.Medium: return this.setFanSpeed(FAN_MODE_TO_SPEED_MEDIUM);
                default:                        return this.setFanSpeed(FAN_MODE_TO_SPEED_HIGH);
                }
            },
            percentSetting: percentSetting =>
                this.setFanSpeed(Math.ceil(percentSetting / 10)),
            rockSetting: async rockSetting => {
                if (this.hasLeftRight)  await this.setOscillateLeftRight(!!rockSetting.rockLeftRight);
                if (this.hasUpDown)     await this.setOscillateUpDown(!!rockSetting.rockUpDown);
            },
            speedSetting: speedSetting =>
                this.setFanSpeed(speedSetting),
            windSetting: async windSetting => {
                await this.setNightMode(!!windSetting.sleepWind);
                if (this.hasBreeze)     await this.setOscillateBreeze(!!windSetting.naturalWind);
            }
        });
    }

    // Determine which optional sensors are supported
    get sensorSupport(): EndpointOptionsAirSensors {
        const sensors = mapDysonAirSensorStatus(this.log, this.mqtt.status);
        return {
            voc:    sensors.voc  !== undefined,
            co2:    sensors.co2  !== undefined,
            nox:    sensors.nox  !== undefined,
            hcho:   sensors.hcho !== undefined,
            pm25:   sensors.pm25 !== undefined,
            pm10:   sensors.pm10 !== undefined
        };
    }

    // List of endpoint function names and descriptions to validate
    override getEntities(): { name: EntityName, description: string }[] {
        return [{
            name:           'Air Purifier',
            description:    'Fan speed/oscillation control and filter monitoring'
        }, {
            name:           'Air Quality Sensor',
            description:    'Environmental sensor measurements'
        }, {
            name:           'Composed Air Purifier',
            description:    'Air purifier with integrated thermostat and sensors'
        }, {
            name:           'Humidity Sensor',
            description:    'Relative humidity measurement'
        }, {
            name:           'Temperature Sensor',
            description:    'Temperature measurement'
        }];
    }

    // Retrieve the root device endpoints after validation
    override getEndpoints(validatedNames: EntityName[]): MatterbridgeEndpoint[] {
        this.endpoints ??= this.makeEndpoints(validatedNames);
        return this.endpoints.bridgedNodeEndpoints;
    }

    // Start the device after the endpoints are active
    override async start(): Promise<void> {
        assertIsDefined(this.endpoints);
        this.mqtt.on('status', this.mqttListener);
        await this.installHandlers(this.endpoints);
        await this.updateClusterAttributes(this.mqtt.status);
    }

    // Stop the device when Matterbridge is shutting down
    override async stop(): Promise<void> {
        this.mqtt.off('status', this.mqttListener);
        await super.stop();
    }

    // Switch the fan on or off (without changing auto mode, if possible)
    async setPower(powerOn: boolean): Promise<void> {
        const { fpwr, fmod } = this.mqtt.status;
        const isOn = fpwr ? fpwr !== DysonAirFanPower.Off       // Non-Link
                          : fmod !== DysonAirFanAutoPower.Off;  // Link models
        if (isOn === powerOn) {
            this.log.info(`Fan is already ${powerOn ? 'on' : 'off'}; no action required`);
        } else if (powerOn) {
            this.log.info('Switching on');
            await this.setState({}); // (sets an appropriate on state)
        } else {
            this.log.info('Switching off');
            await this.setState(fpwr ? { fpwr: DysonAirFanPower.Off }       // Non-Link
                                     : { fmod: DysonAirFanAutoPower.Off }); // Link models
        }
    }

    // Switch the fan on in auto mode
    async setFanAuto(): Promise<void> {
        this.log.info('Enabling auto mode');
        const { auto } = this.mqtt.status;
        await this.setState(auto ? { auto: DysonAirAutoMode.Auto }       // Non-Link
                                 : { fmod: DysonAirFanAutoPower.Auto }); // Link models
    }

    // Set the airflow direction (all except Link models)
    async setDirection(forward: boolean): Promise<void> {
        const direction = forward ? 'Forward' : 'Backward';
        this.log.info(`${direction} airflow`);
        await this.setState({ fdir: DysonAirFanDirection[direction] });
    }

    // Set the fan speed
    async setFanSpeed(speed: number): Promise<void> {
        // Quantize and range check the speed
        const fnsp = Math.min(Math.round(speed), 10);
        if (fnsp < 1) {
            this.log.info('Fan speed set to 0; turning power off');
            this.useFanModeOff = true;
            return this.setPower(false);
        }

        // Set the speed, ensuring that auto mode is disabled
        this.log.info(`Setting fan speed to ${fnsp}`);
        const { auto } = this.mqtt.status;
        await this.setState(auto ? { fnsp, auto: DysonAirAutoMode.Manual }          // Non-Link
                                 : { fnsp, fmod: DysonAirFanAutoPower.Manual });    // Link models
    }

    // Set night mode
    async setNightMode(night: boolean): Promise<void> {
        const nightMode = night ? 'Night' : 'Day';
        this.log.info(`${nightMode} mode`);
        await this.setState({ nmod: DysonAirNightMode[nightMode] });
    }

    // Set horizontal oscillation (all except Big+Quiet models)
    async setOscillateLeftRight(oscillate: boolean): Promise<void> {
        this.log.info(`${oscillate ? 'Enabling' : 'disabling'} left/right oscillation`);

        // Most models use 'ON'/'OFF', but some use 'OION'/'OIOF' instead
        const { oson } = this.mqtt.status;
        const isOI = oson === DysonAirOscillation.FixedOI
                  || oson === DysonAirOscillation.OscillatingOI;
        const OSON_KEYS = [['Fixed', 'FixedOI'], ['Oscillating', 'OscillatingOI']] as const;
        const key = OSON_KEYS[oscillate ? 1 : 0][isOI ? 1 : 0];
        await this.setState({ oson: DysonAirOscillation[key] });
    }

    // Set vertical oscillation (Big+Quiet models only)
    async setOscillateUpDown(oscillate: boolean): Promise<void> {
        this.log.info(`${oscillate ? 'Enabling' : 'disabling'} up/down oscillation`);
        const status: DysonMqttProductState = {};
        if (oscillate) {
            // Enable oscillation in breeze mode
            status.oton = DysonAirTiltOscillation.Oscillating;
            status.anct = DysonAirAnemometerControlTilt.Breeze;
            status.otal = DysonAirTiltAngle.Breeze;
            status.otau = DysonAirTiltAngle.Breeze;
        } else {
            // Disable oscillation
            status.oton = DysonAirTiltOscillation.Fixed;
            status.anct = DysonAirAnemometerControlTilt.Custom;
            const { otal, otau } = this.mqtt.status;
            if (otal === DysonAirTiltAngle.Breeze || otau === DysonAirTiltAngle.Breeze) {
                // Set an arbitrary tilt angle if breeze mode was enabled
                status.otal = DysonAirTiltAngle.Degrees0;
                status.otau = DysonAirTiltAngle.Degrees0;
            }
        }
        await this.setState(status);
    }

    // Set breeze oscillation and fan speed (Humidify models only)
    async setOscillateBreeze(breeze: boolean): Promise<void> {
        this.log.info(`${breeze ? 'Enabling' : 'disabling'} breeze oscillation`);
        const status: DysonMqttProductState = {
            oson: DysonAirOscillation.Oscillating
        };
        if (breeze) {
            // Enable oscillation in breeze mode
            status.ancp = DysonAirAnemometerControlProfile.Breeze;
        } else {
            // Enable non-breeze oscillation
            const { ancp } = this.mqtt.status;
            if (ancp === DysonAirAnemometerControlProfile.Breeze) {
                // Set an arbitrary oscillation angle if breeze mode was enabled
                status.ancp = DysonAirAnemometerControlProfile.Degrees180;
            }
        }
        await this.setState(status);
    }

    // Send an MQTT command to set the product state
    async setState(productState: DysonMqttProductState): Promise<void> {
        // Also switch to an active power state, unless an alternative specified
        const { fpwr, fmod } = this.mqtt.status;
        if (fpwr === DysonAirFanPower.Off)      productState.fpwr ??= DysonAirFanPower.On;          // Non-Link
        if (fmod === DysonAirFanAutoPower.Off)  productState.fmod ??= DysonAirFanAutoPower.Manual;  // Link models

        // Publish the command
        const values = Object.entries(productState).map(([key, value]) => `${CC}${key}=${value}${RI}`);
        this.log.info(`Setting state: ${formatList(values)}`);
        await this.mqtt.commandStateSet(productState);

        // Ensure that the next MQTT status update is processed
        this.changed.flush();
    }

    // Update cluster attributes when the MQTT status is updated
    @ifValueChanged
    async updateClusterAttributes(
        status: DysonMqttStatus<DysonMqttStatusAir>
    ): Promise<void> {
        const fanStatus = this.mapDysonFanControlStatus(status);
        const filterStatus = this.mapDysonFilterStatus(status);
        const sensorStatus = mapDysonAirSensorStatus(this.log, status);
        await Promise.all([
            this.endpoints?.updateFanControl(fanStatus),
            this.endpoints?.updateFilterMonitoring(filterStatus),
            this.endpoints?.updateSensors(sensorStatus)
        ]);
    }

    // Convert the status to On/Off and Fan Control cluster attributes
    mapDysonFanControlStatus(status: DysonMqttStatus<DysonMqttStatusAir>): UpdateAirFan {
        const { ancp, auto, fdir, fpwr, fmod, fnsp, fnst, nmod, oson, oton } = status;

        // Start by determining the actual device state
        const onOff = fpwr ? fpwr !== DysonAirFanPower.Off          // Non-Link
                           : fmod !== DysonAirFanAutoPower.Off;     // Link models
        const isAuto = auto === DysonAirAutoMode.Auto               // Non-Link
                    || fnsp === DysonAirFanSpeed.Auto;              // Link
        const isSpinning = fnst === DysonAirFanState.Running;

        // Link models do not preserve speed setting in auto, so default to max
        let speedSetting = typeof fnsp === 'number' ? fnsp : 10;

        // Start by mapping the speed to a mode
        let fanMode = FanControl.FanMode[
            speedSetting <= SPEED_TO_FAN_MODE_LOW    ? 'Low'
          : speedSetting <= SPEED_TO_FAN_MODE_MEDIUM ? 'Medium' : 'High'];
        let speedCurrent: number;
        if (!onOff) {
            // Off, fan stopped
            speedCurrent = 0;
            if (this.useFanModeOff) {
                // Fan Control was set to Off or 0 speed via Matter
                fanMode = FanControl.FanMode.Off;
                speedSetting = 0;
            }
        } else {
            this.useFanModeOff = false;
            if (isAuto) {
                // Auto mode: assume fan either at maximum speed or stopped
                fanMode = FanControl.FanMode.Auto;
                speedCurrent = isSpinning ? 10 : 0;
            } else {
                // Manual mode: the fan is at the requested speed
                speedCurrent = speedSetting;
            }
        }

        // Night mode
        const sleepWind = nmod === DysonAirNightMode.Night;

        // Airflow direction
        let airflowDirection: FanControl.AirflowDirection | undefined;
        if (this.hasDirection && fdir) {
            // Non-Link models only
            airflowDirection = FanControl.AirflowDirection[
                fdir === DysonAirFanDirection.Forward ? 'Forward' : 'Reverse'];
        }

        // Various oscillation modes
        let rockLeftRight = false, rockUpDown = false, naturalWind = false;
        if (this.hasLeftRight) {
            // All except Big+Quiet models
            rockLeftRight = oson === DysonAirOscillation.Oscillating
                         || oson === DysonAirOscillation.OscillatingOI;
        }
        if (this.hasUpDown) {
            // Big+Quiet models only
            rockUpDown = oton === DysonAirTiltOscillation.Oscillating;
        }
        if (this.hasBreeze) {
            // Humidify+Cool models only
            naturalWind = ancp === DysonAirAnemometerControlProfile.Breeze;
        }

        // Return the mapped values
        let rockSetting: AirFanRockSetting | undefined;
        if (this.hasLeftRight || this.hasUpDown) rockSetting = { rockLeftRight, rockUpDown };
        return {
            airflowDirection,
            fanMode,
            onOff,
            percentCurrent: speedCurrent * 10,
            percentSetting: speedSetting * 10,
            rockSetting,
            speedCurrent,
            speedSetting,
            windSetting:    { sleepWind, naturalWind }
        };
    }

    // Convert the status to Filter Monitoring cluster attributes
    mapDysonFilterStatus(status: DysonMqttStatus<DysonMqttStatusAir>): UpdateAirFilterMonitoring {
        const filterStatus = (percent: number | string | undefined): UpdateAirFilterMonitoringSingle => {
            const inPlaceIndicator = typeof percent === 'number';
            const condition = inPlaceIndicator ? percent : 0;
            const changeIndication = ResourceMonitoring.ChangeIndication[
                condition <= FILTER_CRITICAL ? 'Critical'
                : condition <= FILTER_WARNING  ? 'Warning' : 'Ok'];
            return { condition, changeIndication, inPlaceIndicator };
        };

        // HEPA filter remaining life
        let hepaPercent = status.hflr;
        if (status.filf !== undefined) {
            // For Pure (Hot+)Cool Link convert remaining hours to percentage
            hepaPercent = Math.round(status.filf * 100 / PURE_LINK_FILTER_HOURS);
        }

        // Convert the filter status to Matter attribute representation
        return {
            hepa:   filterStatus(hepaPercent),
            carbon: this.hasCarbonFilter ? filterStatus(status.cflr) : undefined
        };
    }
}