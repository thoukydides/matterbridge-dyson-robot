// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { STATUS_CODES } from 'http';
import { checkers } from './ti/dyson-cloud-types.js';
import { CloudflareErrorResponse, DysonErrorResponse } from './dyson-cloud-types.js';
import { formatList, MS } from './utils.js';

// Known status codes
const DYSON_STATUS_CODES = new Map<number, string>([
    // Unauthorized
    [401, 'MyDyson account access requires authorisation.'],
    // Too Many Requests
    [429, 'Too many requests issued to the MyDyson account API. The previous response may still be valid.']
]);

// Non-retryable status codes
const NO_RETRY_STATUS_CODES = [400, 401, 403, 404, 405, 406, 409, 415, 422];

// Minimum retry delays (user agent should apply exponential back-off)
const MIN_RETRY_DELAY_MS        = 1 * MS;   // 1 second
const MIN_RATE_LIMIT_DELAY_MS   = 30 * MS;  // 30 seconds

// Maximum number of attempts when rate limited
const MAX_RATE_LIMIT_ATTEMPTS   = 5;

// Request retry behaviour
export type DysonCloudRetryBehaviour = {
    canRetry:   false;
    reason:     string; // Reason(s) for not retrying
} | {
    canRetry:   true;
    minDelay:   number; // Minimum delay in milliseconds before retrying
};

// Retry behaviour for non-API errors
export const RETRY_BEHAVIOUR_NON_API: DysonCloudRetryBehaviour =
    { canRetry: false, reason: 'non-API error' };

// Base for reporting all Dyson cloud API errors
export class DysonCloudError extends Error {

    // Create a new error
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
        Error.captureStackTrace(this, DysonCloudError);
        this.name = 'DysonCloudError';
    }

    // Can the request be retried
    getRetryBehaviour(_attempts: number): DysonCloudRetryBehaviour {
        // Retry all fetches that did not return an HTTP status code
        return { canRetry: true, minDelay: MIN_RETRY_DELAY_MS };
    }
}

// A status code error
export class DysonCloudStatusCodeError extends DysonCloudError {

    // Cloudflare RFC9457 structured error
    readonly rfc9457?: DysonErrorResponse;

    // Create a new error
    constructor(
        readonly statusCode:    number,
        body:                   unknown,
        options?:               ErrorOptions
    ) {
        const rfc9457 = DysonCloudStatusCodeError.parseBody(body);
        super(DysonCloudStatusCodeError.getMessage(statusCode, rfc9457), options);
        Error.captureStackTrace(this, DysonCloudStatusCodeError);
        this.name = `DysonCloudStatusCodeError[${statusCode}]`;
        this.rfc9457 = rfc9457;
    }


    // Can the request be retried
    getRetryBehaviour(attempts: number): DysonCloudRetryBehaviour {
        const VETO_CONDITIONS: [boolean, string][] = [
            [this.isCloudflare(this.rfc9457) && !this.rfc9457.retryable,    'Cloudflare marked request as non-retryable'],
            [NO_RETRY_STATUS_CODES.includes(this.statusCode),               `status code ${this.statusCode} is not retryable`],
            [this.isRateLimit() && MAX_RATE_LIMIT_ATTEMPTS <= attempts,     'too many attempts whilst rate limited']
        ];
        const vetoes = VETO_CONDITIONS.filter(([condition]) => condition).map(([, veto]) => veto);
        if (vetoes.length) return { canRetry: false, reason: formatList(vetoes) };

        // Request is retryable, so determine the minimum delay
        let minDelay = this.isRateLimit() ? MIN_RATE_LIMIT_DELAY_MS : MIN_RETRY_DELAY_MS;
        if (this.isCloudflare(this.rfc9457) && this.rfc9457.retry_after) {
            minDelay = Math.max(minDelay, this.rfc9457.retry_after * MS);
        }
        return { canRetry: true, minDelay };
    }

    // Is the API being rate limited
    isRateLimit(): boolean {
        return this.statusCode === 429
            || (this.isCloudflare(this.rfc9457) && this.rfc9457.error_category === 'rate_limit');
    }

    // Does the response have Cloudflare extensions
    isCloudflare(rfc9457?: DysonErrorResponse): rfc9457 is CloudflareErrorResponse {
        return rfc9457 !== undefined && 'cloudflare_error' in rfc9457;
    }

    // Attempt to parse the response as a structured Cloudflare RFC9457 error
    static parseBody(body: unknown): DysonErrorResponse | undefined {
        try {
            if (typeof body === 'string') {
                const json: unknown = JSON.parse(body);
                if (checkers.DysonErrorResponse.test(json)) return json;
            }
        } catch { /* empty */ }
    }

    // Construct an error message
    static getMessage(statusCode: number, rfc9457?: DysonErrorResponse): string {
        if (rfc9457) return `${rfc9457.title} (${rfc9457.detail})`;
        return DYSON_STATUS_CODES.get(statusCode) ?? STATUS_CODES[statusCode] ?? `HTTP ${statusCode}`;
    }
}