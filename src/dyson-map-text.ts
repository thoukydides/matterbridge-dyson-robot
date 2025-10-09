// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import {
    DysonMapBitmap,
    DysonMapBitmapBase,
    dysonMapBitmapBoundingBox,
    DysonMapBitmapComposite,
    DysonMapBitmapCropped,
    DysonMapBitmapResampled,
    dysonMapMergePixels,
    DysonMapPixel
} from './dyson-map-bitmap.js';
import { DysonMapCoordinate } from './dyson-map-coordinate.js';
import { DysonMapGrid, DysonMapLayers } from './dyson-map-grid.js';
import { assertIsDefined, formatList, plural } from './utils.js';

// Maximum map width and padding
const MAX_MAP_WIDTH_CHAR    = 80;   // (characters)
const MAP_PADDING_CHAR      = 2;    // (characters)

// Character aspect ratio (for Matterbridge frontend log viewer)
const ASPECT_RATIO          = 5/9;  // (width / height)

// Maximum value used in the `unnavigable` layer
const MAX_UNNAVIGABLE       = 101;

// Extra bitmap layer for the robot's location
type DysonMapTextLayers = DysonMapLayers | 'robot';

// Text rendering configuration
export type DysonMapFgLayers = Exclude<DysonMapTextLayers, 'unnavigable'> | 'empty';
export interface DysonMapTextConfig {
    glyph:  Record<DysonMapFgLayers, string>;
    ansi: {
        fg:     Record<DysonMapFgLayers, string>;
        bg:     string[];
        reset:  string;
    }
}

// Default configuration for monospaced display
export const DYSON_MAP_CONFIG_MONOSPACED: DysonMapTextConfig = {
    glyph: {
        robot:      '▼',
        cleaned:    '!▘▝▀▖▌▞▛▗▚▐▜▄▙▟█',
        occupied:   '×',
        observed:   ' ',
        empty:      '░'
    },
    ansi: {
        fg: {
            robot:      '\u001B[38;5;46m',  // (green)
            cleaned:    '\u001B[38;5;255m', // (white)
            occupied:   '\u001B[38;5;196m', // (red)
            observed:   '\u001B[38;5;30m',  // (dim cyan)
            empty:      '\u001B[38;5;17m'   // (dark blue)
        },
        // Gradient from dark blue (empty) to light blue, then red (obstacle)
        bg: [17, 18, 19, 20, 21, 196].map(bg => `\u001B[48;5;${bg}m`),
        reset:          '\u001B[0m'
    }
};

// Default configuration for Matterbridge frontend
// (subset of glyphs that are same width in Arial)
export const DYSON_MAP_CONFIG_MATTERBRIDGE: DysonMapTextConfig = {
    ...DYSON_MAP_CONFIG_MONOSPACED,
    glyph: {
        robot:      '╬',
        cleaned:    '!▀▀▀▄▌██▄█▐█▄███',
        occupied:   '▒',
        observed:   '┼',
        empty:      '░'
    }
};

// Convert a collection of Dyson robot vacuum device map tiles to text
export function dysonMapText(
    log:        AnsiLogger,
    grids:      DysonMapGrid[],
    robotCoord: DysonMapCoordinate | undefined,
    config:     DysonMapTextConfig = DYSON_MAP_CONFIG_MONOSPACED
): string[] {

    // Convert [TL, TR, BL, BR] pixels values into a block element
    const makeQuadrant = (values: (number | undefined)[]): string => {
        const index = values.reduce<number>((acc, value, index) => value ? acc | (1 << index) : acc, 0);
        const char = config.glyph.cleaned[index];
        assertIsDefined(char);
        return char;
    };

    // Combine all the tiles and fit to double the text width
    const validGrids = checkGridTiles(log, grids);
    const compositeBitmap = makeCompositeBitmap(validGrids, robotCoord);
    const scaledBitmap = cropAndScaleBitmap(compositeBitmap);

    // Convert groups of 2×2 pixels to characters
    const { size } = scaledBitmap;
    const lines: string[] = [];
    for (let y = 0; y < size.y; y += 2) {
        let line = '', fgPrev = '', bgPrev = '';
        for (let x = 0; x < size.x; x += 2) {
            // Retrieve the map pixel data for this character
            const pixels = [
                scaledBitmap.getPixel(new DysonMapCoordinate([x,     y + 1])),
                scaledBitmap.getPixel(new DysonMapCoordinate([x + 1, y + 1])),
                scaledBitmap.getPixel(new DysonMapCoordinate([x,     y])),
                scaledBitmap.getPixel(new DysonMapCoordinate([x + 1, y]))
            ];
            const merged = dysonMapMergePixels(pixels);

            // Priority encode the bitmap layers
            const priority: DysonMapFgLayers =
                  merged.robot      ? 'robot'
                : merged.cleaned    ? 'cleaned'
                : merged.occupied   ? 'occupied'
                : merged.observed   ? 'observed' : 'empty';

            // Choose the glyph and colours for this character position
            const char = priority === 'cleaned'
                ? makeQuadrant(pixels.map(pixel => pixel.cleaned)) : config.glyph[priority];
            const fg = config.ansi.fg[priority];
            const bg = safeSelect(config.ansi.bg, merged.unnavigable ?? 0, MAX_UNNAVIGABLE);

            // Add colour codes if required, followed by the selected glyph
            if (bg !== bgPrev) line += bg;
            if (fg !== fgPrev) line += fg;
            [bgPrev, fgPrev] = [bg, fg];
            line += char;
        }
        line += config.ansi.reset;
        lines.push(line);
    }
    return lines.reverse();
}

