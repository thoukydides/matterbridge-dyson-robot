// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { Client, Dispatcher } from 'undici';
import { columns, getValidationTree, MS } from './utils.js';
import { IncomingHttpHeaders } from 'undici/types/header.js';
import { Checker, CheckerT, IErrorDetail } from 'ts-interface-checker';
import { INSPECT_VERBOSE } from './logger-options.js';
import { inspect } from 'util';
import { STATUS_CODES } from 'http';
import { PLUGIN_NAME, PLUGIN_VERSION } from './settings.js';
import { DysonCloudStatusCodeError } from './dyson-cloud-error.js';
import { setTimeout } from 'node:timers/promises';
import { MaybePromise } from 'matterbridge/matter';

// Request types
export type Method      = Dispatcher.HttpMethod;
export type Headers     = IncomingHttpHeaders;
export type Response    = Dispatcher.ResponseData;

// Requests specify the method used to retrieve the response body
export interface Request<Type = unknown> extends Dispatcher.DispatchOptions {
    consume:    (response: Response) => MaybePromise<Type>;
}

// Base URL for the Dyson cloud API
const DYSON_API_URL_GLOBAL  = 'https://appapi.cp.dyson.com';
const DYSON_API_URL_CHINA   = 'https://appapi.cp.dyson.cn';

// User agent string
const USER_AGENT            = `${PLUGIN_NAME}/${PLUGIN_VERSION}`;

// Timeout for all requests
const TIMEOUT               = 10 * MS;      // 10 seconds

// Delays between retries
const RETRY_DELAY_MIN       = 1 * MS;       // 1 second
const RETRY_DELAY_MAX       = 5 * 60 * MS;  // 5 minutes
const RETRY_DELAY_FACTOR    = 2;

// Dyson cloud API user agent
export class DysonCloudAPIUserAgent {

    // HTTP client used to issue the requests
    readonly client: Client;

    // Headers to include in all requests
    readonly headers: Headers = {
        'user-agent':   USER_AGENT,
        'content-type': 'application/json'
    };

    // Number of requests that have been issued
    requestCount = 0;

