// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { DysonMqtt360 } from './dyson-mqtt-360.js';
import { formatSeconds, getValidationTree, tryListener } from './utils.js';
import { Dyson360MapData } from './dyson-360-types.js';
import {
    Dyson360MsgMapData,
    Dyson360MsgMapGlobal,
    Dyson360MsgMapGrid,
    Dyson360MsgStateChange
} from './dyson-360-msg-types.js';
import { checkers } from './ti/dyson-360-types.js';
import { inflateSync } from 'node:zlib';
import { INSPECT_VERBOSE } from './logger-options.js';
import { IErrorDetail } from 'ts-interface-checker';
import { inspect } from 'node:util';
import { DysonMapGrid } from './dyson-map-grid.js';
import { DysonMapCoordinate } from './dyson-map-coordinate.js';
import {
    DYSON_MAP_CONFIG_MATTERBRIDGE,
    DYSON_MAP_CONFIG_MONOSPACED,
    dysonMapText
} from './dyson-map-text.js';

// Map rendering for a Dyson robot vacuum device
export class DysonDevice360Map {

    // Current clean, if any
    cleanId?: string;
    readonly grids = new Map<string, DysonMapGrid>();

    // Construct a new Dyson map renderer
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly mqtt:      DysonMqtt360
    ) {
        // Listen to map-related MQTT messages
        mqtt.on('message', tryListener(this.mqtt, msg => {
            switch (msg.msg) {
            case 'MAP-GLOBAL':
            case 'MAP-GRID':
            case 'MAP-DATA':
                this.updateMap(msg);
                break;
            case 'STATE-CHANGE':
                if (msg.endOfClean) this.finishMap(msg);
                break;
            }
        }));
    }

    // Update a single map tile from a received MQTT message
    updateMap(msg: Dyson360MsgMapGlobal | Dyson360MsgMapGrid | Dyson360MsgMapData): void {
        // Start a new map if the clean identifier has changed
        if (msg.cleanId !== this.cleanId) {
            if (this.cleanId !== undefined) {
                this.log.warn(`Discarding map for cleanId ${this.cleanId}`);
                this.finishMap();
            }
            this.log.debug(`Starting new map for cleanId ${msg.cleanId}`);
            this.cleanId = msg.cleanId;
        }

        // Select or create the tile for this update
        const grid = this.grids.get(msg.gridID) ?? new DysonMapGrid();
        this.grids.set(msg.gridID, grid);

        // Update the tile using the details from the received MQTT message
        switch (msg.msg) {
        case 'MAP-GLOBAL':
            grid.setGlobalPosition(new DysonMapCoordinate(msg));
            grid.setRotation(msg.angle);
            break;
        case 'MAP-GRID':
            grid.setResolution(msg.resolution);
            grid.setSize(new DysonMapCoordinate([msg.width, msg.height]));
            grid.setOrigin(new DysonMapCoordinate(msg.anchor));
            break;
        case 'MAP-DATA':
            grid.setData(this.decodeMapData(msg.data.content));
            break;
        }
    }

    // Render the final map when the clean finishes
    finishMap(msg?: Dyson360MsgStateChange): void {
        if (this.cleanId === undefined) return;

        // Convert the map to a textual representation for logging
        const { logMapStyle } = this.config;
        if (logMapStyle !== 'Off') {
            const style = logMapStyle === 'Matterbridge'
                ? DYSON_MAP_CONFIG_MATTERBRIDGE : DYSON_MAP_CONFIG_MONOSPACED;
            const robotCoord = new DysonMapCoordinate(this.mqtt.status.globalPosition);
            const mapText = dysonMapText(this.log, [...this.grids.values()], robotCoord, style);
            this.log.info(msg?.cleanDuration
                ? `Cleaned for ${formatSeconds(msg.cleanDuration)}:`
                : `Unexpected end of clean ${this.cleanId}:`);
            for (const line of mapText) this.log.info(line);
        }

        // Discard the map data
        this.cleanId = undefined;
        this.grids.clear();
    }

    // Decode and check the MAP-DATA content field
    decodeMapData(content: string): Dyson360MapData {
        let json: unknown;
        try {
            const deflated = Buffer.from(content, 'base64');
            // (Note: zlib deflate compressed, despite 'gzipped' label)
            const text = inflateSync(deflated).toString();
            json = JSON.parse(text);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to decode and parse Dyson map data as JSON: ${message}`);
        }

        // Check that the map data has the expected fields
        const checker = checkers.Dyson360MapData;
        const validation = checker.validate(json);
        if (validation) {
            this.logCheckerValidation(LogLevel.ERROR, json, validation);
            throw new Error('Unexpected structure of Dyson map data');
        }
        const strictValidation = checker.strictValidate(json);
        if (strictValidation) {
            this.logCheckerValidation(LogLevel.WARN, json, strictValidation);
            // (Continue processing map data that includes unexpected properties)
        }

        // Return the result
        return json as Dyson360MapData;
    }

    // Log checker validation errors
    logCheckerValidation(level: LogLevel, content: unknown, errors?: IErrorDetail[]): void {
        this.log.log(level, 'MAP-DATA content:');
        if (errors) {
            const validationLines = getValidationTree(errors);
            validationLines.forEach(line => { this.log.log(level, line); });
        }
        const contentLines = inspect(content, INSPECT_VERBOSE).split('\n');
        contentLines.forEach(line => { this.log.info(`    ${line}`); });
    }
}