// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { STATUS_CODES } from 'http';

// Known status codes
const DYSON_STATUS_CODES = new Map<number, string>([
    // Unauthorized
    [401, 'MyDyson account access requires authorisation.'],
    // Too Many Requests
    [429, 'Too many requests issued to the MyDyson account API. The previous response may still be valid.']
]);

// Base for reporting all Dyson cloud API errors
export class DysonCloudError extends Error {

    // Create a new error
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
        Error.captureStackTrace(this, DysonCloudError);
        this.name = 'DysonCloudError';
    }
}

// A status code error
export class DysonCloudStatusCodeError extends DysonCloudError {

    // Create a new error
    constructor(
        readonly statusCode:    number,
        options?:               ErrorOptions
    ) {
        const message = DYSON_STATUS_CODES.get(statusCode) ?? STATUS_CODES[statusCode];
        super(message, options);
        Error.captureStackTrace(this, DysonCloudStatusCodeError);
        this.name = `DysonCloudStatusCodeError[${statusCode}]`;
    }
}