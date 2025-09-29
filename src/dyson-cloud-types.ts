// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

// GET /v1/supportedmarket
export type DysonSupportedMarketResponse = string[]; // Country codes, e.g. 'GB'

// GET /v1/provisioningservice/application/Android/version
// GET /v1/provisioningservice/application/ios/version
export enum DysonAppPlatform {
    iOS                     = 'ios',
    Android                 = 'Android'
}
export type DysonVersionResponse = string;

// POST /v3/userregistration/email/userstatus
export interface DysonEmailUserStatusRequest {
    email:                  string;
}
export enum DysonAccountStatus {
    Unregistered            = 'UNREGISTERED',
    Active                  = 'ACTIVE'
};
export interface DysonEmailUserStatusResponse {
    accountStatus:          DysonAccountStatus;
    authenticationMethod:   'EMAIL_PWD_2FA';
}

// POST /v3/userregistration/email/auth
export interface DysonEmailAuthRequest {
    email:                  string;
}
export interface DysonEmailAuthResponse {
    challengeId:            string; // UUID
}

// POST /v3/userregistration/email/verify
export interface DysonEmailVerifyRequest {
    challengeId:            string; // UUID
    email:                  string;
    otpCode:                string; // 6 digits from email
    password:               string;
}
export interface DysonEmailVerifyResponse {
    account:                string; // UUID
    token:                  string; // 64 hex digits plus '-1'
    tokenType:              'Bearer';
}

// GET /v3/manifest
export enum DysonManifestCategory {
    AirTreatment            = 'ec',
    FloorCare               = 'flrc',
    HairCare                = 'hc',
    Light                   = 'light',
    RobotVacuum             = 'robot',
    Wearable                = 'wearable'
}
export enum DysonManifestCapability {
    AdvanceOscillation      = 'AdvanceOscillationDay1',
    ChangeWiFi              = 'ChangeWifi',
    DirectedCleaning        = 'DirectedCleaning',
    EnvironmentalData       = 'EnvironmentalData',
    ExtendedAQ              = 'ExtendedAQ',
    Mapping                 = 'Mapping',
    MidCleanConfiguration   = 'MidCleanConfiguration',
    Restrictions            = 'Restrictions',
    Scheduling              = 'Scheduling'
};
export interface DysonManifestFirmware {
    autoUpdateEnabled:      boolean;
    newVersionAvailable:    boolean;
    minimumAppVersion:      string | null;
    capabilities:           DysonManifestCapability[] | null;
    version:                string;
}
export interface DysonManifestMQTT {
    localBrokerCredentials: string; // 192 characters (144 bytes base64 encoded)
    mqttRootTopicLevel:     string; // e.g. 'N223' or '475'
    remoteBrokerType:       'wss';
}
export interface DysonManifestConnectedConfiguration {
    firmware:               DysonManifestFirmware;
    mqtt:                   DysonManifestMQTT;
}
export enum DysonManifestConnectionCategory {
    BTWiFi                  = 'lecAndWifi',
    BT                      = 'lecOnly',
    NotConnected            = 'nonConnected',
    WiFi                    = 'wifiOnly'
}
export interface DysonManifestDevice {
    category:               DysonManifestCategory;
    connectedConfiguration: DysonManifestConnectedConfiguration | null;
    connectionCategory:     DysonManifestConnectionCategory;
    model:                  string; // e.g. 'RB01' or 'TP02'
    name:                   string | null; // User assigned name
    productName:            string; // e.g. 'Dyson 360 Eye' or 'Dyson Pure Cool™ Link'
    serialNumber:           string; // e.g. 'AB1-CD-EFG2345H'
    type:                   string; // e.g. 'N223' or '475'
    variant:                string | null;
}
export type DysonManifestResponse = DysonManifestDevice[];

// Decoded localBrokerCredentials
export interface DysonLocalBrokerCredentials {
    serial:         string;
    apPasswordHash: string; // 88 characters (64 bytes base64 encoded)
}

// POST /v2/authorize/iot-credentials
export interface DysonIoTCredentialsRequest {
    Serial:                 string;
}
export interface DysonIoTCredentials {
    ClientId:               string; // UUID
    CustomAuthorizerName:   string; // e.g. 'cld-iot-credentials-lambda-authorizer'
    TokenKey:               'token';
    TokenSignature:         string; // 344 characters (256 bytes base64 encoded)
    TokenValue:             string; // UUID (same as ClientId)
}
export interface DysonIoTCredentialsResponse {
    Endpoint:               string; // e.g. 'a1u2wvl3e2lrc4-ats.iot.eu-west-1.amazonaws.com'
    IoTCredentials:         DysonIoTCredentials;
}