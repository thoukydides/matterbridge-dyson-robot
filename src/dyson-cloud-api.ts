// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import {
    DysonAppPlatform,
    DysonEmailAuthRequest,
    DysonEmailUserStatusRequest,
    DysonEmailUserStatusResponse,
    DysonEmailVerifyRequest,
    DysonEmailVerifyResponse,
    DysonIoTCredentialsRequest,
    DysonIoTCredentialsResponse,
    DysonManifestResponse
} from './dyson-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import { DysonCloudAPIUserAgent } from './dyson-cloud-api-ua.js';

// Dyson cloud API client for all device types
export class DysonCloudAPI {

    // User agent used for all requests
    readonly ua: DysonCloudAPIUserAgent;

    // Construct a new Dyson cloud API client
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly china:     boolean,
        readonly token?:    string
    ) {
        // Create a user agent
        this.ua = new DysonCloudAPIUserAgent(log, config, china);

        // If a token was provided then set the Bearer header
        if (token) this.ua.setBearerToken(token);
    }

    // Retrieve list of supported markets (countries)
    getSupportedMarket(): Promise<string[]> {
        const path = '/v1/supportedmarket';
        return this.ua.request(checkers.DysonSupportedMarketResponse, 'GET', path);
    }

    // Retrieve version (required before login)
    getVersion(platform = DysonAppPlatform.iOS): Promise<string> {
        const path = `/v1/provisioningservice/application/${platform}/version`;
        return this.ua.request(checkers.DysonVersionResponse, 'GET', path);
    }

    // Check the status of a user account
    getUserStatus(email: string): Promise<DysonEmailUserStatusResponse> {
        const body: DysonEmailUserStatusRequest = { email };
        const path = '/v3/userregistration/email/userstatus';
        return this.ua.request(checkers.DysonEmailUserStatusResponse, 'POST', path, body);
    }

    // Start authorisation
    async startAuthorisation(email: string): Promise<string> {
        const body: DysonEmailAuthRequest = { email };
        const path = '/v3/userregistration/email/auth';
        const response = await this.ua.request(checkers.DysonEmailAuthResponse, 'POST', path, body);
        return response.challengeId;
    }

    // Complete authorisation
    async completeAuthorisation(challengeId: string, email: string, otpCode: string, password: string): Promise<DysonEmailVerifyResponse> {
        const body: DysonEmailVerifyRequest = { challengeId, email, otpCode, password };
        const path = '/v3/userregistration/email/verify';
        const response = await this.ua.request(checkers.DysonEmailVerifyResponse, 'POST', path, body);
        this.ua.setBearerToken(response.token);
        return response;
    }

    // Request the list of devices associated with the account
    getManifest(): Promise<DysonManifestResponse> {
        const path = '/v3/manifest';
        return this.ua.request(checkers.DysonManifestResponse, 'GET', path, undefined);
    }

    // Retrieve the AWS IoT credentials for a specific device
    getIoTCredentials(serialNumber: string): Promise<DysonIoTCredentialsResponse> {
        const body: DysonIoTCredentialsRequest = { Serial: serialNumber };
        const path = '/v2/authorize/iot-credentials';
        return this.ua.request(checkers.DysonIoTCredentialsResponse, 'POST', path, body);
    }
}