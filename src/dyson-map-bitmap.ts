// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import assert from 'assert';
import { DysonMapCoordinate } from './dyson-map-coordinate.js';

// A single pixel of a bitmap
export type DysonMapPixel<Layer extends string> = Partial<Record<Layer, number>>;

// Interface for a general purpose bitmap
export abstract class DysonMapBitmapBase<Layer extends string> {

    // The dimensions of the bitmap (x = columns, y = rows)
    abstract get size(): DysonMapCoordinate;

    // The location of the origin in the bitmap's coordinate frame
    abstract get origin(): DysonMapCoordinate;

    // Retrieve all layers of a single pixel of the bitmap
    abstract getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer>;
}

// A simple bitmap formed from 2D layer arrays
export class DysonMapBitmap<Layer extends string> extends DysonMapBitmapBase<Layer> {

    // The current bitmap data
    layers  = new Map<Layer, number[][]>();
    size    = new DysonMapCoordinate([0, 0]);
    origin  = new DysonMapCoordinate([0, 0]);

    // Add or update a bitmap layer
    setLayer(layer: Layer, data: number[][]): void {
        // Determine the size of the layer
        const size = new DysonMapCoordinate([data[0]?.length ?? 0, data.length]);
        if (!data.every(row => row.length === size.x)) {
            throw new Error(`Bitmap layer ${layer} has inconsistent row lengths`);
        }

        // Set or check the bitmap size
        if (this.layers.size === 0) {
            this.size = size;
        } else if (!this.size.equals(size)) {
            throw new Error(`Bitmap layer ${layer} has size ${size.toString()} but expected ${this.size.toString()}`);
        }

        // Store this bitmap layer
        this.layers.set(layer, data);
    }

    // Retrieve all layers of a single pixel of the bitmap
    getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer> {
        if (!Number.isInteger(coord.x) || !Number.isInteger(coord.y))
            throw new Error(`Bitmap pixel ${coord.toString()} non-integral`);
        if (!coord.inBounds(DysonMapCoordinate.ZERO, this.size))
            throw new Error(`Bitmap pixel ${coord.toString()} out of bounds`);
        const pixel: DysonMapPixel<Layer> = {};
        for (const [layer, data] of this.layers) {
            const value = data[coord.y]?.[coord.x];
            if (value !== undefined) pixel[layer] = value;
        }
        return pixel;
    }
}

// A bitmap rotated by multiples of 90°
export class DysonMapBitmapRotated<Layer extends string> extends DysonMapBitmapBase<Layer> {

    // Construct a rotated bitmap
    constructor(
        readonly bitmap:    DysonMapBitmapBase<Layer>,
        readonly degrees:   number
    ) {
        super();
    }

    // The dimensions of the bitmap (x = columns, y = rows)
    get size(): DysonMapCoordinate {
        const { size } = this.bitmap;
        switch ((this.degrees % 180 + 180) % 180) {
        case 0:   return size;
        case 90:  return size.transpose();
        default:  throw new Error(`Bitmap rotation angle ${this.degrees}° not supported`);
        }
    }

    // The location of the origin in the bitmap's coordinate frame
    get origin(): DysonMapCoordinate {
        return this.rotateCoordinate(this.degrees, this.bitmap.origin);
    }

    // Retrieve all layers of a single pixel of the bitmap
    getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer> {
        const rotatedCoord = this.rotateCoordinate(-this.degrees, coord);
        return this.bitmap.getPixel(rotatedCoord);
    }

    // Rotate a coordinate within the bitmap
    rotateCoordinate(degrees: number, coord: DysonMapCoordinate): DysonMapCoordinate {
        const { size } = this.bitmap;
        switch ((degrees % 360 + 360) % 360) {
        case 0:   return coord;
        case 90:  return new DysonMapCoordinate([size.y - 1 - coord.y, coord.x]);
        case 180: return new DysonMapCoordinate([size.x - 1 - coord.x, size.y - 1 - coord.y]);
        case 270: return new DysonMapCoordinate([coord.y, size.x - 1 - coord.x]);
        default:  throw new Error(`Bitmap rotation angle ${degrees}° not supported`);
        }
    }
}

// A scaled and resampled bitmap
export class DysonMapBitmapResampled<Layer extends string> extends DysonMapBitmapBase<Layer> {

    // Construct a resampled bitmap
    constructor(
        readonly bitmap:    DysonMapBitmapBase<Layer>,
        readonly scaleX:    number, // (0 < scale < 1 for smaller)
        readonly scaleY:    number = scaleX
    ) {
        super();
        assert(0 < scaleX && scaleX <= 1);
        assert(0 < scaleY && scaleY <= 1);
    }

    // The dimensions of the bitmap (x = columns, y = rows)
    get size(): DysonMapCoordinate {
        const scaledSize = this.bitmap.size.scale(this.scaleX, this.scaleY);
        return scaledSize.ceil();
    }

    // The location of the origin in the bitmap's coordinate frame
    get origin(): DysonMapCoordinate {
        return this.bitmap.origin.scale(this.scaleX, this.scaleY);
    }

