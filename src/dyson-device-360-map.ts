// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import {
    DysonBitmapOctet,
    DysonOctetOccupancyFilter,
    DysonOctetResampleFilter
} from './dyson-bitmap-octet.js';
import { assertIsDefined } from './utils.js';
import {
    DysonAnsiChar,
    dysonRenderAnsiBitmapsQuadrature
} from './dyson-bitmap-ansi.js';
import {
    Dyson360CleanHistoryEntry,
    Dyson360CleanMap,
    Dyson360PersistentMapResponse
} from './dyson-360-cloud-types.js';
import { inflateSync } from 'zlib';
import { Dyson360TimelineEvent } from './dyson-360-types.js';
import { LogMapStyle } from './config-types.js';
import { Dyson360CleanSummary } from './dyson-device-360-base.js';

// Maximum map width
const MAX_MAP_WIDTH_CHAR    = 80;   // (characters)

// Character aspect ratio (for Matterbridge frontend log viewer)
const ASPECT_RATIO          = 5/9;  // (width / height)

// Dyson 360 Eye map pixels
enum Dyson360EyeOctet { Empty, Cleaned, Start, End }
const RGBA_360_EYE = new Map<number, Dyson360EyeOctet>([
    [0x835ED5FF,    Dyson360EyeOctet.Cleaned],  // Purple
    [0x8763D6FF,    Dyson360EyeOctet.Cleaned],  // Purple       (with pale grid line)
    [0x8B68D7FF,    Dyson360EyeOctet.Cleaned],  // Purple       (with grid lines crossing)
    [0x455CC7FF,    Dyson360EyeOctet.Start],    // Blue         (start location)
    [0xDD4157FF,    Dyson360EyeOctet.End],      // Red          (end location)
    [0x00000000,    Dyson360EyeOctet.Empty],    // Transparent
    [0xFFFFFF08,    Dyson360EyeOctet.Empty],    // Transparent  (with pale grid line)
    [0xFFFFFF10,    Dyson360EyeOctet.Empty],    // Transparent  (with grid lines crossing)
    [0xFFFFFFFF,    Dyson360EyeOctet.Empty]     // White        (robot's path)
]);

// Dyson 360 Vis Nav map pixels
enum Dyson360VisNavCleanedOctet { Empty, Cleaned, Fault }
const RGBA_VIS_NAV_CLEANED = new Map<number, Dyson360VisNavCleanedOctet>([
    [0x000000FF,    Dyson360VisNavCleanedOctet.Empty],          // Black
    [0xFFFFFFFF,    Dyson360VisNavCleanedOctet.Cleaned]         // White
]);
enum Dyson360VisNavPresentationOctet { Empty, Zone, Boundary, Dock }
const RGBA_VIS_NAV_PRESENTATION = new Map<number, Dyson360VisNavPresentationOctet>([
    [0x000000FF,    Dyson360VisNavPresentationOctet.Zone],      // Black
    [0xFFFFFFFF,    Dyson360VisNavPresentationOctet.Boundary],  // White
    [0x808080FF,    Dyson360VisNavPresentationOctet.Empty]      // Gray
]);

// Glyphs for monospaced fonts and Matterbridge frontend
// (Matterbridge versions are subset of Arial with same widths)
export type Dyson360MapStyle = Exclude<LogMapStyle, 'Off'>;
const QUADRATURE_GLYPHS: Record<Dyson360MapStyle, string> = {
    Monospaced:     ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█',
    Matterbridge:   ' ▀▀▀▄▌██▄█▐█▄███'
};
const GLYPHS = {
    boundary:   { Monospaced: '▪', Matterbridge: '╬' },
    cleaned:    { Monospaced: '☺', Matterbridge: '☺' }, // (quadrature block element substituted)
    empty:      { Monospaced: '┼', Matterbridge: '┼' },
    end:        { Monospaced: '●', Matterbridge: '═' },
    fault:      { Monospaced: '‼', Matterbridge: '▒' },
    start:      { Monospaced: '○', Matterbridge: '─' },
    zone:       { Monospaced: ' ', Matterbridge: '░' }
} as const satisfies Record<string, Record<Dyson360MapStyle, string>>;
type GlyphKey = keyof typeof GLYPHS;

