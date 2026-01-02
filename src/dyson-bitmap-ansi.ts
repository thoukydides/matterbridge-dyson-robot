// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { Dyson360Rotation } from './dyson-360-types.js';
import {
    DysonBitmapOctet,
    DysonOctetOccupancyFilter,
    DysonOctetResampleFilter
} from './dyson-bitmap-octet.js';
import { assertIsDefined } from './utils.js';

// A character with optional ANSI colour codes
export interface DysonAnsiCodes {
    fg?:    string;
    bg?:    string;
}
export interface DysonAnsiChar extends DysonAnsiCodes {
    char:   string;
}

// Map tuples of bitmaps to a tuple of the underlying octet types
export type DysonBitmapTuple = readonly [DysonBitmapOctet, ...DysonBitmapOctet[]];
type DysonBitmapsOctetTuple<Bitmaps extends DysonBitmapTuple> = {
    [K in keyof Bitmaps]: Bitmaps[K] extends DysonBitmapOctet<infer Octet> ? Octet : never;
}
type DysonBitmapsOctetArrayTuple<Bitmaps extends DysonBitmapTuple> = {
    [K in keyof Bitmaps]: Bitmaps[K] extends DysonBitmapOctet<infer Octet> ? Octet[] : never;
}

// A bitmap with its resampling configuration
export interface DysonResampleBitmap<Octet extends number = number> {
    bitmap:     DysonBitmapOctet<Octet>;
    occupancy?: DysonOctetOccupancyFilter<Octet>;
    resample?:  DysonOctetResampleFilter<Octet>;
    origin?:    { x: number, y: number };
}

// A function that returns a character with optional ANSI colour codes
export type DysonAnsiBitmapsFilterPixel<Bitmaps extends DysonBitmapTuple> =
    (...args: DysonBitmapsOctetTuple<Bitmaps>) => DysonAnsiChar;

// Function that return quadrature block occupancy and glyphs
export interface DysonQuadrants<T> { tl: T; tr: T; bl: T; br: T; }
type QuadrantSamples<Bitmaps extends DysonBitmapTuple> =
    DysonQuadrants<DysonBitmapsOctetTuple<Bitmaps> | undefined>;
export type DysonAnsiBitmapsQuadrantsFilterPixel<Bitmaps extends DysonBitmapTuple> =
    (...args: DysonBitmapsOctetTuple<Bitmaps>) => boolean;
export type DysonAnsiBitmapsQuadrantsFilterGlyph<Bitmaps extends DysonBitmapTuple> =
    (char: string, ...args: DysonBitmapsOctetArrayTuple<Bitmaps>) => DysonAnsiChar;

// Render a collection of overlaid bitmaps as text using ANSI colour codes
export class DysonBitmapAnsi<
    ResampleBitmaps extends [DysonResampleBitmap, ...DysonResampleBitmap[]],
    Bitmaps extends DysonBitmapTuple = { [K in keyof ResampleBitmaps]: ResampleBitmaps[K]['bitmap'] }
