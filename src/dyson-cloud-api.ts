// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    DysonAppPlatform,
    DysonEmailAuthRequest,
    DysonEmailUserStatusRequest,
    DysonEmailUserStatusResponse,
    DysonEmailVerifyRequest,
    DysonEmailVerifyResponse,
    DysonManifestResponse
} from './dyson-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import { DysonCloudAPIUserAgent } from './dyson-cloud-api-ua.js';
import { DysonCloudAPIDevice } from './dyson-cloud-api-device.js';
import { assertIsDefined } from './utils.js';

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
    getSupportedMarket(): Promise<string[]> {
        const path = '/v1/supportedmarket';
        return this.ua.getJSON(checkers.DysonSupportedMarketResponse, path);
    }

    // Retrieve version (required before login)
    getVersion(platform = DysonAppPlatform.iOS): Promise<string> {
        const path = `/v1/provisioningservice/application/${platform}/version`;
        return this.ua.getJSON(checkers.DysonVersionResponse, path);
    }

    // Check the status of a user account
    getUserStatus(email: string): Promise<DysonEmailUserStatusResponse> {
        const body: DysonEmailUserStatusRequest = { email };
        const path = '/v3/userregistration/email/userstatus';
        return this.ua.postJSON(checkers.DysonEmailUserStatusResponse, path, body);
    }

    // Start authorisation
    async startAuthorisation(email: string): Promise<string> {
        const body: DysonEmailAuthRequest = { email };
        const path = '/v3/userregistration/email/auth';
        const response = await this.ua.postJSON(checkers.DysonEmailAuthResponse, path, body);
        return response.challengeId;
    }

    // Complete authorisation
    async completeAuthorisation(challengeId: string, email: string, otpCode: string, password: string): Promise<DysonEmailVerifyResponse> {
        const body: DysonEmailVerifyRequest = { challengeId, email, otpCode, password };
        const path = '/v3/userregistration/email/verify';
        const response = await this.ua.postJSON(checkers.DysonEmailVerifyResponse, path, body);
        this.token = response.token;
        this.ua.setBearerToken(response.token);
        return response;
    }

    // Request the list of devices associated with the account
    getManifest(): Promise<DysonManifestResponse> {
        const path = '/v3/manifest';
        return this.ua.getJSON(checkers.DysonManifestResponse, path);
    }

    // Create a device-specific cloud API client
    createDeviceClient(log: AnsiLogger, serialNumber: string, rootTopic: string): DysonCloudAPIDevice {
        assertIsDefined(this.token);
        return new DysonCloudAPIDevice(log, this.config, this.china, this.token, serialNumber, rootTopic);
    }
}