// ANSI 256-colour codes
const COLOURS = {
    boundary:   { fg:  15,  bg: 235 },  // White on dark grey       (360 Vis Nav)
    cleaned:    { fg:  98,  bg:  16 },  // Light purple on black    (360 Eye)
    empty:      { fg: 233,  bg:  16 },  // Dark grey on black
    end:        { fg:  15,  bg: 197 },  // White on reddish pink    (360 Eye)
    fault:      { fg:  16,  bg:  11 },  // White on light grey      (360 Vis Nav)
    start:      { fg:  15,  bg:  62 },  // White on pale blue
    zone:       { fg: 235,  bg: 235 }   // Dark grey on dark grey   (360 Vis Nav)
} as const satisfies Record<GlyphKey, { fg: number, bg: number}>;

// Dust level colour gradient: purple-orange-yellow-white (360 Vis Nav)
const DUST_COLOURS = [54, 89, 124, 166, 208, 214, 220, 226, 227, 228, 229, 230, 231] as const;

// Ansi code to reset all attributes
const EOL = '\u001B[0m';

// Render a Dyson 360 Eye cleaned area map
export function dysonRenderMap360Eye(
    _log:       AnsiLogger,
    style:      Dyson360MapStyle,
    clean:      Dyson360CleanHistoryEntry,
    cleanPNG:   Buffer
): Dyson360CleanSummary {
    // Retrieve and parse the cleaned area image (5 mm/pixel)
    const fullBitmap = DysonBitmapOctet.fromPNGMapped(cleanPNG, RGBA_360_EYE);

    // Scale the image to the target log width
    const scaledBitmaps = scaleBitmaps({ bitmap: fullBitmap });

    // Convert the image to text
    const filterPixel = (octet: Dyson360EyeOctet): boolean => octet !== Dyson360EyeOctet.Empty;
    const filterGlyph = (char: string, octets: Dyson360EyeOctet[]): DysonAnsiChar => {
        if (octets.includes(Dyson360EyeOctet.End))   return makeGlyph(style, 'end');
        if (octets.includes(Dyson360EyeOctet.Start)) return makeGlyph(style, 'start');
        if (char === ' ')                            return makeGlyph(style, 'empty');
        return { ...makeGlyph(style, 'cleaned'), char };
    };
    const glyphs = QUADRATURE_GLYPHS[style];
    const mapLines = dysonRenderAnsiBitmapsQuadrature(scaledBitmaps, filterPixel, filterGlyph, glyphs, EOL);

    // Log the clean details and cleaned area map
    return { charges: clean.Charges, cleanedArea: clean.Area, mapLines };
}

