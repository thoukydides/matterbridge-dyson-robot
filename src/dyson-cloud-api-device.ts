// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonCloudAPIUserAgent } from './dyson-cloud-api-ua.js';
import {
    DysonIoTCredentialsRequest,
    DysonIoTCredentialsResponse,
    DysonOwnershipStatus,
    DysonTimezoneResponse,
    DysonUnifiedschedulerEventsResponse
} from './dyson-cloud-types.js';
import { CheckerT } from 'ts-interface-checker';
import {
    Dyson360CleanHistoryResponse,
    Dyson360CleanMap,
    Dyson360PersistentMapMetadata,
    Dyson360PersistentMapResponse,
    Dyson360RecommendedCleansResponse,
    Dyson360UnifiedschedulerEventsResponse,
    Dyson360ZoneBehavioursRequest
} from './dyson-360-cloud-types.js';
import {
    DysonAirEnvironmentDataDailyResponse,
    DysonAirEnvironmentResponse,
    DysonAirUnifiedschedulerEventsResponse
} from './dyson-air-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import { checkers as checkers360 } from './ti/dyson-360-cloud-types.js';
import { checkers as checkersAir } from './ti/dyson-air-cloud-types.js';
import { Config } from './config-types.js';
import { Dyson360CleaningStrategy } from './dyson-360-types.js';

// Default locale
const DEFAULT_COUNTRY   = 'GB';
const DEFAULT_LANGUAGE  = 'en-GB';

// Dyson cloud API client for a single device
export class DysonCloudAPIDevice {

    // User agent used for all requests
    readonly ua: DysonCloudAPIUserAgent;

    // Construct a new Dyson cloud API client
    constructor(
        readonly log:           AnsiLogger,
        readonly config:        Config,
        readonly china:         boolean,
        readonly token:         string,
        readonly serialNumber:  string,
        readonly rootTopic:     string
    ) {
        // Create an authenticated user agent
        this.ua = new DysonCloudAPIUserAgent(log, config, china);
        this.ua.setBearerToken(token);
    }

    // Retrieve the AWS IoT credentials for a specific device
    getIoTCredentials(): Promise<DysonIoTCredentialsResponse> {
        const body: DysonIoTCredentialsRequest = { Serial: this.serialNumber };
        const path = '/v2/authorize/iot-credentials';
        return this.ua.postJSON(checkers.DysonIoTCredentialsResponse, path, body);
    }

    // Identify the timezone of the device
    getTimezone(): Promise<DysonTimezoneResponse> {
        const path = `/v1/machine/${this.serialNumber}/timezone`;
        return this.ua.getJSON(checkers.DysonTimezoneResponse, path);
    }

    // Check the registration status of the device
    async getOwnership(countryCode = DEFAULT_COUNTRY): Promise<DysonOwnershipStatus> {
        const path = `/v1/userregistration/ownership?country=${countryCode}&serial=${this.serialNumber}`;
        const response = await this.ua.getJSON(checkers.DysonOwnershipResponse, path);
        return response.deviceStatus;
    }

    // Retrieve list of scheduled events for the device
    getScheduledEvents<Type extends DysonUnifiedschedulerEventsResponse>(checker: CheckerT<Type>): Promise<Type> {
        const path = `/v1/unifiedscheduler/${this.serialNumber}/events?productType=${this.rootTopic}`;
        return this.ua.getJSON(checker, path);
    }

    // =========================================================================
    // Dyson robot vacuum device API methods...

    // Retrieve list of scheduled events for the device
    getScheduledEvents360(): Promise<Dyson360UnifiedschedulerEventsResponse> {
        return this.getScheduledEvents(checkers360.Dyson360UnifiedschedulerEventsResponse);
    }

    // Retrieve the cleaning history for the device (360 Eye only)
    getCleaningHistory360(languageCode = DEFAULT_LANGUAGE): Promise<Dyson360CleanHistoryResponse> {
        const path = `/v1/assets/devices/{serial}/cleanhistory?culture=${languageCode}`;
        return this.ua.getJSON(checkers360.Dyson360CleanHistoryResponse, path);
    }

    // Retrieve the map image for a specific cleaning session (360 Eye only)
    getMapImage360(mapId: string): Promise<Buffer> {
        const path = `/v1/mapvisualizer/devices/${this.serialNumber}/map/${mapId}`;
        return this.ua.getBinary(path, 'image/png');
    }

    // Retrieve the zone definitions for all persistent maps (360 Vis Nav only)
    getPersistentMapMetadata360(): Promise<Dyson360PersistentMapMetadata[]> {
        const path = `/v1/app/${this.serialNumber}/persistent-map-metadata`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapMetadataResponse, path);
    }

    // Retrieve the full details of a specific persistent map (360 Vis Nav only)
    getPersistentMap360(mapId: string): Promise<Dyson360PersistentMapResponse> {
        const path = `/v1/app/${this.serialNumber}/persistent-maps/${mapId}`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapResponse, path);
    }

    // Retrieve details of recent cleaning sessions (360 Vis Nav only)
    getCleanMaps360(): Promise<Dyson360CleanMap[]> {
        const path = `/v1/${this.serialNumber}/clean-maps?dustMap=total`;
        return this.ua.getJSON(checkers360.Dyson360CleanMapsResponse, path);
    }

    // Request details of the recommended clean (360 Vis Nav only)
    getRecommendedCleans360(): Promise<Dyson360RecommendedCleansResponse> {
        const path = `/v1/app/${this.serialNumber}/recommended-cleans`;
        return this.ua.getJSON(checkers360.Dyson360RecommendedCleansResponse, path);
    }

    // Set the cleaning strategy for a single zone (360 Vis Nav only)
    setZoneBehaviour360(mapId: string, zoneId: string, cleaningStrategy: Dyson360CleaningStrategy): Promise<void> {
        const body: Dyson360ZoneBehavioursRequest = { cleaningStrategy };
        const path = `/v1/app/${this.serialNumber}/persistent-maps/${mapId}/zones/${zoneId}/behaviour`;
        return this.ua.put(path, body);
    }

    // =========================================================================
    // Dyson air treatment device API methods...

    // Retrieve list of scheduled events for the device
    getScheduledEventsAir(): Promise<DysonAirUnifiedschedulerEventsResponse> {
        return this.getScheduledEvents(checkersAir.DysonAirUnifiedschedulerEventsResponse);
    }

    // Retrieve current environmental data for the device
    getEnvironmentalDataAir(languageCode = DEFAULT_LANGUAGE): Promise<DysonAirEnvironmentResponse> {
        const path = `/v1/environment/devices/${this.serialNumber}/data?language=${languageCode}`;
        return this.ua.getJSON(checkersAir.DysonAirEnvironmentResponse, path);
    }

    // Retrieve daily history of environmental data for the device
    getEnvironmentalDataDailyAir(): Promise<DysonAirEnvironmentDataDailyResponse> {
        const path = `/v1/messageprocessor/devices/${this.serialNumber}/environmentdata/daily`;
        return this.ua.getJSON(checkersAir.DysonAirEnvironmentDataDailyResponse, path);
    }
}