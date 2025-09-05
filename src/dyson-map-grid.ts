// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { Dyson360MapData } from './dyson-360-types.js';
import {
    DysonMapBitmap,
    DysonMapBitmapBase,
    DysonMapBitmapRotated
} from './dyson-map-bitmap.js';
import { DysonMapCoordinate } from './dyson-map-coordinate.js';

// Layers of a Dyson map tile
export const DYSON_MAP_LAYERS = ['cleaned', 'observed', 'occupied', 'unnavigable'] as const;
export type DysonMapLayers = typeof DYSON_MAP_LAYERS[number];

// A single map tile for a Dyson robot vacuum device
export class DysonMapGrid {

    // The current tile data
    readonly rawBitmap  = new DysonMapBitmap<DysonMapLayers>();
    degrees             = 0;
    resolution?:        number;
    globalPosition?:    DysonMapCoordinate;

    // The tile's bitmap rotated to its correct orientation
    get bitmap(): DysonMapBitmapBase<DysonMapLayers> {
        return new DysonMapBitmapRotated(this.rawBitmap, this.degrees);
    }

    // The location of the tile's origin in global coordinates
    get origin(): DysonMapCoordinate {
        if (!this.globalPosition)   throw new Error('Invalid global position');
        if (!this.resolution)       throw new Error('Invalid resolution');
        return this.globalPosition.scale(1 / this.resolution);
    }

    // Set the location of the tile's origin in global coordinates
    setGlobalPosition(coord: DysonMapCoordinate): void {
        this.globalPosition = coord;
    }

    // Set clockwise rotation to apply before placing in the global coordinates
    setRotation(degrees: number): void {
        this.degrees = degrees;
    }

    // Set the pixel size in global coordinate units
    setResolution(resolution: number): void {
        this.resolution = resolution;
    }

    // Set the dimensions of the bitmap (x = columns, y = rows)
    setSize(_size: DysonMapCoordinate): void {
        // (Ignored: The size is inferred from the layer data)
    }

    // The location of the origin in the tile's coordinate frame
    setOrigin(origin: DysonMapCoordinate): void {
        this.rawBitmap.origin = origin;
    }

    // Set or replace all layers of the bitmap
    setData(data: Dyson360MapData): void {
        for (const layer of DYSON_MAP_LAYERS)
            this.rawBitmap.setLayer(layer, data[layer]);
    }
}