// Render a Dyson 360 Vis Nav cleaned area map
export function dysonRenderMap360VisNav(
    log:    AnsiLogger,
    style:  Dyson360MapStyle,
    clean:  Dyson360CleanMap,
    map?:   Dyson360PersistentMapResponse
): Dyson360CleanSummary {
    // Check that the bitmaps are all the same resolution
    const resolutions = new Set<number>([
        clean.cleanedFootprint.resolution,
        clean.dustMap.resolution
    ]);
    if (map) resolutions.add(map.presentationMap.resolution);
    if (resolutions.size !== 1) throw new Error(`Multiple bitmap resolutions not supported (${[...resolutions].join(' ≠ ')})`);
    const [mmPerPixel] = resolutions;
    assertIsDefined(mmPerPixel);

    // Set a single pixel
    const setPixel = <Octet extends number>(bitmap: DysonBitmapOctet<Octet>, coord: { x: number, y: number }, octet: Octet): void => {
        const mmToPixels = (mm: number): number => Math.round(mm / mmPerPixel);
        const x = mmToPixels(coord.x), y = mmToPixels(coord.y);
        if (0 <= x && x < bitmap.width && 0 <= y && y < bitmap.height) bitmap.write(x, y, octet);
        else log.warn(`Coordinate outside bitmap (${coord.x}, ${coord.y} mm)`);
    };

    // If the clean is associated with a map then parse its presentation map
    let presentationBitmap: DysonBitmapOctet<Dyson360VisNavPresentationOctet>;
    let presentationOrigin: { x: number, y: number } | undefined;
    if (clean.persistentMap && map) {
        // Parse the presentation map image and add any dock locations
        const presentationPNG = Buffer.from(map.presentationMap.data, 'base64');
        presentationBitmap = DysonBitmapOctet.fromPNGMapped(presentationPNG, RGBA_VIS_NAV_PRESENTATION);
        for (const dock of map.dockLocations) {
            setPixel(presentationBitmap, dock, Dyson360VisNavPresentationOctet.Dock);
        }
        const { cleanMapPosition } = clean.persistentMap;
        presentationOrigin = {
            x:  -cleanMapPosition.x / mmPerPixel,
            y:  -cleanMapPosition.y / mmPerPixel
        };
    } else {
        // No persistent map, so create an empty presentation bitmap
        const emptyBuffer = Buffer.alloc(1, Dyson360VisNavPresentationOctet.Empty);
        presentationBitmap = new DysonBitmapOctet(1, 1, emptyBuffer);
    }

    // Parse the cleaned footprint image and add any fault locations
    const cleanedPNG = Buffer.from(clean.cleanedFootprint.data, 'base64');
    const cleanedBitmap = DysonBitmapOctet.fromPNGMapped(cleanedPNG, RGBA_VIS_NAV_CLEANED);
    for (const { faultLocation } of clean.cleanTimeline) {
        if (faultLocation !== null) {
            setPixel(cleanedBitmap, faultLocation, Dyson360VisNavCleanedOctet.Fault);
        }
    }

    // Convert the dust level data into a bitmap
    const { width: dustWidth, height: dustHeight } = clean.dustMap;
    const dustData = clean.dustMap.dustData[0];
    assertIsDefined(dustData);
    const dustDataDecoded = inflateSync(Buffer.from(dustData.data, 'base64'));
    const dustDataBitmap = new DysonBitmapOctet(dustWidth, dustHeight, dustDataDecoded);

    // Scale all of the images to the target log width and mirror vertically
    const scaledBitmaps = scaleBitmaps(
        { bitmap: cleanedBitmap },
        { bitmap: presentationBitmap, origin: presentationOrigin },
        { bitmap: dustDataBitmap }
    );
    for (const bitmap of scaledBitmaps) bitmap.invertY = true;

    // Convert the image to text
    const filterPixel = (octet: Dyson360VisNavCleanedOctet): boolean => octet === Dyson360VisNavCleanedOctet.Cleaned;
    const filterGlyph = (
        char:           string,
        cleaned:        Dyson360VisNavCleanedOctet[],
        presentation:   Dyson360VisNavPresentationOctet[],
        dustLevels:     number[]
    ): DysonAnsiChar => {
        // Render the presentation map by itself
        const PRESENTATION_ANSI_BG: Record<Dyson360VisNavPresentationOctet, DysonAnsiChar> = {
            [Dyson360VisNavPresentationOctet.Dock]:     makeGlyph(style, 'start'),
            [Dyson360VisNavPresentationOctet.Zone]:     makeGlyph(style, 'zone'),
            [Dyson360VisNavPresentationOctet.Boundary]: makeGlyph(style, 'boundary'),
            [Dyson360VisNavPresentationOctet.Empty]:    makeGlyph(style, 'empty')
        };
        const presentationOctet = Math.max(...presentation) as Dyson360VisNavPresentationOctet;
        const presentationChar = PRESENTATION_ANSI_BG[presentationOctet];

        // Faults take priority over everything else
        if (cleaned.some(octet => octet === Dyson360VisNavCleanedOctet.Fault)) return makeGlyph(style, 'fault');

        // Show the presentation map for dock locations and outside cleaned area
        if (presentationOctet === Dyson360VisNavPresentationOctet.Dock || char === ' ') return presentationChar;

        // Select colour based on dust level
        const dustLevel = Math.max(0, ...dustLevels) / (dustData.scaleFactor || 255);
        const dustAnsiId = DUST_COLOURS[Math.floor(dustLevel * DUST_COLOURS.length)] ?? DUST_COLOURS.at(-1);
        assertIsDefined(dustAnsiId);

        // Always show zone boundary, but adopt the dust level colour
        if (presentationOctet === Dyson360VisNavPresentationOctet.Boundary) {
            return { ...presentationChar, bg: bgColour(dustAnsiId) };
        }

        // Otherwise show the cleaned area (on the presentation map background)
        return { char, fg: fgColour(dustAnsiId), bg: presentationChar.bg };
    };
    const glyphs = QUADRATURE_GLYPHS[style];
    const mapLines = dysonRenderAnsiBitmapsQuadrature(scaledBitmaps, filterPixel, filterGlyph, glyphs, EOL);

    // Count the number of charging events and cleaned area
    const charges = clean.cleanTimeline.filter(e => e.eventName === Dyson360TimelineEvent.Charging).length;
    const cleanedCount = cleanedBitmap.occupied(filterPixel);
    const cleanedArea = cleanedCount * Math.pow(mmPerPixel / 1000, 2);

    // Log the clean details and cleaned area map
    return { charges, cleanedArea, mapLines };
}

