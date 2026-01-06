// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config, EntityName } from './config-types.js';
import { DysonMqttLike } from './dyson-mqtt.js';
import { Constructor } from './utils.js';
import { Changed } from './decorator-changed.js';
import { createHash } from 'crypto';
import { DeviceConfigMqtt } from './dyson-mqtt-client-live.js';
import { EndpointBase } from './endpoint-base.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { DysonDeviceCompatibility } from './dyson-device-compatibility.js';

// Dyson model details
export interface DysonDeviceModel {
    type:   string; // MQTT username
    number: string; // Model number
    name:   string; // Model description
}

// Details of an endpoint function (entity)
export interface DysonEntityDescription {
    name:           EntityName;
    description:    string;
}

// Dyson device constructor parameters
export type DysonDeviceConstructorParams<MQTT extends DysonMqttLike = DysonMqttLike> = [
    log:    AnsiLogger,
    config: Config,
    device: DeviceConfigMqtt,
    mqtt:   MQTT,
    api?:   DysonCloudAPIDevice
];

// Dyson device constructor type
export interface DysonDeviceConstructor<
    MQTT    extends DysonMqttLike       = DysonMqttLike,
    Device  extends DysonDevice<MQTT>   = DysonDevice<MQTT>
> {
    new (...args: DysonDeviceConstructorParams<MQTT>): Device;
    readonly mqttConstructor: Constructor<MQTT>;
}

// A Dyson robot vacuum or air treatment device
export abstract class DysonDevice<MQTT extends DysonMqttLike = DysonMqttLike> {

    // Details of the device model
    static readonly model:              DysonDeviceModel;
    static readonly filters:            { hepa?: string[], carbon?: string[] };

    // MQTT client constructor
    static readonly mqttConstructor:    Constructor<DysonMqttLike>;

    // Compatibility log message generator
    readonly        compatibility:      DysonDeviceCompatibility;

    // Decorator support
    changed:                            Changed;

    // Construct a new Dyson device instance
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly device:    DeviceConfigMqtt,
        readonly mqtt:      MQTT,
        readonly api?:      DysonCloudAPIDevice
    ) {
        // Prepare the decorator support
        this.changed = new Changed(log);

        // Warn of any expected compatibility issues
        const productName = `${this.modelName} (${this.modelNumber})`;
        this.compatibility = new DysonDeviceCompatibility(log, config, productName, this.modelType, this.firmwareVersion);
        this.compatibility.logCompatibility(this.compatibilityWarning);
    }

    // List of endpoint function names and descriptions to validate
    abstract getEntities(): DysonEntityDescription[];

    // Retrieve the root device endpoints after validation
    abstract getEndpoints(validatedNames: EntityName[]): EndpointBase[];

    // Start the device after the endpoints are active
    abstract start(): Promise<void>;

    // Stop the device when Matterbridge is shutting down
    async stop(): Promise<void> {
        await this.mqtt.stop();
    }

    // Use the serial number to generate a 32-character opaque unique ID
    get uniqueId(): string {
        const hash = createHash('sha256').update(this.serialNumber).digest('hex');
        const model = this.modelNumber.replace(/.*\//, '').toLowerCase();
        return `dyson-${model}-${hash}`.substring(0, 32);
    }

    // Retrieve the static data for an instance
    get classStatic(): typeof DysonDevice { return this.constructor as typeof DysonDevice; }
    get modelName():            string { return this.api?.modelName   ?? this.classStatic.model.name; }
    get modelNumber():          string { return this.api?.modelNumber ?? this.classStatic.model.number; }
    get modelType():            string { return this.classStatic.model.type; }

    // Retrieve common per-device data
    get deviceName():           string { return this.device.name; }
    get serialNumber():         string { return this.device.serialNumber; }
    get firmwareVersion():      string | undefined { return this.api?.firmwareVersion; }

    // Retrieve any compatibility warning for this device
    get compatibilityWarning(): string | undefined { return this.compatibility.warning; }

    // Convert the MQTT root topic to a ProductID
    get productId(): number {
        const hex = this.modelType.replace(/[^A-F0-9]/ig, '');
        const parsed = parseInt(hex.substring(0, 4), 16);
        return isNaN(parsed) ? 0x0000 : parsed;
    }
};