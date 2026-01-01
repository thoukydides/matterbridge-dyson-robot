// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { DysonBitmapOctet } from './dyson-bitmap-octet.js';
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

// Render overlaid identically sized bitmaps as text with ANSI colour codes
export function dysonRenderAnsiBitmaps<Bitmaps extends DysonBitmapTuple>(
    bitmaps:    readonly [...Bitmaps],
    filter:     DysonAnsiBitmapsFilterPixel<Bitmaps>,
    eol         = ''
): string[] {
    assertCompatibleBitmaps(bitmaps);
    const { width, height } = bitmaps[0];
    const filterCoord = (x: number, y: number) => {
        const args = bitmaps.map(bitmap => bitmap.read(x, y)) as DysonBitmapsOctetTuple<Bitmaps>;
        return filter(...args);
    };
    return renderAnsi(width, height, filterCoord, eol);
}

// Render overlaid bitmaps using quadrant block elements
export function dysonRenderAnsiBitmapsQuadrature<Bitmaps extends DysonBitmapTuple>(
    bitmaps:        readonly [...Bitmaps],
    filterPixel:    DysonAnsiBitmapsQuadrantsFilterPixel<Bitmaps>,
    filterGlyph:    DysonAnsiBitmapsQuadrantsFilterGlyph<Bitmaps>,
    glyphs:         string, // 16 characters
    eol             = ''
): string[] {
    assertCompatibleBitmaps(bitmaps);
    const { width, height } = bitmaps[0];

    // Convert quadrant occupancy into a block element
    const makeQuadrant = ({ tl, tr, bl, br }: DysonQuadrants<boolean>): string => {
        const index = (tl ? 1 : 0) + (tr ? 2 : 0) + (bl ? 4 : 0) + (br ? 8 : 0);
        const char = glyphs[index];
        assertIsDefined(char);
        return char;
    };

    // Process the bitmap with 2x2 pixels per character
    const filterCoord = (x: number, y: number) => {
        // Pixel value from each bitmap corresponding to each quadrant
        const sample = (dx: number, dy: number): DysonBitmapsOctetTuple<Bitmaps> | undefined => {
            const px = 2 * x + dx;
            const py = 2 * y + dy;
            if (width <= px || height <= py) return undefined;
            return bitmaps.map(b => b.read(px, py)) as DysonBitmapsOctetTuple<Bitmaps>;
        };
        const samples: QuadrantSamples<Bitmaps> =
            { tl: sample(0, 0), tr: sample(1, 0), bl: sample(0, 1), br: sample(1, 1) };

        // Select the most appropriate quadrant block element
        const occupied = (s: DysonBitmapsOctetTuple<Bitmaps> | undefined): boolean => s ? filterPixel(...s) : false;
        const occupancy = { tl: occupied(samples.tl), tr: occupied(samples.tr), bl: occupied(samples.bl), br: occupied(samples.br) };
        const glyph = makeQuadrant(occupancy);

        // Select the final character and
        const allPixels = bitmaps.map((_, i) =>
            [samples.tl, samples.tr, samples.bl, samples.br].flatMap(s => s ? [s[i]] : [])
        ) as DysonBitmapsOctetArrayTuple<Bitmaps>;
        return filterGlyph(glyph, ...allPixels);
    };
    return renderAnsi(Math.ceil(width / 2), Math.ceil(height / 2), filterCoord, eol);
}

// Render a rectangular block of text with ANSI colour codes
function renderAnsi(
    width:  number,
    height: number,
    filter: (x: number, y: number) => DysonAnsiChar,
    eol     = ''
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
        lines.push(line + eol);
    }
    return lines;
}

// Ensure that multiple bitmaps are the same size
function assertCompatibleBitmaps(bitmaps: DysonBitmapTuple): void {
    const sizes = new Set(bitmaps.map(bitmap => `${bitmap.width}x${bitmap.height}`));
    if (sizes.size !== 1) throw new Error(`All bitmaps must be the same size (${[...sizes].join(' ≠ ')})`);
}