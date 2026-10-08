// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { DysonCloudAPIUserAgent } from './dyson-cloud-api-ua.js';
import {
    DysonConnectionStatusResponseV1,
    DysonFaultResponseV1,
    DysonFaultResponseV1Permissive,
    DysonIoTCredentialsRequestV2,
    DysonIoTCredentialsResponseV2,
    DysonManifestDeviceV3,
    DysonTimezoneResponseV1,
    DysonUnifiedschedulerEventsResponseV1
} from './dyson-cloud-types.js';
import { CheckerT } from 'ts-interface-checker';
import {
    Dyson360CleanEstimationRequestV2,
    Dyson360CleanEstimationResponseV2,
    Dyson360CleanEstimationZoneV2,
    Dyson360CleanHistoryResponseV1,
    Dyson360CleanMapV1,
    Dyson360FaultResponseV1,
    Dyson360LiveMapCleaningResponseV1,
    Dyson360PersistentMapResponseV2,
    Dyson360PersistentMapResponseV1,
    Dyson360RecommendedCleansResponseV1,
    Dyson360UnifiedschedulerEventsResponseV1,
    Dyson360ZoneBehavioursRequestV1,
    Dyson360PersistentMapMetadataResponseV2,
    Dyson360PersistentMapMetadataResponseV1,
    Dyson360LiveMapMappingResponseV1,
    Dyson360UpdateMapZoneSelectionRequestV2,
    Dyson360PersistentMapMetadataZoneV2,
    Dyson360CleanMapsDataResponseV2
} from './dyson-360-cloud-types.js';
import {
    DysonAirEnvironmentDataDailyResponseV1,
    DysonAirEnvironmentResponseV1,
    DysonAirFaultResponseV1,
    DysonAirUnifiedschedulerEventsResponseV1
} from './dyson-air-cloud-types.js';
import { checkers } from './ti/dyson-cloud-types.js';
import { checkers as checkers360 } from './ti/dyson-360-cloud-types.js';
import { checkers as checkersAir } from './ti/dyson-air-cloud-types.js';
import { Config } from './config-types.js';
import { Dyson360VacuumMode } from './dyson-360-types.js';
import { DysonOwnershipStatus } from './dyson-types.js';
import {
    CountryCode,
    dysonCountryToLocale,
    dysonNormaliseCountry,
    LocaleCode
} from './dyson-locales.js';

// Dyson cloud API client for a single device
export class DysonCloudAPIDevice {

    // User agent used for all requests
    readonly ua:                DysonCloudAPIUserAgent;

    // Interesting information about the device
    readonly serialNumber:      string;
    readonly modelNumber?:      string;
    readonly modelName?:        string;
    readonly mqttRootTopic?:    string;
    readonly firmwareVersion?:  string;

    // Country and language codes
    readonly country:           CountryCode;
    readonly locale:            LocaleCode;

    // Construct a new Dyson cloud API client
    constructor(
        readonly log:           AnsiLogger,
        readonly config:        Config,
        readonly china:         boolean,
        readonly token:         string,
        manifestOrSN:           DysonManifestDeviceV3 | string
    ) {
        // Extract details from the device manifest, if provided
        let productCountryCode: string | undefined;
        if (typeof manifestOrSN === 'string') {
            this.serialNumber       = manifestOrSN;
        } else {
            this.serialNumber       = manifestOrSN.serialNumber;
            this.modelNumber        = manifestOrSN.model;
            this.modelName          = manifestOrSN.productName;
            productCountryCode      = manifestOrSN.countryCode;
            this.mqttRootTopic      = manifestOrSN.connectedConfiguration?.mqtt.mqttRootTopicLevel;
            this.firmwareVersion    = manifestOrSN.connectedConfiguration?.firmware.version;
        }

        // Select country and language codes
        this.country = dysonNormaliseCountry(productCountryCode, china);
        this.locale = dysonCountryToLocale(this.country);

        // Create an authenticated user agent
        this.ua = new DysonCloudAPIUserAgent(log, config, china);
        this.ua.setBearerToken(token);
    }

    // Retrieve the AWS IoT credentials for a specific device
    getIoTCredentialsV2(): Promise<DysonIoTCredentialsResponseV2> {
        const body: DysonIoTCredentialsRequestV2 = { Serial: this.serialNumber };
        const path = '/v2/authorize/iot-credentials';
        return this.ua.postJSON(checkers.DysonIoTCredentialsResponseV2, path, body);
    }

