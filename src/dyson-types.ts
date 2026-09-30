// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

// Common base for all Dyson MQTT payloads
export interface DysonMsg {
    msg:                    string;
    time?:                  string; // e.g. '2025-04-28T12:33:27.003Z'
}

// Dyson mode reason
export enum DysonModeReason {
    Unknown                 = '',
    LocalApp                = 'LAPP',
    LocalSchedule           = 'LSCH',
    RemoteApp               = 'RAPP',
    Preconditioning         = 'PRC',
    PhysicalUserInteraction = 'PUI',
    None                    = 'NONE'
}

// Dyson state reason
export enum DysonStateReason {
    Environment             = 'ENV',
    FLT                     = 'FLT',
    Mode                    = 'MODE',
    None                    = 'NONE'
}

// Dyson app platform
export enum DysonAppPlatform {
    iOS                     = 'ios',
    Android                 = 'Android'
}

// Dyson account registration status
export enum DysonAccountStatus {
    Unregistered            = 'UNREGISTERED',
    Active                  = 'ACTIVE'
};

// Dyson device registration status
export enum DysonOwnershipStatus {
    Registered              = 'REGISTERED_TO_THIS_ACCOUNT',
    Unregistered            = 'DEVICE_UNREGISTERED'
}

// Country codes (as returned by GET /v1/supportedmarket)
// (Subset of ISO 3166-1)
export type DysonCountryCode =
    'AE' | 'AT' | 'AU' | 'BA' | 'BE' | 'BG' | 'BH' | 'BR' | 'CA' | 'CH' | 'CL'
  | 'CN' | 'CO' | 'CY' | 'CZ' | 'DE' | 'DK' | 'DZ' | 'EE' | 'EG' | 'ES' | 'FI'
  | 'FR' | 'GB' | 'GE' | 'GR' | 'HK' | 'HR' | 'HU' | 'ID' | 'IE' | 'IL' | 'IN'
  | 'IT' | 'JP' | 'KR' | 'KW' | 'KZ' | 'LB' | 'LT' | 'LV' | 'MA' | 'MT' | 'MX'
  | 'MY' | 'NL' | 'NO' | 'NZ' | 'OM' | 'PE' | 'PH' | 'PL' | 'PT' | 'QA' | 'RO'
  | 'RS' | 'RU' | 'SA' | 'SE' | 'SG' | 'SI' | 'SK' | 'TH' | 'TN' | 'TR' | 'TW'
  | 'US' | 'VN' | 'ZA';

// Country codes associated with Dyson products
export type DysonCountryCodeExceptionallyReserved =
    // (ISO 3166-1 also reserves: AC CP CQ DG EA EZ FX IC SU TA UN)
    'UK' | 'EU';
export type DysonCountryCodeUserAssigned =
    // (only XB XC XD XE XF XG XH XJ XK XX currently used)
    'AA' | 'QM' | 'QN' | 'QO' | 'QP' | 'QQ' | 'QR' | 'QS' | 'QT' | 'QU' | 'QV'
  | 'QW' | 'QX' | 'QY' | 'QZ' | 'XA' | 'XB' | 'XC' | 'XD' | 'XE' | 'XF' | 'XG'
  | 'XH' | 'XI' | 'XJ' | 'XK' | 'XL' | 'XM' | 'XN' | 'XO' | 'XP' | 'XQ' | 'XR'
  | 'XS' | 'XT' | 'XU' | 'XV' | 'XW' | 'XX' | 'XY' | 'XZ' | 'ZZ';
export type DysonProductCountryCode =
    DysonCountryCode | DysonCountryCodeExceptionallyReserved | DysonCountryCodeUserAssigned;