// Scale a collection of bitmaps to fit the target console width
interface ResampleBitmap<Octet extends number = number> {
    bitmap:     DysonBitmapOctet<Octet>;
    occupancy?: DysonOctetOccupancyFilter<Octet>;
    resample?:  DysonOctetResampleFilter<Octet>;
    origin?:    { x: number, y: number };
}
function scaleBitmaps<Bitmaps extends [ResampleBitmap, ...ResampleBitmap[]]>(
    ...bitmaps: Bitmaps
): { [K in keyof Bitmaps]: Bitmaps[K]['bitmap']; } {
    // Default filters (assume non-zero is occupied and pick highest value)
    const defaultOccupancy: DysonOctetOccupancyFilter = octet  => octet !== 0;
    const defaultResample:  DysonOctetResampleFilter  = octets => octets.length ? Math.max(...octets) : 0;

    // Determine the bounding box of all bitmaps in the global coordinates
    const allBounds: { minX: number, minY: number, maxX: number, maxY: number }[] = [];
    for (const { bitmap, occupancy, origin } of bitmaps) {
        const bounds = bitmap.boundingBox(occupancy ?? defaultOccupancy);
        if (!bounds) continue;
        allBounds.push({
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

    // Resample each of the bitmaps to a common size (in quadrant blocks, not characters)
    const destWidth  = Math.round(Math.min(MAX_MAP_WIDTH_CHAR * 2, srcWidth));
    const destHeight = Math.round(srcHeight * destWidth * ASPECT_RATIO / srcWidth);
    return bitmaps.map(({ bitmap, origin, resample }) => {
        const srcBounds = {
            x:          srcX - (origin?.x ?? 0),
            y:          srcY - (origin?.y ?? 0),
            width:      srcWidth,
            height:     srcHeight
        };
        return bitmap.resample(srcBounds, destWidth, destHeight, resample ?? defaultResample);
    }) as { [K in keyof Bitmaps]: Bitmaps[K]['bitmap']; };
}

// Construct an ANSI colour coded glyph (using 256-colour mode IDs)
function makeGlyph(style: Dyson360MapStyle, key: GlyphKey): DysonAnsiChar {
    return {
        char:   GLYPHS[key][style],
        fg:     fgColour(COLOURS[key].fg),
        bg:     bgColour(COLOURS[key].bg)
    };
}

// Construct ANSI colour codes (using 256-colour mode IDs)
function fgColour(id: number): string { return `\u001B[38;5;${id}m`; }
function bgColour(id: number): string { return `\u001B[48;5;${id}m`; }