// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { DysonMqtt, DysonMqttConfig } from './dyson-mqtt.js';
import {
    checkers as dysonMsgCheckersAir,
    TypeMap as DysonMsgMapAir
} from './ti/dyson-air-msg-types.js';
import { Config, DeviceConfig } from './config-types.js';
import { AnsiLogger } from 'matterbridge/logger';
import { formatList, tryListener } from './utils.js';
import {
    DysonAirMsgCurrentFaults,
    DysonAirMsgCurrentState,
    DysonAirMsgEnvironmentalCurrentSensorData,
    DysonAirMsgFaultsChange,
    DysonAirMsgHello,
    DysonAirMsgStateChange
} from './dyson-air-msg-types.js';
import {
    DysonAirCarbonFilterEnum,
    DysonAirErrorCodeEnum,
    DysonAirFanSpeed,
    DysonAirFaultStatus,
    DysonAirModuleError,
    DysonAirModuleWarning,
    DysonAirProductError,
    DysonAirProductWarning,
    DysonAirSensorValueEnum,
    DysonAirSleepTimerEnum,
    DysonAirWarningCodeEnum
} from './dyson-air-types.js';
import { DysonAirCurrentSensorData } from './dyson-air-sensor-types.js';
import { DysonAirProductState } from './dyson-air-state-types.js';
import { DysonMsgAny } from './dyson-mqtt-parse.js';
import { DysonModeReason } from './dyson-types.js';

// Configuration of a Dyson MQTT client for robot vacuums
const DYSON_MQTT_CONFIG_AIR: DysonMqttConfig<DysonMsgMapAir> = {
    topics: {
        command:    '@/@/command',
        subscribe: ['@/@/status/connection',
                    '@/@/status/current',
                    '@/@/status/faults']
    },
    messages: {
        prefix:     'DysonAirMsg',
        checkers:   dysonMsgCheckersAir
    }
};

// Dyson air treatment machine product data status
type ProductStateNumericEnumKeys = 'cflr' | 'fnsp' | 'nmdv';
const PRODUCT_STATE_NUMERIC_KEYS = ['hmax', 'hflr', 'filf', 'osal', 'osau', 'cdrr', 'cltr', 'humt', 'rect'] as const;
type ProductStateNumericKeys = typeof PRODUCT_STATE_NUMERIC_KEYS[number];
type ProductStateVerbatimKeys = Exclude<keyof DysonAirProductState, ProductStateNumericEnumKeys | ProductStateNumericKeys>;
export type DysonMqttProductState =
    Pick<DysonAirProductState, ProductStateVerbatimKeys>
    & { [K in ProductStateNumericEnumKeys ]?: DysonAirProductState[K] | number }
    & Partial<Record<ProductStateNumericKeys, number>>
type DysonMqttProductStateEntry<K extends keyof DysonMqttProductState =
    keyof DysonMqttProductState> = [K, DysonMqttProductState[K]];

// Dyson air treatment machine faults status
interface Faults {
    productErrors:      Set<DysonAirProductError>;
    productWarnings:    Set<DysonAirProductWarning>;
    moduleErrors:       Set<DysonAirModuleError>;
    moduleWarnings:     Set<DysonAirModuleWarning>;
}

// Dyson air treatment machine sensor status
type SensorDataV2 = 'hchr' | 'p25r' | 'p10r' | 'va10';
export type DysonMqttStatusAirSensor = {
    [K in keyof Omit<DysonAirCurrentSensorData, 'sltm' | SensorDataV2>]: DysonAirSensorValueEnum | number;
} & {
    sltm?: DysonAirSleepTimerEnum | number;
}

// Dyson air treatment machine combined status
export type DysonMqttStatusAir =
    Pick<DysonAirMsgHello, 'version'>
  & DysonMqttProductState
  & DysonMqttStatusAirSensor
  & Partial<Faults>;

// Dyson MQTT client for air treatment machines
export class DysonMqttAir extends DysonMqtt<DysonMsgMapAir, DysonMqttStatusAir> {

    // Messages still required for initialisation
    private initialiseMsgs = new Set([
        'HELLO',
        'CURRENT-STATE',
        'ENVIRONMENTAL-CURRENT-SENSOR-DATA'
    ]);

