// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    DysonAccountStatus,
    DysonCountryCodeExpanded,
    DysonCountryCode,
    DysonOwnershipStatus
} from './dyson-types.js';

// GET /v1/supportedmarket
export type DysonSupportedMarketResponseV1 = DysonCountryCode[]; // Country codes, e.g. 'GB'

// GET /v1/provisioningservice/application/Android/version
// GET /v1/provisioningservice/application/ios/version
export type DysonVersionResponseV1 = string;

// POST /v3/userregistration/email/userstatus
export interface DysonEmailUserStatusRequestV3 {
    email:                      string;
}
export interface DysonEmailUserStatusResponseV3 {
    accountStatus:              DysonAccountStatus;
    authenticationMethod:       'EMAIL_PWD_2FA';
}

// POST /v3/userregistration/email/auth
export interface DysonEmailAuthRequestV3 {
    email:                      string;
}
export interface DysonEmailAuthResponseV3 {
    challengeId:                string;         // UUID
}

// POST /v3/userregistration/email/verify
export interface DysonEmailVerifyRequestV3 {
    challengeId:                string;         // UUID
    email:                      string;
    otpCode:                    string;         // 6 digits from email
    password:                   string;
}
export interface DysonEmailVerifyResponseV3 {
    account:                    string;         // UUID
    token:                      string;         // 64 hex digits plus '-1'
    tokenType:                  'Bearer';
}

// GET /v3/manifest
export enum DysonManifestCategory {
    AirTreatment                = 'ec',
    FloorCare                   = 'flrc',
    HairCare                    = 'hc',
    Light                       = 'light',
    RobotVacuum                 = 'robot',
    Wearable                    = 'wearable'
}
export enum DysonManifestCapability {
    ActiveFaults                = 'ActiveFaults',
    AdvanceOscillation          = 'AdvanceOscillationDay1',
    AgeAdjust                   = 'AgeAdjust',
    Baseline                    = 'Baseline',
    ChangeWiFi                  = 'ChangeWifi',
    ChildLock                   = 'ChildLock',
    CleaningStrategies          = 'CleaningStrategies',
    Daylight                    = 'Daylight',
    DelayedDryingDuration       = 'DelayedDryingDuration',
    DirectedCleaning            = 'DirectedCleaning',
    DoNotDisturbMode            = 'DoNotDisturbMode',
    DST                         = 'DST',
    DustDetection               = 'DustDetection',
    EnvironmentalData           = 'EnvironmentalData',
    ExtendedAQ                  = 'ExtendedAQ',
    HydrationVeryLowLevel       = 'HydrationVeryLowLevel',
    InteractiveDemo             = 'InteractiveDemo',
    Mapping                     = 'Mapping',
    Matter                      = 'Matter',
    MidCleanConfiguration       = 'MidCleanConfiguration',
    MultipleEventsScheduling    = 'MultipleEventsScheduling',
    OutOfBoxState               = 'OutOfBoxState',
    PersonalDaylight            = 'PersonalDaylight',
    ReadyOffDock                = 'ReadyOffDock',
    Restrictions                = 'Restrictions',
    Scheduling                  = 'Scheduling'
};
export interface DysonManifestFirmware {
    autoUpdateEnabled:          boolean;
    newVersionAvailable:        boolean;
    minimumAppVersion:          string | null;
    capabilities:               DysonManifestCapability[] | null;
    version:                    string;
}
export interface DysonManifestMQTT {
    localBrokerCredentials:     string | null; // 192 characters (144 bytes base64 encoded)
    mqttRootTopicLevel:         string; // e.g. 'N223' or '475'
    remoteBrokerType:           'wss';
}
export interface DysonManifestConnectedConfiguration {
    firmware:                   DysonManifestFirmware;
    mqtt:                       DysonManifestMQTT;
}
export enum DysonManifestConnectionCategory {
    BTWiFi                      = 'lecAndWifi',
    BT                          = 'lecOnly',
    NotConnected                = 'nonConnected',
    WiFi                        = 'wifiOnly'
}
export interface DysonManifestDeviceV3 {
    category:                   DysonManifestCategory;
    connectedConfiguration:     DysonManifestConnectedConfiguration | null;
    connectionCategory:         DysonManifestConnectionCategory;
    countryCode?:               DysonCountryCodeExpanded;
    model:                      string;             // e.g. 'RB01' or 'TP02'
    name:                       string | null;      // User assigned name
    productName:                string;             // e.g. 'Dyson 360 Eye' or 'Dyson Pure Cool™ Link'
    serialNumber:               string;             // e.g. 'AB1-CD-EFG2345H'
    type:                       string;             // e.g. 'N223' or '475'
    variant:                    string | null;
}
export type DysonManifestResponseV3 = DysonManifestDeviceV3[];

// Decoded localBrokerCredentials
export interface DysonLocalBrokerCredentials {
    serial:                     string;
    apPasswordHash:             string;             // 88 characters (64 bytes base64 encoded)
}

// POST /v2/authorize/iot-credentials
export interface DysonIoTCredentialsRequestV2 {
    Serial:                     string;
}
export interface DysonIoTCredentialsV2 {
    ClientId:                   string;             // UUID
    CustomAuthorizerName:       string;             // e.g. 'cld-iot-credentials-lambda-authorizer'
    TokenKey:                   'token';
    TokenSignature:             string;             // 344 characters (256 bytes base64 encoded)
    TokenValue:                 string;             // UUID (same as ClientId)
}
export interface DysonIoTCredentialsResponseV2 {
    Endpoint:                   string;             // e.g. 'a1u2wvl3e2lrc4-ats.iot.eu-west-1.amazonaws.com'
    IoTCredentials:             DysonIoTCredentialsV2;
}

// GET /v1/machine/{serial}/timezone
export interface DysonTimezoneResponseV1 {
    timezone:                   string;             // e.g. 'Europe/London'
}

// GET /v1/userregistration/ownership?country={countrycode}&serial={serial}
export interface DysonOwnershipResponseV1 {
    deviceStatus:               DysonOwnershipStatus;
}

// GET /v1/unifiedscheduler/{serial}/events?productType={mqttroottopic}
export interface DysonUnifiedschedulerEvent {
    days:                       number[];
    enabled:                    boolean;
    groupId:                    number;
    settings:                   unknown;
    startTime:                  string;             // e.g. '09:00' or '20:00:00'
    weeklyRepeat:               boolean;
}
export interface DysonUnifiedschedulerEventsResponseV1 {
    enabled:                    boolean;
    events:                     DysonUnifiedschedulerEvent[];
    serial:                     string;
}

// GET /v1/messageprocessor/devices/{serial}/connectionstatus
export interface DysonConnectionStatusResponseV1 {
    BrokerHostName:             string | null;
    BrokerPort:                 number;
    LastChanged:                string;             // e.g. '1970-01-01T00:00:00.001Z'
    Status:                     'connected';
}