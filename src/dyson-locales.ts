// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { DysonCountryCode, DysonCountryCodeExpanded } from './dyson-types.js';

// Country codes
export type CountryCode = Uppercase<string>;
export type LocaleCode<C extends CountryCode = CountryCode> = `${Lowercase<string>}-${C}`;

// Mapping of known non country codes to valid codes
const COUNTRY_CODE_REMAP: Record<CountryCode, CountryCode | undefined> = {
    UK: 'GB',       // Use Great Britain to represent the United Kingdom
    EU: 'IE'        // Use Ireland to represent the European Union
} satisfies Record<Exclude<DysonCountryCodeExpanded, DysonCountryCode>, CountryCode>;

// Locale (culture) to use for each country returned by GET /v1/supportedmarket
const COUNTRY_LOCALE_MAP: Record<CountryCode, LocaleCode | undefined> = {
    // Europe
    AT: 'de-AT',    // Austria                      German
    BA: 'bs-BA',    // Bosnia and Herzegovina       Bosnian
    BE: 'nl-BE',    // Belgium                      Dutch
    BG: 'bg-BG',    // Bulgaria                     Bulgarian
    CH: 'de-CH',    // Switzerland                  German          [or fr-CH/it-CH]
    CY: 'el-CY',    // Cyprus                       Greek
    CZ: 'cs-CZ',    // Czech Republic               Czech
    DE: 'de-DE',    // Germany                      German
    DK: 'da-DK',    // Denmark                      Danish
    EE: 'et-EE',    // Estonia                      Estonian
    ES: 'es-ES',    // Spain                        Spanish
    FI: 'fi-FI',    // Finland                      Finnish
    FR: 'fr-FR',    // France                       French
    GB: 'en-GB',    // United Kingdom               English
    GE: 'ka-GE',    // Georgia                      Georgian
    GR: 'el-GR',    // Greece                       Greek
    HR: 'hr-HR',    // Croatia                      Croatian
    HU: 'hu-HU',    // Hungary                      Hungarian
    IE: 'en-IE',    // Ireland                      English
    IT: 'it-IT',    // Italy                        Italian
    LT: 'lt-LT',    // Lithuania                    Lithuanian
    LV: 'lv-LV',    // Latvia                       Latvian
    MT: 'mt-MT',    // Malta                        Maltese
    NL: 'nl-NL',    // Netherlands                  Dutch
    NO: 'no-NO',    // Norway                       Norwegian       [or nn-NO/nb-NO]
    PL: 'pl-PL',    // Poland                       Polish
    PT: 'pt-PT',    // Portugal                     Portuguese
    RO: 'ro-RO',    // Romania                      Romanian
    RS: 'sr-RS',    // Serbia                       Serbian
    SE: 'sv-SE',    // Sweden                       Swedish
    SI: 'sl-SI',    // Slovenia                     Slovenian
    SK: 'sk-SK',    // Slovakia                     Slovak
    TR: 'tr-TR',    // Turkey                       Turkish
    // Americas
    BR: 'pt-BR',    // Brazil                       Portuguese
    CA: 'en-CA',    // Canada                       English         [or fr-CA]
    CL: 'es-CL',    // Chile                        Spanish
    CO: 'es-CO',    // Colombia                     Spanish
    MX: 'es-MX',    // Mexico                       Spanish
    PE: 'es-PE',    // Peru                         Spanish
    US: 'en-US',    // United States                English
    // Asia & Pacific
    AU: 'en-AU',    // Australia                    English
    CN: 'zh-CN',    // People's Republic of China   Chinese (Simplified)
    HK: 'zh-HK',    // Hong Kong                    Chinese (Simplified)
    ID: 'id-ID',    // Indonesia                    Indonesian
    IN: 'hi-IN',    // India                        Hindi
    JP: 'ja-JP',    // Japan                        Japanese
    KR: 'ko-KR',    // South Korea                  Korean
    MY: 'ms-MY',    // Malaysia                     Malay
    NZ: 'en-NZ',    // New Zealand                  English
    PH: 'fil-PH',   // Philippines                  Filipino
    SG: 'en-SG',    // Singapore                    English
    TH: 'th-TH',    // Thailand                     Thai
    TW: 'zh-TW',    // Taiwan                       Chinese (Simplified)
    VN: 'vi-VN',    // Vietnam                      Vietnamese
    // Middle East & Africa
    AE: 'ar-AE',    // United Arab Emirates         Arabic
    BH: 'ar-BH',    // Bahrain                      Arabic
    DZ: 'ar-DZ',    // Algeria                      Arabic
    EG: 'ar-EG',    // Egypt                        Arabic
    IL: 'he-IL',    // Israel                       Hebrew
    KW: 'ar-KW',    // Kuwait                       Arabic
    LB: 'ar-LB',    // Lebanon                      Arabic
    MA: 'ar-MA',    // Morocco                      Arabic
    OM: 'ar-OM',    // Oman                         Arabic
    QA: 'ar-QA',    // Qatar                        Arabic
    SA: 'ar-SA',    // Saudi Arabia                 Arabic
    TN: 'ar-TN',    // Tunisia                      Arabic
    ZA: 'en-ZA',    // South Africa                 English
    // Central Asia
    KZ: 'kk-KZ'     // Kazakhstan                   Kazakh
} satisfies { [key in DysonCountryCode]: LocaleCode<key>; };

// Normalise a country code
export function dysonNormaliseCountry(country?: string, china?: boolean): CountryCode {
    // Use server location if no country specified
    if (!country || !isCountryCode(country)) return china ? 'CN' : 'GB';

    // Fix known invalid country codes
    const remapped = COUNTRY_CODE_REMAP[country];
    if (remapped) return remapped;

    // Anything else resembling a country code is used as-is
    return country;
}

// Map a country code to a suitable locale
export function dysonCountryToLocale(country: CountryCode): LocaleCode {
    return COUNTRY_LOCALE_MAP[country] ?? `en-${country}`;
}

// Is a string a valid country code
function isCountryCode(country: string): country is CountryCode {
    return /^[A-Z][A-Z]$/.test(country);
}