// Check that all grid tiles are valid
function checkGridTiles(log: AnsiLogger, grids: DysonMapGrid[]): DysonMapGrid[] {
    // Ignore any tiles without position or resolution data
    const validGrids = grids.filter(grid => grid.globalPosition && grid.resolution);
    if (validGrids.length !== grids.length) {
        log.warn(`Ignoring ${plural(grids.length - validGrids.length, 'incomplete map tile')}`);
    }

    // Verify that all tiles have the same resolution
    const resolutions = new Set(validGrids.map(grid => String(grid.resolution)));
    if (1 < resolutions.size) {
        throw new Error(`Multiple map tile resolutions (${formatList([...resolutions])}) are unsupported`);
    }
    return validGrids;
}

// Create a composite bitmap from the individual grid tiles
function makeCompositeBitmap(
    grids:          DysonMapGrid[],
    robotCoord?:    DysonMapCoordinate
): DysonMapBitmapBase<DysonMapTextLayers> {
    // Construct a composite bitmap with all of the tiles
    const compositeBitmap = new DysonMapBitmapComposite<DysonMapTextLayers>();
    for (const grid of grids) compositeBitmap.addBitmap(grid.bitmap, grid.origin);

    // Add a bitmap for the robot's location
    if (robotCoord) {
        const robotBitmap = new DysonMapBitmap<'robot'>();
        robotBitmap.setLayer('robot', [[1]]);
        const resolution = grids[0]?.resolution ?? 1;
        compositeBitmap.addBitmap(robotBitmap, robotCoord.scale(1 / resolution));
    }
    return compositeBitmap;
}

// Crop and scale a bitmap to fit the observed map region
function cropAndScaleBitmap(bitmap: DysonMapBitmapBase<DysonMapTextLayers>): DysonMapBitmapBase<DysonMapTextLayers> {
    // Determine the bounding box of the observed region
    const observed = (pixel: DysonMapPixel<DysonMapTextLayers>): boolean => Boolean(pixel.observed);
    const [coreMin, coreMax] = dysonMapBitmapBoundingBox(bitmap, observed)
        ?? [DysonMapCoordinate.ZERO, bitmap.size];

    // Calculate the required scale factors, allowing for edge padding
    const maxCorePixelWidth = (MAX_MAP_WIDTH_CHAR - 2 * MAP_PADDING_CHAR) * 2;
    const scaleX = Math.min(maxCorePixelWidth / (coreMax.x - coreMin.x), 1);
    const scaleY = scaleX * ASPECT_RATIO;

    // Crop the bitmap to the selected region plus edge padding
    const padding = new DysonMapCoordinate([MAP_PADDING_CHAR * 2 / scaleX, MAP_PADDING_CHAR * 2 / scaleY]);
    const croppedBitmap = new DysonMapBitmapCropped(bitmap, coreMin.sub(padding), coreMax.add(padding));

    // Finally scale the cropped bitmap to the required size
    return new DysonMapBitmapResampled(croppedBitmap, scaleX, scaleY);
}

// Safely select an array element given a differently scaled index
function safeSelect<T>(array: T[], index: number, maxIndex: number): T {
    const scaledIndex = Math.floor(index * array.length / (maxIndex + 1));
    const croppedIndex = Math.min(Math.max(scaledIndex, 0), array.length - 1);
    return array[croppedIndex] as T;
}