// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    DysonEmailAuthRequestV3,
    DysonEmailUserStatusRequestV3,
    DysonEmailUserStatusResponseV3,
    DysonEmailVerifyRequestV3,
    DysonEmailVerifyResponseV3,
    DysonManifestDeviceV3,
    DysonManifestResponseV3
} from './dyson-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import { DysonCloudAPIUserAgent } from './dyson-cloud-api-ua.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { assertIsDefined } from './utils.js';
import { DysonAppPlatform } from './dyson-types.js';

// Dyson cloud API client for all device types
export class DysonCloudAPI {

    // User agent used for all requests
    readonly ua: DysonCloudAPIUserAgent;

    // Construct a new Dyson cloud API client
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly china:     boolean,
        public   token?:    string
    ) {
        // Create a user agent
        this.ua = new DysonCloudAPIUserAgent(log, config, china);

        // If a token was provided then set the Bearer header
        if (token) this.ua.setBearerToken(token);
    }

    // Retrieve list of supported markets (countries)
    getSupportedMarketV1(): Promise<string[]> {
        const path = '/v1/supportedmarket';
        return this.ua.getJSON(checkers.DysonSupportedMarketResponseV1, path);
    }

    // Retrieve version (required before login)
    getVersionV1(platform = DysonAppPlatform.iOS): Promise<string> {
        const path = `/v1/provisioningservice/application/${platform}/version`;
        return this.ua.getJSON(checkers.DysonVersionResponseV1, path);
    }

    // Check the status of a user account
    getUserStatusV3(email: string): Promise<DysonEmailUserStatusResponseV3> {
        const body: DysonEmailUserStatusRequestV3 = { email };
        const path = '/v3/userregistration/email/userstatus';
        return this.ua.postJSON(checkers.DysonEmailUserStatusResponseV3, path, body);
    }

    // Start authorisation
    async startAuthorisationV3(email: string): Promise<string> {
        const body: DysonEmailAuthRequestV3 = { email };
        const path = '/v3/userregistration/email/auth';
        const response = await this.ua.postJSON(checkers.DysonEmailAuthResponseV3, path, body);
        return response.challengeId;
    }

    // Complete authorisation
    async completeAuthorisationV3(
        challengeId: string, email: string, otpCode: string, password: string
    ): Promise<DysonEmailVerifyResponseV3> {
        const body: DysonEmailVerifyRequestV3 = { challengeId, email, otpCode, password };
        const path = '/v3/userregistration/email/verify';
        const response = await this.ua.postJSON(checkers.DysonEmailVerifyResponseV3, path, body);
        this.token = response.token;
        this.ua.setBearerToken(response.token);
        return response;
    }

    // Request the list of devices associated with the account
    getManifestV3(): Promise<DysonManifestResponseV3> {
        const path = '/v3/manifest';
        return this.ua.getJSON(checkers.DysonManifestResponseV3, path);
    }

    // Create a device-specific cloud API client
    createDeviceClient(log: AnsiLogger, manifest: DysonManifestDeviceV3): DysonCloudAPIDevice {
        assertIsDefined(this.token);
        return new DysonCloudAPIDevice(log, this.config, this.china, this.token, manifest);
    }
}