    // Retrieve all layers of a single pixel of the bitmap
    getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer> {
        // Calculate the range of source pixels to sample
        const size = this.bitmap.size.ceil();
        const min = coord.scale(1 / this.scaleX, 1 / this.scaleY).round();
        const max = coord.add(DysonMapCoordinate.ONE)
            .scale(1 / this.scaleX, 1 / this.scaleY).round().min(size);

        // Retrieve the source pixels that contribute to this scaled pixel
        const pixels: DysonMapPixel<Layer>[] = [];
        for (let x = min.x; x < max.x; ++x) {
            for (let y = min.y; y < max.y; ++y) {
                const scaledCoord = new DysonMapCoordinate([x, y]);
                pixels.push(this.bitmap.getPixel(scaledCoord));
            }
        }
        return dysonMapMergePixels(pixels);
    }
}

// A cropped bitmap
export class DysonMapBitmapCropped<Layer extends string> extends DysonMapBitmapBase<Layer> {

    // Construct a cropped bitmap
    constructor(
        readonly bitmap:    DysonMapBitmapBase<Layer>,
        readonly min:       DysonMapCoordinate, // (inclusive)
        readonly max:       DysonMapCoordinate  // (exclusive)
    ) {
        super();
        assert(min.x <= max.x && min.y <= max.y);
    }

    // The dimensions of the bitmap (x = columns, y = rows)
    get size(): DysonMapCoordinate {
        return this.max.sub(this.min);
    }

    // The location of the origin in the bitmap's coordinate frame
    get origin(): DysonMapCoordinate {
        return this.bitmap.origin.sub(this.min);
    }

    // Retrieve all layers of a single pixel of the bitmap
    getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer> {
        const croppedCoord = coord.add(this.min).floor();
        return this.bitmap.getPixel(croppedCoord);
    }
}

// A composite bitmap formed from bitmaps at specified locations
interface DysonMapBitmapWithCoord<Layer extends string> {
    bitmap:         DysonMapBitmapBase<Layer>,
    boundingBox:    [DysonMapCoordinate, DysonMapCoordinate];
}
export class DysonMapBitmapComposite<Layer extends string> extends DysonMapBitmapBase<Layer> {

    // The individual bitmaps
    readonly bitmaps: DysonMapBitmapWithCoord<Layer>[] = [];

    // Bounding box around all composite bitmaps
    boundingBox?: [DysonMapCoordinate, DysonMapCoordinate];

    // Add a bitmap with its origin at a specified location
    addBitmap(bitmap: DysonMapBitmapBase<Layer>, origin: DysonMapCoordinate): void {
        // Store the details of this bitmap
        const min = origin.sub(bitmap.origin);
        const max = min.add(bitmap.size);
        this.bitmaps.push({ bitmap, boundingBox: [min, max] });

        // Update the bounding box
        this.boundingBox = this.boundingBox === undefined ? [min, max]
            : DysonMapCoordinate.boundingBox([...this.boundingBox, min, max]);
    }

    // The dimensions of the bitmap (x = columns, y = rows)
    get size(): DysonMapCoordinate {
        if (!this.boundingBox) return new DysonMapCoordinate([0, 0]);
        const [min, max] = this.boundingBox;
        return max.sub(min).ceil();
    }

    // The location of the origin in the bitmap's coordinate frame
    get origin(): DysonMapCoordinate {
        if (!this.boundingBox) return DysonMapCoordinate.ZERO;
        return DysonMapCoordinate.ZERO.sub(this.boundingBox[0]);
    }

    // Retrieve all layers of a single pixel of the bitmap
    getPixel(coord: DysonMapCoordinate): DysonMapPixel<Layer> {
        if (!this.boundingBox) return {};
        coord = coord.add(this.boundingBox[0]);

        // Find the corresponding pixel from all bitmaps at this location
        const pixels = this.bitmaps
            .filter(({ boundingBox }) => coord.inBounds(...boundingBox))
            .map(({ bitmap, boundingBox }) => bitmap.getPixel(coord.sub(boundingBox[0]).floor()));
        return dysonMapMergePixels(pixels);
    }
}

// Merge pixels (for each layer picking highest value from all contributions)
export function dysonMapMergePixels<Layer extends string>(
    pixels: DysonMapPixel<Layer>[]
): DysonMapPixel<Layer> {
    return pixels.reduce<DysonMapPixel<Layer>>((acc, pixel) => {
        for (const [layer, value] of Object.entries(pixel) as [Layer, number][]) {
            acc[layer] = acc[layer] === undefined ? value : Math.max(acc[layer], value);
        }
        return acc;
    }, {});
}

// Determine the bounding box of the occupied region of a bitmap
export function dysonMapBitmapBoundingBox<Layer extends string>(
    bitmap:     DysonMapBitmapBase<Layer>,
    predicate:  (pixel: DysonMapPixel<Layer>) => boolean
): [DysonMapCoordinate, DysonMapCoordinate] | undefined {
    const { size } = bitmap;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let x = 0; x < size.x; ++x) {
        for (let y = 0; y < size.y; ++y) {
            const pixel = bitmap.getPixel(new DysonMapCoordinate([x, y]));
            if (predicate(pixel)) {
                if (x < minX) minX = x;
                if (maxX < x) maxX = x;
                if (y < minY) minY = y;
                if (maxY < y) maxY = y;
            }
        }
    }
    if (minX === Infinity) return undefined;
    return [
        new DysonMapCoordinate([minX, minY]),
        new DysonMapCoordinate([maxX + 1, maxY + 1])
    ];
}