    // Construct a new Dyson cloud API user agent
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly china:     boolean
    ) {
        // Create an HTTP client
        this.client = new Client(
            china ? DYSON_API_URL_CHINA : DYSON_API_URL_GLOBAL,
            {
                bodyTimeout:    TIMEOUT,
                headersTimeout: TIMEOUT,
                connect: {
                    timeout:    TIMEOUT
                }
            });
    }

    // Set the Bearer token
    setBearerToken(token: string): void {
        this.headers.Authorization = `Bearer ${token}`;
    }

    // Requests that expect an empty response
    put(path: string, body: object): Promise<void> { return this.requestEmpty('PUT', path, body); }
    async requestEmpty(method: Method, path: string, body?: object): Promise<void> {
        // Issue the request
        const { headers } = this;
        const consume = async (response: Response): Promise<number> => {
            await response.body.dump();
            return Number(response.headers['content-length']);
        };
        const request: Request<number> = { method, path, headers, consume };
        if (body) request.body = JSON.stringify(body);
        const contentLength = await this.requestWithRetries(request);

        // Check that the response is empty
        if (contentLength) {
            this.logCheckerValidation(LogLevel.ERROR, request);
            throw new Error(`Unexpected non-empty Dyson cloud API response (${contentLength} bytes)`);
        }
    }

    // Issue a request and validate the JSON formatted response
    /* eslint-disable max-len */
    getJSON <Type>(checker: CheckerT<Type>, path: string              ): Promise<Type> { return this.requestJSON(checker, 'GET',   path); }
    postJSON<Type>(checker: CheckerT<Type>, path: string, body: object): Promise<Type> { return this.requestJSON(checker, 'POST',  path, body); }
    /* eslint-enable max-len */
    async requestJSON<Type>(checker: Checker, method: Method, path: string, body?: object): Promise<Type> {
        // Issue the request
        const headers = { ...this.headers, accept: 'application/json' };
        const consume = (response: Response): Promise<string> => response.body.text();
        const request: Request<string> = { method, path, headers, consume };
        if (body) request.body = JSON.stringify(body);
        const text = await this.requestWithRetries(request);

        // Parse the response as JSON
        let json: unknown;
        try {
            json = JSON.parse(text);
        } catch (err) {
            this.logCheckerValidation(LogLevel.ERROR, request, text);
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to parse Dyson cloud API response as JSON: ${message}`);
        }

        // Check that the response has the expected fields
        checker.setReportedPath('response');
        const validation = checker.validate(json);
        if (validation) {
            this.logCheckerValidation(LogLevel.ERROR, request, json, validation);
            throw new Error('Unexpected structure of Dyson cloud API response');
        }
        const strictValidation = checker.strictValidate(json);
        if (strictValidation) {
            this.logCheckerValidation(LogLevel.WARN, request, json, strictValidation);
            // (Continue processing responses that include unexpected properties)
        }

        // Return the result
        return json as Type;
    }

    // Requests that expect a binary response
    getBinary(path: string, accept: string): Promise<Buffer> { return this.requestBinary('GET', path, accept); }
    async requestBinary(method: Method, path: string, accept: string, body?: object): Promise<Buffer> {
        // Issue the request
        const headers = { ...this.headers, accept };
        const consume = (response: Response): Promise<ArrayBuffer> => response.body.arrayBuffer();
        const request: Request<ArrayBuffer> = { method, path, headers, consume };
        if (body) request.body = JSON.stringify(body);
        const arrayBuffer = await this.requestWithRetries(request);

        // Return the result, converted to a Node.js Buffer
        return Buffer.from(arrayBuffer);
    }

    // Perform the request, retrying if required, returning the response body
    async requestWithRetries<Type>(request: Request<Type>): Promise<Type> {
        // Request counters
        let requestCount: number | undefined;
        let retryCount = 0;
        let retryDelay = RETRY_DELAY_MIN;

        for (;;) {
            try {
                // Attempt the request
                requestCount ??= ++this.requestCount;
                const counter = `${requestCount}` + (retryCount ? `.${retryCount}` : '');
                return await this.requestCore(`Dyson cloud API #${counter}:`, request);

            } catch (err) {
                // Request failed, so check whether it can be retried
                if (!this.canRetry(err)) throw err;
                ++retryCount;

                // Delay before trying again
                await setTimeout(retryDelay);
                retryDelay = Math.min(retryDelay * RETRY_DELAY_FACTOR, RETRY_DELAY_MAX);
            }
        }
    }

    // Decide whether a request can be retried following an error
    canRetry(err: unknown): boolean {
        // Do not retry the request unless the failure was an API error
        if (!(err instanceof DysonCloudStatusCodeError)) return false;

        // Some status codes never retried
        const noRetryStatusCodes = [401, 404, 429];
        if (noRetryStatusCodes.includes(err.statusCode)) {
            this.log.warn(`Request will not be retried (status code ${err.statusCode})`);
            return false;
        }

        // The request can be retried
        return true;
    }

    // Perform the request and return the response body
    async requestCore<Type>(logPrefix: string, request: Request<Type>): Promise<Type> {
        const startTime = Date.now();
        let status = 'OK';
        try {
            // Log the request details
            this.log.debug(`${logPrefix} ${request.method} ${request.path}`);
            this.logHeaders(`${logPrefix} Request`, this.headers);
            this.logBody(`${logPrefix} Request`, request.body);

            // Attempt to issue the request and retrieve the response
            let response: Response;
            let body: Type;
            try {
                response = await this.client.request(request);
                this.logHeaders(`${logPrefix} Response`, response.headers);
                body = await request.consume(response);
                this.logBody(`${logPrefix} Response`, body);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                status = `ERROR: ${message}`;
                throw new Error(`Failed to issue Dyson cloud API request: ${message}`);
            }

            // Check whether the request was successful
            const statusCode = response.statusCode;
            status = `${statusCode} ${STATUS_CODES[statusCode]}`;
            if (statusCode < 200 || 300 <= statusCode) {
                throw new DysonCloudStatusCodeError(statusCode);
            }

            // Return the response body
            return body;
        } finally {
            // Log completion of the request
            this.log.debug(`${logPrefix} ${status} +${Date.now() - startTime}ms`);
        }
    }

    // Log request or response headers
    logHeaders(name: string, headers: Headers): void {
        if (!this.config.debugFeatures.includes('Log API Headers')) return;
        const rows: string[][] = [];
        Object.keys(headers).sort().forEach(key => {
            const values = headers[key];
            if (typeof values === 'string') rows.push([`${key}:`, values]);
            else if (Array.isArray(values)) {
                values.forEach(value => rows.push([`${key}:`, value]));
            }
        });
        this.log.debug(`${name} headers:`);
        columns(rows).forEach(line => { this.log.debug(`    ${line}`); });
    }

    // Log request or response body
    logBody(name: string, body: unknown): void {
        if (!this.config.debugFeatures.includes('Log API Bodies')) return;
        if (typeof body !== 'string') return;
        if (body.length) {
            this.log.debug(`${name} body:`);
            body.split('\n').forEach(line => { this.log.debug(`    ${line}`); });
        } else {
            this.log.debug(`${name} body: EMPTY`);
        }
    }

    // Log checker validation errors
    logCheckerValidation(level: LogLevel, request: Request, body?: unknown, errors?: IErrorDetail[]): void {
        this.log.log(level, `${request.method} ${request.path}:`);
        if (errors) {
            const validationLines = getValidationTree(errors);
            validationLines.forEach(line => { this.log.log(level, line); });
        }
        const bodyLines = inspect(body, INSPECT_VERBOSE).split('\n');
        bodyLines.forEach(line => { this.log.info(`    ${line}`); });
    }
}