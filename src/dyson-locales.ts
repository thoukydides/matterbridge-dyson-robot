// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { DysonCountryCode } from './dyson-types.js';

// Country codes
export type CountryCode = Uppercase<string>;
export type LocaleCode<C extends CountryCode = CountryCode> = `${Lowercase<string>}-${C}`;

// Locale (culture) to use for each country returned by GET /v1/supportedmarket
const COUNTRY_LOCALE_MAP: Partial<Record<CountryCode, LocaleCode>> = {
    // Europe
    AT: 'de-AT',    // Austria
    BA: 'bs-BA',    // Bosnia and Herzegovina
    BE: 'nl-BE',    // Belgium (Dutch) - alternatively fr-BE (French)
    BG: 'bg-BG',    // Bulgaria
    CH: 'de-CH',    // Switzerland (German) - alternatively fr-CH (French) or it-CH (Italian)
    CY: 'el-CY',    // Cyprus
    CZ: 'cs-CZ',    // Czech Republic
    DE: 'de-DE',    // Germany
    DK: 'da-DK',    // Denmark
    EE: 'et-EE',    // Estonia
    ES: 'es-ES',    // Spain
    FI: 'fi-FI',    // Finland
    FR: 'fr-FR',    // France
    GB: 'en-GB',    // United Kingdom
    GE: 'ka-GE',    // Georgia
    GR: 'el-GR',    // Greece
    HR: 'hr-HR',    // Croatia
    HU: 'hu-HU',    // Hungary
    IE: 'en-IE',    // Ireland
    IT: 'it-IT',    // Italy
    LT: 'lt-LT',    // Lithuania
    LV: 'lv-LV',    // Latvia
    MT: 'mt-MT',    // Malta
    NL: 'nl-NL',    // Netherlands
    NO: 'no-NO',    // Norway (Norwegian) - alternatively nb-NO (Bokmål)
    PL: 'pl-PL',    // Poland
    PT: 'pt-PT',    // Portugal
    RO: 'ro-RO',    // Romania
    RS: 'sr-RS',    // Serbia
    SE: 'sv-SE',    // Sweden
    SI: 'sl-SI',    // Slovenia
    SK: 'sk-SK',    // Slovakia
    TR: 'tr-TR',    // Turkey
    // Americas
    BR: 'pt-BR',    // Brazil
    CA: 'en-CA',    // Canada (English) - alternatively fr-CA (French)
    CL: 'es-CL',    // Chile
    CO: 'es-CO',    // Colombia
    MX: 'es-MX',    // Mexico
    PE: 'es-PE',    // Peru
    US: 'en-US',    // United States
    // Asia & Pacific
    AU: 'en-AU',    // Australia
    CN: 'zh-CN',    // China
    HK: 'zh-HK',    // Hong Kong
    ID: 'id-ID',    // Indonesia
    IN: 'hi-IN',    // India (Hindi)
    JP: 'ja-JP',    // Japan
    KR: 'ko-KR',    // South Korea
    MY: 'ms-MY',    // Malaysia
    NZ: 'en-NZ',    // New Zealand
    PH: 'fil-PH',   // Philippines (Filipino/Tagalog)
    SG: 'en-SG',    // Singapore
    TH: 'th-TH',    // Thailand
    TW: 'zh-TW',    // Taiwan
    VN: 'vi-VN',    // Vietnam
    // Middle East & Africa
    AE: 'ar-AE',    // United Arab Emirates
    BH: 'ar-BH',    // Bahrain
    DZ: 'ar-DZ',    // Algeria
    EG: 'ar-EG',    // Egypt
    IL: 'he-IL',    // Israel
    KW: 'ar-KW',    // Kuwait
    LB: 'ar-LB',    // Lebanon
    MA: 'ar-MA',    // Morocco
    OM: 'ar-OM',    // Oman
    QA: 'ar-QA',    // Qatar
    SA: 'ar-SA',    // Saudi Arabia
    TN: 'ar-TN',    // Tunisia
    ZA: 'en-ZA',    // South Africa
    // Central Asia
    KZ: 'kk-KZ'     // Kazakhstan (Kazakh)
} satisfies { [key in DysonCountryCode]: LocaleCode<key>; };

// Normalise a country code
export function dysonNormaliseCountry(country?: string, china?: boolean): CountryCode {
    country ??= china ? 'CN' : 'GB';

    // HERE - Also need to do something with 'EU'...
    if (country.length !== 2 || country === 'UK') country = 'GB';
    return country.toUpperCase() as CountryCode;
}

// Map a country code to a suitable locale
export function dysonCountryToLocale(country: CountryCode): LocaleCode {
    return COUNTRY_LOCALE_MAP[country] ?? 'en-GB';
}