    // Construct a new MQTT client
    constructor(log: AnsiLogger, config: Config, device: DeviceConfig) {
        super(log, config, device, DYSON_MQTT_CONFIG_AIR);

        // Handle MQTT events
        this.on('subscribed', tryListener(this, async () => {
            // Request the current status when (re)connected
            await this.publish('REQUEST-CURRENT-STATE');
            await this.publish('REQUEST-PRODUCT-ENVIRONMENT-CURRENT-SENSOR-DATA');
        })
        ).on('message', tryListener(this, msg => {
            // Update the robot vacuum state from the received messages
            this.updateStateFromMessage(msg);
            this.checkIfInitialised(msg);
        }));
    }

    // Update state from a received message
    updateStateFromMessage(msg: DysonMsgAny<DysonMsgMapAir>) {
        switch (msg.msg) {
        case 'HELLO':
            this.updateProductInfo(msg);
            break;
        case 'STATE-CHANGE':
            msg = this.convertStateChange(msg);
            // (fallthrough)
        case 'CURRENT-STATE':
            this.updateState(msg);
            break;
        case 'ENVIRONMENTAL-CURRENT-SENSOR-DATA':
            this.updateSensorData(msg);
            break;
        case 'FAULTS-CHANGE':
            msg = this.convertFaultsChange(msg);
            // (fallthrough)
        case 'CURRENT-FAULTS':
            this.updateFaults(msg);
        }
    }

    // Check whether all required messages have been received
    checkIfInitialised(msg: DysonMsgAny<DysonMsgMapAir>): void {
        this.initialiseMsgs.delete(msg.msg);
        if (!this.status.initialised && this.initialiseMsgs.size === 0) {
            this.status.initialised = true;
            this.log.info('MQTT client initialisation complete');
        }
    }

    // Update hardware and software state from a received message
    updateProductInfo(msg: DysonAirMsgHello): void {
        this.status.version = msg.version;
    }

    // Convert a STATE-CHANGE message to CURRENT-STATE format
    convertStateChange(msg: DysonAirMsgStateChange): DysonAirMsgCurrentState {
        const productState = convertChangesToStatus(msg.productState);
        return { ...msg, msg: 'CURRENT-STATE', productState };
    }

    // Convert a FAULTS-CHANGE message to CURRENT-FAULTS format
    convertFaultsChange(msg: DysonAirMsgFaultsChange): DysonAirMsgCurrentFaults {
        return {
            msg:                'CURRENT-FAULTS',
            time:               msg.time,
            productErrors:      convertChangesToStatus(msg.productErrors),
            productWarnings:    convertChangesToStatus(msg.productWarnings),
            moduleErrors:       convertChangesToStatus(msg.moduleErrors),
            moduleWarnings:     convertChangesToStatus(msg.moduleWarnings)
        };
    }

    // Update product state from a received message
    updateState(msg: DysonAirMsgCurrentState): void {
        // Check whether the error and warning codes are known
        const checkCode = (description: string, key: keyof DysonAirProductState, knownValues: Record<string, string>): void => {
            const value = msg.productState[key];
            if (value === undefined || Object.values(knownValues).includes(value)) return;
            this.log.warn(`Received unknown ${description}: ${value}`);
        };
        checkCode('error code',   'ercd', DysonAirErrorCodeEnum);
        checkCode('warning code', 'wacd', DysonAirWarningCodeEnum);

        // Copy everything initially, but some values will be overwritten
        const { productState } = msg;
        Object.assign(this.status, productState);

        // Parse values that can be either numeric or enum values
        this.status.cflr = this.parseNumericOrEnumValue('cflr', DysonAirCarbonFilterEnum, productState.cflr);
        this.status.fnsp = this.parseNumericOrEnumValue('fnsp', DysonAirFanSpeed,         productState.fnsp);
        this.status.nmdv = this.parseNumericOrEnumValue('nmdv', DysonAirFanSpeed,         productState.nmdv);

        // Parse values that should always be numeric strings
        for (const key of PRODUCT_STATE_NUMERIC_KEYS) {
            const value = productState[key];
            this.status[key] = value === undefined ? undefined : Number(value);
        }

        // Convert target temperature from Kelvin to Celsius
        if (this.status.hmax) this.status.hmax = roundedKtoC(this.status.hmax / 10);
    }