    // Identify the timezone of the device
    getTimezoneV1(): Promise<DysonTimezoneResponseV1> {
        const path = `/v1/machine/${this.serialNumber}/timezone`;
        return this.ua.getJSON(checkers.DysonTimezoneResponseV1, path);
    }

    // Check the registration status of the device
    async getOwnershipV1(): Promise<DysonOwnershipStatus> {
        const path = `/v1/userregistration/ownership?country=${this.country}&serial=${this.serialNumber}`;
        const response = await this.ua.getJSON(checkers.DysonOwnershipResponseV1, path);
        return response.deviceStatus;
    }

    // Retrieve list of scheduled events for the device
    getScheduledEventsV1<Type extends DysonUnifiedschedulerEventsResponseV1>(checker: CheckerT<Type>): Promise<Type> {
        const path = `/v1/unifiedscheduler/${this.serialNumber}/events?productType=${this.mqttRootTopic}`;
        return this.ua.getJSON(checker, path);
    }

    // Retrieve detail for a fault code or all codes
    getFaultDetailsV1<Type extends DysonFaultResponseV1 = DysonFaultResponseV1Permissive>(
        faultCode   = '',
        checker:    CheckerT<Type> = checkers.DysonFaultResponseV1Permissive as unknown as CheckerT<Type>
    ): Promise<Type> {
        const path = `/v1/support/product-faults/${this.serialNumber}?locale=${this.locale}&market=${this.country}&faultCode=${faultCode}`;
        return this.ua.getJSON(checker, path);
    }

    // Check the device's connection status
    getConnectionStatusV1(): Promise<DysonConnectionStatusResponseV1> {
        const path = `/v1/messageprocessor/devices/${this.serialNumber}/connectionstatus`;
        return this.ua.getJSON(checkers.DysonConnectionStatusResponseV1, path);
    }

    // =========================================================================
    // Dyson robot vacuum device API methods...

    // Retrieve list of scheduled events for the device
    getScheduledEvents360V1(): Promise<Dyson360UnifiedschedulerEventsResponseV1> {
        return this.getScheduledEventsV1(checkers360.Dyson360UnifiedschedulerEventsResponseV1);
    }

    // Retrieve the cleaning history for the device (360 Eye only)
    getCleaningHistory360V1(): Promise<Dyson360CleanHistoryResponseV1> {
        const path = `/v1/assets/devices/${this.serialNumber}/cleanhistory?culture=${this.locale}`;
        return this.ua.getJSON(checkers360.Dyson360CleanHistoryResponseV1, path);
    }

    // Retrieve the map image for a specific cleaning session (360 Eye only)
    getMapImage360V1(clean: string): Promise<Buffer> {
        const path = `/v1/mapvisualizer/devices/${this.serialNumber}/map/${clean}`;
        return this.ua.getBinary(path, 'image/png');
    }

