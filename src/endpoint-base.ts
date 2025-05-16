// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import {
    AtLeastOne,
    DeviceTypeDefinition,
    MatterbridgeEndpoint
} from 'matterbridge';
import {
    BasicInformation,
    BridgedDeviceBasicInformation
} from 'matterbridge/matter/clusters';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    BridgedDeviceBasicInformationServer
} from 'matterbridge/matter/behaviors';
import { Changed, ifValueChanged } from './decorator-changed.js';
import { AN, AV, CN, RI } from './logger-options.js';

// Details required to configure the Bridged Device Basic Information cluster
export interface DeviceBasicInformationOptions {
    // Mandatory attribute
    uniqueId:               string; // 32 characters max
    // Optional attributes
    hardwareVersion?:       string; // 64 characters max
    manufacturingDate?:     string; // 'YYYMMDD'
    nodeLabel?:             string, // 32 characters max
    partNumber?:            string; // 32 characters max
    productAppearance?:     BasicInformation.ProductAppearance;
    productId?:             number; // uint16
    productLabel?:          string; // 64 characters max
    productName?:           string; // 32 characters max
    productUrl?:            string; // 256 characters max
    serialNumber?:          string; // 32 characters max
    softwareVersion?:       string; // 64 characters max
    vendorId?:              number; // uint16
    vendorName?:            string; // 32 characters max
}
export interface EndpointOptionsBase {
    // Matter.js endpoint identifier
    uniqueStorageKey:       string;
    // Matterbridge's unique endpoint name
    matterbridgeDeviceName: string;
    // Static configuration of cluster attributes
    deviceBasicInformation: DeviceBasicInformationOptions;
}

// A simplified endpoint interface that can be used by mixins
export type EndpointLike = Pick<EndpointBase,
    'behaviors' | 'log' | 'triggerEvent' | 'updateAttribute' | 'changed'
>;

// A Matterbridge endpoint with a Bridged Device Basic Information cluster
export class EndpointBase extends MatterbridgeEndpoint {

    // Decorator support
    changed: Changed;

    // Construct a new endpoint
    constructor(
        log:                AnsiLogger,
        readonly config:    Config,
        options:            EndpointOptionsBase,
        definition:         DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>
    ) {
        const { uniqueStorageKey } = options;
        const debug = config.debugFeatures.includes('Log Endpoint Debug');
        super(definition, { uniqueStorageKey }, debug);

        // Use supplied logger instead of the one created by the base class
        this.log = log;

        // Create the basic clusters required on all endpoints
        this.createDefaultIdentifyClusterServer()
            .createBridgedDeviceBasicInformationClusterServer(options.deviceBasicInformation);

        // Prepare the decorator support
        this.changed = new Changed(log);

        // Matterbridge requires a unique name for each endpoint
        this.deviceName = options.matterbridgeDeviceName;

        // Identify the device
        this.addCommandHandler('identify', () => {
            this.log.info(`${CN}Identify device${RI}`);
        });
    }

    // Create the Bridged Device Basic Information cluster
    createBridgedDeviceBasicInformationClusterServer(options: DeviceBasicInformationOptions): this {
        const parseOptionalNumber = (value?: string): number | undefined =>
            value === undefined ? undefined : parseInt(value, 10);

        // Copy of values (possibly) required by Matterbridge
        // (Do NOT use the nodeLabel for deviceName; it might not be unique)
        this.hardwareVersion        = parseOptionalNumber(options.hardwareVersion);
        this.hardwareVersionString  = options.hardwareVersion;
        this.productId              = options.productId;
        this.productName            = options.productName;
        this.serialNumber           = options.serialNumber;
        this.softwareVersion        = parseOptionalNumber(options.softwareVersion);
        this.softwareVersionString  = options.softwareVersion;
        this.uniqueId               = options.uniqueId;
        this.vendorId               = options.vendorId;
        this.vendorName             = options.vendorName;

        // Create the cluster
        this.behaviors.require(BridgedDeviceBasicInformationServer.enable({
            events: {
                leave:              true,
                reachableChanged:   true
            }
        }), {
            // Mandatory attributes
            reachable:              true,
            uniqueId:               options.uniqueId             .substring(0, 32),
            // Optional attributes
            hardwareVersion:        parseOptionalNumber(options.hardwareVersion),
            hardwareVersionString:  options.hardwareVersion     ?.substring(0, 64),
            manufacturingDate:      options.manufacturingDate   ?.substring(0, 16),
            nodeLabel:              options.nodeLabel           ?.substring(0, 32),
            partNumber:             options.partNumber          ?.substring(0, 32),
            productAppearance:      options.productAppearance,
            productId:              options.productId,
            productLabel:           options.productLabel        ?.substring(0, 64),
            productName:            options.productName         ?.substring(0, 32),
            productUrl:             options.partNumber          ?.substring(0, 256),
            serialNumber:           options.serialNumber        ?.substring(0, 32),
            softwareVersion:        parseOptionalNumber(options.softwareVersion),
            softwareVersionString:  options.softwareVersion     ?.substring(0, 64),
            vendorId:               options.vendorId,
            vendorName:             options.vendorName          ?.substring(0, 32)
        });
        return this;
    }

    // Update the Bridged Device Basic Information cluster attributes
    @ifValueChanged
    async updateReachable(reachable: boolean): Promise<void> {
        const clusterId = BridgedDeviceBasicInformation.Cluster.id;
        this.log.info(`${AN}Reachable${RI}: ${AV}${reachable}${RI}`);
        await this.updateAttribute(clusterId, 'reachable', reachable, this.log);
        const payload: BridgedDeviceBasicInformation.ReachableChangedEvent = { reachableNewValue: reachable };
        await this.triggerEvent(clusterId, 'reachableChanged', payload, this.log);
    }
}

// Format an enum value for logging
export function formatEnumLog<T extends Record<string, number | string>>(
    enumMap:    T,
    value:      T[keyof T] extends number ? T[keyof T] : never
): string {
    const label = enumMap[value as keyof T];
    return `${AV}${label}${RI} (${AV}${value}${RI})`;
}