    // Update environmental sensor data from a received message
    updateSensorData(msg: DysonAirMsgEnvironmentalCurrentSensorData): void {
        const parse = (field: keyof DysonAirCurrentSensorData, divisor?: number): DysonAirSensorValueEnum | number | undefined =>
            this.parseNumericOrEnumValue(field, DysonAirSensorValueEnum, msg.data[field], divisor);

        // Convert the sensor data to numeric form with appropriate scaling
        this.status.hact = parse('hact');
        this.status.co2r = parse('co2r');
        this.status.pact = parse('pact');
        this.status.hcho = parse('hchr') ?? parse('hcho');
        this.status.noxl = parse('noxl');
        this.status.pm25 = parse('p25r') ?? parse('pm25');
        this.status.pm10 = parse('p10r') ?? parse('pm10');
        this.status.vact = parse('va10') ?? parse('vact', 1/11);

        // Convert temperature from Kelvin to Celsius
        const kelvin = parse('tact', 10);
        this.status.tact = typeof kelvin === 'number' ? KtoC(kelvin) : kelvin;

        // Similarly for the sleep timer
        this.status.sltm = this.parseNumericOrEnumValue('sltm', DysonAirSleepTimerEnum, msg.data.sltm);
    }

    // Update environmental sensor data from a received message
    updateFaults(msg: DysonAirMsgCurrentFaults): void {
        const faultKeysCheckers = [
            ['productErrors',   DysonAirProductError],
            ['productWarnings', DysonAirProductWarning],
            ['moduleErrors',    DysonAirModuleError],
            ['moduleWarnings',  DysonAirModuleWarning]
        ] as const;

        // Convert each fault type to a set of active fault codes
        for (const [key, knownValues] of faultKeysCheckers) {
            // Identify unknown faults and active known faults
            const activeFaults  = new Set<string>();
            const unknownFaults = new Set<string>();
            for (const [fault, status] of Object.entries(msg[key])) {
                if (!Object.values(knownValues).includes(fault))    unknownFaults.add(fault);
                else if (status === DysonAirFaultStatus.Fail)       activeFaults. add(fault);
            }

            // Log warnings for unknown faults (both active and inactive)
            if (unknownFaults.size) {
                this.log.warn(`Received unknown ${key}: ${formatList([...unknownFaults])}`);
            }

            // Update the status with the set of active faults
            (this.status[key] as Set<string>) = activeFaults;
        }
    }

    // Publish an air treatment machine command to set the product state
    commandStateSet(productState: DysonMqttProductState): Promise<void> {
        // Convert values to the format required in the MQTT message
        const data: DysonAirProductState = {};
        const mapEntry = <K extends keyof DysonMqttProductState>([key, value]: DysonMqttProductStateEntry<K>): void => {
            if (value === undefined) return;
            let valueString: string;
            if (typeof value === 'number') {
                // Convert numeric values to four digit strings for the command
                const numericValue = key === 'hmax' ? roundedCtoK(value) * 10 : value;
                valueString = numericValue.toFixed(0).padStart(4, '0');
            } else {
                // Enum or general string values are already the correct type
                valueString = value;
            }
            data[key] = valueString as DysonAirProductState[K];
        };
        const entries = Object.entries(productState) as DysonMqttProductStateEntry[];
        entries.forEach(mapEntry);

        // Publish the command
        return this.publish('STATE-SET', {
            'mode-reason':  DysonModeReason.LocalApp,
            data
        });
    }

    // Parse strings that can be numeric or enum values, returning the number or enum value
    parseNumericOrEnumValue<T extends string>(
        description:    string,
        enumMap:        Record<string, T>,
        value?:         string,
        divisor = 1
    ): number | T | undefined {
        if (value === undefined || value === '') return;

        // Try parsing as a decimal natural number
        if (/^\d+$/.test(value)) return Number(value) / divisor;

        // Otherwise check if it is a member of the specified enum type
        const expectedValues = Object.values<string>(enumMap);
        if (expectedValues.includes(value)) return value as T;
        this.log.warn(`Received unexpected '${description}' value: ${value}`
                    + ` (expected ${expectedValues.join(', ')}, or a numeric string)`);
    }
}

// Convert an object of changes to an object of current status
type Changes<T>           = { [K in keyof T]?: [unknown, unknown] | undefined };
type StatusFromChanges<T> = { [K in keyof T]: T[K] extends [unknown, infer V] | undefined ? V : never; }
function convertChangesToStatus<T extends Changes<T>>(changes: T): StatusFromChanges<T> {
    return Object.fromEntries(
        (Object.keys(changes) as (keyof T)[]).map((key) => [key, changes[key]?.[1]])
    ) as StatusFromChanges<T>;
}

// Temperature conversion (accurate version for 'tact')
export function KtoC(kelvin: number): number { return kelvin - 273.15; }

// Temperature conversion (rounded version for 'hmax')
export function roundedKtoC(kelvin: number): number  { return kelvin  - 273; }
export function roundedCtoK(celsius: number): number { return celsius + 273; }