    // Retrieve the zone definitions for all persistent maps (360 Vis Nav only)
    getPersistentMapMetadata360V1(): Promise<Dyson360PersistentMapMetadataResponseV1> {
        const path = `/v1/app/${this.serialNumber}/persistent-map-metadata`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapMetadataResponseV1, path);
    }

    // Retrieve the zone definitions for all persistent maps (Spot+Scrub Ai only)
    getPersistentMapMetadata360V2(): Promise<Dyson360PersistentMapMetadataResponseV2> {
        const path = `/v2/app/${this.serialNumber}/persistent-map-metadata`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapMetadataResponseV2, path);
    }

    // Modify the zone definitions for all persistent maps (Spot+Scrub Ai only)
    setPersistentMapMetadata360V2(mapId: string, zones: Dyson360PersistentMapMetadataZoneV2[]): Promise<void> {
        const body: Dyson360UpdateMapZoneSelectionRequestV2 = zones;
        const path = `/v2/app/${this.serialNumber}/persistent-map-metadata/${mapId}`;
        return this.ua.put(path, body);
    }

    // Retrieve the full details of a specific persistent map (360 Vis Nav version)
    getPersistentMap360V1(mapId: string): Promise<Dyson360PersistentMapResponseV1> {
        const path = `/v1/app/${this.serialNumber}/persistent-maps/${mapId}`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapResponseV1, path);
    }

    // Retrieve the full details of a specific persistent map (Spot+Scrub Ai version)
    getPersistentMap360V2(mapId: string): Promise<Dyson360PersistentMapResponseV2> {
        const path = `/v2/app/${this.serialNumber}/persistent-maps/${mapId}`;
        return this.ua.getJSON(checkers360.Dyson360PersistentMapResponseV2, path);
    }

    // Obtain an estimate of the charges and duration for a clean (Spot+Scrub Ai only)
    getCleanEstimation360V2(mapId: string, zones: Dyson360CleanEstimationZoneV2[]): Promise<Dyson360CleanEstimationResponseV2> {
        const body: Dyson360CleanEstimationRequestV2 = { zones };
        const path = `/v2/app/${this.serialNumber}/persistent-maps/${mapId}/clean-estimation`;
        return this.ua.postJSON(checkers360.Dyson360CleanEstimationResponseV2, path, body);
    }

    // Retrieve details of recent cleaning sessions (360 Vis Nav only)
    getCleanMaps360V1(): Promise<Dyson360CleanMapV1[]> {
        const path = `/v1/${this.serialNumber}/clean-maps?dustMap=total`;
        return this.ua.getJSON(checkers360.Dyson360CleanMapsResponseV1, path);
    }

    // Retrieve details of recent cleaning sessions (Spot+Scrub Ai only)
    getCleanMap360V2(cleanId: string): Promise<Dyson360CleanMapsDataResponseV2> {
        const path = `/v2/${this.serialNumber}/clean-maps-data/${cleanId}`;
        return this.ua.getJSON(checkers360.Dyson360CleanMapsDataResponseV2, path);
    }

    // Request details of the recommended clean (360 Vis Nav only)
    getRecommendedCleans360V1(): Promise<Dyson360RecommendedCleansResponseV1> {
        const path = `/v1/app/${this.serialNumber}/recommended-cleans`;
        return this.ua.getJSON(checkers360.Dyson360RecommendedCleansResponseV1, path);
    }

    // Set the cleaning strategy for a single zone (360 Vis Nav only)
    setZoneBehaviour360V1(mapId: string, zoneId: string, cleaningStrategy: Dyson360VacuumMode): Promise<void> {
        const body: Dyson360ZoneBehavioursRequestV1 = { cleaningStrategy };
        const path = `/v1/app/${this.serialNumber}/persistent-maps/${mapId}/zones/${zoneId}/behaviour`;
        return this.ua.put(path, body);
    }

    // Retrieve detail for a fault code or all codes (Spot+Scrub Ai only)
    getFaultDetails360V1(faultCode = ''): Promise<Dyson360FaultResponseV1> {
        return this.getFaultDetailsV1(faultCode, checkers360.Dyson360FaultResponseV1);
    }

    // Retrieve the live map during cleaning (Spot+Scrub Ai only)
    getLiveMapsCleaning360V1(): Promise<Dyson360LiveMapCleaningResponseV1> {
        const path = `/v1/app/${this.serialNumber}/live-maps/cleaning`;
        return this.ua.getJSON(checkers360.Dyson360LiveMapCleaningResponseV1, path);
    }

    // Retrieve the live map during mapping (Spot+Scrub Ai only)
    getLiveMapsMapping360V1(): Promise<Dyson360LiveMapMappingResponseV1> {
        const path = `/v1/app/${this.serialNumber}/live-maps/mapping`;
        return this.ua.getJSON(checkers360.Dyson360LiveMapMappingResponseV1, path);
    }

    // =========================================================================
    // Dyson air treatment device API methods...

    // Retrieve list of scheduled events for the device
    getScheduledEventsAirV1(): Promise<DysonAirUnifiedschedulerEventsResponseV1> {
        return this.getScheduledEventsV1(checkersAir.DysonAirUnifiedschedulerEventsResponseV1);
    }

    // Retrieve current environmental data for the device
    getEnvironmentalDataAirV1(): Promise<DysonAirEnvironmentResponseV1> {
        const path = `/v1/environment/devices/${this.serialNumber}/data?language=${this.locale}`;
        return this.ua.getJSON(checkersAir.DysonAirEnvironmentResponseV1, path);
    }

    // Retrieve daily history of environmental data for the device
    getEnvironmentalDataDailyAirV1(): Promise<DysonAirEnvironmentDataDailyResponseV1> {
        const path = `/v1/messageprocessor/devices/${this.serialNumber}/environmentdata/daily`;
        return this.ua.getJSON(checkersAir.DysonAirEnvironmentDataDailyResponseV1, path);
    }

    // Retrieve detail for a fault code or all codes
    getFaultDetailsAirV1(faultCode = ''): Promise<DysonAirFaultResponseV1> {
        return this.getFaultDetailsV1(faultCode, checkersAir.DysonAirFaultResponseV1);
    }
}