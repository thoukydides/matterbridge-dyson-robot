// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    bridgedNode,
    DeviceTypeDefinition,
    MatterbridgeEndpoint,
    roboticVacuumCleaner
} from 'matterbridge';
import { AtLeastOne, ServerNode } from 'matterbridge/matter';
import {
    BasicInformation
} from 'matterbridge/matter/clusters';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    BasicInformationServer,
    BridgedDeviceBasicInformationServer
} from 'matterbridge/matter/behaviors';
import { Changed, ifValueChanged } from './decorator-changed.js';
import { AN, AV, CN, RI } from './logger-options.js';

// Details required to configure the (Bridged Device) Basic Information cluster
export interface BasicInformationOptions {
    // Mandatory attribute
    uniqueId:               string; // 32 characters max
    // Mandatory attributes for non-bridged nodes
    hardwareVersion?:       string; // 64 characters max
    nodeLabel:              string, // 32 characters max
    productId:              number; // uint16
    productName:            string; // 32 characters max
    softwareVersion?:       string; // 64 characters max
    vendorId:               number; // uint16
    vendorName:             string; // 32 characters max
    // Optional attributes
    manufacturingDate?:     string; // 'YYYMMDD'
    partNumber?:            string; // 32 characters max
    productAppearance?:     BasicInformation.ProductAppearance;
    productLabel?:          string; // 64 characters max
    productUrl?:            string; // 256 characters max
    serialNumber?:          string; // 32 characters max
}
export interface EndpointOptionsBase {
    // Matter.js endpoint identifier
    id:                     string;
    // Matterbridge's unique endpoint name
    matterbridgeDeviceName: string;
    // Static configuration of cluster attributes
    basicInformation:       BasicInformationOptions;
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
        readonly options:   EndpointOptionsBase,
        definition:         DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>
    ) {
        // Use Matterbridge's 'server' mode for robotic vacuums if enabled
        const definitionArray = Array.isArray(definition) ? definition : [definition];
        let mode: 'server' | undefined;
        if (config.enableServerRvc && definitionArray.includes(roboticVacuumCleaner)) {
            mode = 'server';
            definition = definitionArray.filter(d => d !== bridgedNode) as AtLeastOne<DeviceTypeDefinition>;
        }

        // Initialise the base class
        const { id } = options;
        const debug = config.debugFeatures.includes('Log Endpoint Debug');
        super(definition, { id, mode }, debug);

        // Use supplied logger instead of the one created by the base class
        this.log = log;

        // Matterbridge requires a unique name for each endpoint
        this.deviceName = options.matterbridgeDeviceName;

        // Copy of values (possibly) required by Matterbridge
        // (Do NOT use the nodeLabel for deviceName; it might not be unique)
        const info = options.basicInformation;
        this.hardwareVersion        = parseOptionalUnsigned(info.hardwareVersion);
        this.hardwareVersionString  = info.hardwareVersion;
        this.productId              = info.productId;
        this.productName            = info.productName;
        this.serialNumber           = info.serialNumber;
        this.softwareVersion        = parseOptionalUnsigned(info.softwareVersion);
        this.softwareVersionString  = info.softwareVersion;
        this.uniqueId               = info.uniqueId;
        this.vendorId               = info.vendorId;
        this.vendorName             = info.vendorName;

        // Create the basic clusters required on all endpoints
        this.createDefaultIdentifyClusterServer();
        if (!mode) this.createBridgedDeviceBasicInformationClusterServer(info);
        // (Matterbridge creates the Basic Information cluster in 'server' mode)

        // Prepare the decorator support
        this.changed = new Changed(log);

        // Identify the device
        this.addCommandHandler('identify', () => {
            this.log.info(`${CN}Identify device${RI}`);
        });
    }

    // Perform any post-registration setup
    async postRegister(): Promise<void> {
        // Matterbridge incorrectly sets Basic Information cluster attributes
        if (this.serverNode) {
            this.log.info('Patching Basic Information cluster attributes');
            const info = this.options.basicInformation;
            await this.patchBasicInformationClusterServer(this.serverNode, info);
        }
    }

    // Patch the Basic Information cluster attributes with correct values
    async patchBasicInformationClusterServer(
        serverNode: ServerNode,
        info:       BasicInformationOptions
    ): Promise<void> {
        await serverNode.setStateOf(BasicInformationServer, {
            // Mandatory attributes that should already be set correctly:
            //   productId, productName, vendorId, vendorName
            // Mandatory attributes incorrectly set by Matterbridge
            hardwareVersion:        parseOptionalUnsigned(info.hardwareVersion) ?? 0,
            hardwareVersionString:  info.hardwareVersion     ?.substring(0, 64) ?? '?',
            nodeLabel:              info.nodeLabel            .substring(0, 32),
            softwareVersion:        parseOptionalUnsigned(info.softwareVersion) ?? 0,
            softwareVersionString:  info.softwareVersion     ?.substring(0, 64) ?? '?',
            // Optional attributes incorrectly set by Matterbridge
            manufacturingDate:      info.manufacturingDate   ?.substring(0, 16),
            partNumber:             info.partNumber          ?.substring(0, 32),
            productAppearance:      info.productAppearance,
            productLabel:           info.productLabel        ?.substring(0, 64),
            productUrl:             info.productUrl          ?.substring(0, 256),
            serialNumber:           info.serialNumber        ?.substring(0, 32)
        });
    }

    // Create the Bridged Device Basic Information cluster
    createBridgedDeviceBasicInformationClusterServer(info: BasicInformationOptions): this {
        this.behaviors.require(BridgedDeviceBasicInformationServer.enable({
            events: {
                leave:              true,
                reachableChanged:   true
            }
        }), {
            // Mandatory attributes
            reachable:              true,
            uniqueId:               info.uniqueId             .substring(0, 32),
            // Optional attributes
            hardwareVersion:        parseOptionalUnsigned(info.hardwareVersion),
            hardwareVersionString:  info.hardwareVersion     ?.substring(0, 64),
            manufacturingDate:      info.manufacturingDate   ?.substring(0, 16),
            nodeLabel:              info.nodeLabel            .substring(0, 32),
            partNumber:             info.partNumber          ?.substring(0, 32),
            productAppearance:      info.productAppearance,
            productId:              info.productId,
            productLabel:           info.productLabel        ?.substring(0, 64),
            productName:            info.productName          .substring(0, 32),
            productUrl:             info.productUrl          ?.substring(0, 256),
            serialNumber:           info.serialNumber        ?.substring(0, 32),
            softwareVersion:        parseOptionalUnsigned(info.softwareVersion),
            softwareVersionString:  info.softwareVersion     ?.substring(0, 64),
            vendorId:               info.vendorId,
            vendorName:             info.vendorName           .substring(0, 32)
        });
        return this;
    }

    // Update the (Bridged Device) Basic Information cluster attributes
    @ifValueChanged
    async updateReachable(reachable: boolean): Promise<void> {
        this.log.info(`${AN}Reachable${RI}: ${AV}${reachable}${RI}`);
        if (this.serverNode) await this.serverNode.setStateOf(BasicInformationServer,  { reachable });
        else           await this.setStateOf(BridgedDeviceBasicInformationServer, { reachable });
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

// Safely parse a string as an optional unsigned integer
function parseOptionalUnsigned(value?: string): number | undefined {
    const parsed = parseInt(value ?? '', 10);
    return isNaN(parsed) || parsed < 0 ? undefined : parsed;
}