> {
    // Output size in characters
    maxWidthChars               = Infinity; // characters
    maxHeightChars              = Infinity; // characters
    charAspectRatio             = 1;        // character width/height

    // Transformation applied to the output
    invertY                     = false;
    rotation: Dyson360Rotation  = 0;

    // String applied to the end of every line to reset all attributes
    eolAnsiReset                = '\u001B[0m';

    // Glyphs used to render quadrature block elements
    quadratureGlyphs?:          string;     // (16 characters)

    // Construct a bitmap renderer
    constructor(readonly bitmaps: ResampleBitmaps) {}

    // Render overlaid identically sized bitmaps as text with ANSI colour codes
    toChar(
        filter:         DysonAnsiBitmapsFilterPixel<Bitmaps>
    ): string[] {
        const { width, height, readPixels } = this.prepareBitmaps(1);
        const filterCoord = (x: number, y: number) => filter(...readPixels(x, y));
        return this.renderAnsi(width, height, filterCoord);
    }

    // Render overlaid bitmaps using quadrant block elements
    toQuadrature(
        filterPixel:    DysonAnsiBitmapsQuadrantsFilterPixel<Bitmaps>,
        filterGlyph:    DysonAnsiBitmapsQuadrantsFilterGlyph<Bitmaps>
    ): string[] {
        // Ensure that suitable block element glyphs have been configured
        const glyphs = this.quadratureGlyphs;
        if (glyphs?.length !== 16) throw new Error('Quadrature glyphs must be exactly 16 characters long');

        // Convert quadrant occupancy into a block element
        const makeQuadrant = ({ tl, tr, bl, br }: DysonQuadrants<boolean>): string => {
            const index = (tl ? 1 : 0) + (tr ? 2 : 0) + (bl ? 4 : 0) + (br ? 8 : 0);
            const char = glyphs[index];
            assertIsDefined(char);
            return char;
        };

        // Process the bitmap with 2x2 pixels per character
        const { width, height, readPixels } = this.prepareBitmaps(2);
        const filterCoord = (x: number, y: number) => {
            // Pixel value from each bitmap corresponding to each quadrant
            const sample = (dx: number, dy: number): DysonBitmapsOctetTuple<Bitmaps> | undefined => {
                const px = 2 * x + dx;
                const py = 2 * y + dy;
                if (width <= px || height <= py) return undefined;
                return readPixels(px, py);
            };
            const samples: QuadrantSamples<Bitmaps> =
                { tl: sample(0, 0), tr: sample(1, 0), bl: sample(0, 1), br: sample(1, 1) };

            // Select the most appropriate quadrant block element
            const occupied = (s: DysonBitmapsOctetTuple<Bitmaps> | undefined): boolean => s ? filterPixel(...s) : false;
            const occupancy = { tl: occupied(samples.tl), tr: occupied(samples.tr), bl: occupied(samples.bl), br: occupied(samples.br) };
            const glyph = makeQuadrant(occupancy);

            // Select the final character and colour codes
            const allPixels = this.bitmaps.map((_, i) =>
                [samples.tl, samples.tr, samples.bl, samples.br].flatMap(s => s ? [s[i]] : [])
            ) as DysonBitmapsOctetArrayTuple<Bitmaps>;
            return filterGlyph(glyph, ...allPixels);
        };
        return this.renderAnsi(Math.ceil(width / 2), Math.ceil(height / 2), filterCoord);
    }

    // Render a rectangular block of text with ANSI colour codes
    renderAnsi(
        width:  number,
        height: number,
        filter: (x: number, y: number) => DysonAnsiChar
    ): string[] {
        const lines = [];
        for (let y = 0; y < height; ++y) {
            let line = '';
            const prevAnsi: DysonAnsiCodes = {};
            for (let x = 0; x < width; ++x) {
                const { char, fg, bg } = filter(x, y);
                if (fg && fg !== prevAnsi.fg) { prevAnsi.fg = fg; line += fg; }
                if (bg && bg !== prevAnsi.bg) { prevAnsi.bg = bg; line += bg; }
                line += char;
            }
            lines.push(line + this.eolAnsiReset);
        }
        return lines;
    }

    // Scale, crop, and transform the bitmaps to fit the target console width
    prepareBitmaps(pixelsPerChar: number): {
        width:      number,
        height:     number,
        readPixels: (x: number, y: number) => DysonBitmapsOctetTuple<Bitmaps>
    } {
        // Scaling operates in pixel units
        const maxWidth  = this.maxWidthChars  * pixelsPerChar;
        const maxHeight = this.maxHeightChars * pixelsPerChar;

        // Will width and height be swapped when the output is rendered
        const swapXY = this.rotation % 180 === 90;
        const bitmaps = swapXY
            ? this.scaleBitmaps(maxHeight, maxWidth,  1 / this.charAspectRatio)
            : this.scaleBitmaps(maxWidth,  maxHeight, this.charAspectRatio);
        const { width, height } = bitmaps[0];
        const effectiveSize = swapXY ? { width: height, height: width } : { width, height };

        // Make a pixel reader that applies the transformation
        const readPixels = (x: number, y: number): DysonBitmapsOctetTuple<Bitmaps> => {
            switch (this.rotation) {
            case 0:                                               break;
            case 90:    [x, y] = [width - 1 - y, x             ]; break;
            case 180:   [x, y] = [width - 1 - x, height - 1 - y]; break;
            case 270:   [x, y] = [y,             height - 1 - x]; break;
            }
            if (this.invertY) y = height - 1 - y;
            return bitmaps.map(bitmap => bitmap.read(x, y)) as DysonBitmapsOctetTuple<Bitmaps>;
        };
        return { ...effectiveSize, readPixels };
    }

    // Scale and crop the bitmaps for fit specified dimensions
    scaleBitmaps(maxWidth: number, maxHeight: number, extraScaleY: number): Bitmaps {
        // Default filters (assume non-zero is occupied and pick highest value)
        const defaultOccupancy: DysonOctetOccupancyFilter = octet  => octet !== 0;
        const defaultResample:  DysonOctetResampleFilter  = octets => octets.length ? Math.max(...octets) : 0;

        // Collect the bounding boxes of each bitmap that has content
        const allBounds: { minX: number, minY: number, maxX: number, maxY: number }[] = [];
        for (const { bitmap, occupancy, origin } of this.bitmaps) {
            const bounds = bitmap.boundingBox(occupancy ?? defaultOccupancy);
            if (bounds) allBounds.push({
                minX: bounds.x + (origin?.x ?? 0),
                minY: bounds.y + (origin?.y ?? 0),
                maxX: bounds.x + (origin?.x ?? 0) + bounds.width,
                maxY: bounds.y + (origin?.y ?? 0) + bounds.height
            });
        }
        if (!allBounds.length) throw new Error('No bitmaps have content');

        // Merge the bounding boxes into a single bounding box
        const srcX      = Math.min(...allBounds.map(({ minX }) => minX));
        const srcY      = Math.min(...allBounds.map(({ minY }) => minY));
        const srcWidth  = Math.max(...allBounds.map(({ maxX }) => maxX)) - srcX;
        const srcHeight = Math.max(...allBounds.map(({ maxY }) => maxY)) - srcY;

        // Choose the output size (ensuring resolution does not increase)
        const maxScaleX = Math.min(1, maxWidth  / srcWidth);
        const maxScaleY = Math.min(1, maxHeight / srcHeight);
        const scaleX = Math.min(maxScaleX, maxScaleY / extraScaleY);
        const destSize = {
            width:  Math.round(srcWidth  * scaleX),
            height: Math.round(srcHeight * scaleX * extraScaleY)
        };

        // Resample each of the bitmaps to a common size (in quadrant blocks, not characters)
        return this.bitmaps.map(({ bitmap, origin, resample }) => {
            const bitmapBounds = {
                x:          srcX - (origin?.x ?? 0),
                y:          srcY - (origin?.y ?? 0),
                width:      srcWidth,
                height:     srcHeight
            };
            return bitmap.resample(bitmapBounds, destSize, resample ?? defaultResample);
        }) as unknown as Bitmaps;
    }
}