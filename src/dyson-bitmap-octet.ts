// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { PNG } from 'pngjs';
import { formatList, plural } from './utils.js';

// A bounding box
export interface DysonBitmapOctetBounds {
    x:      number;
    y:      number;
    width:  number;
    height: number;
}

// A function that maps a 32-bit RGBA colour to a single octet
export type DysonOctetColourFilter<Octet extends number = number> = (rgba: number) => Octet;

// A function that merges multiple pixels during resampling
export type DysonOctetResampleFilter<Octet extends number = number> = (octets: Octet[]) => Octet;

// A function that determines whether a pixel is occupied
export type DysonOctetOccupancyFilter<Octet extends number = number> = (octet: Octet) => boolean;

// A persistent map or cleaned area bitmap (one octet per pixel)
export class DysonBitmapOctet<Octet extends number = number> {

    // Transformations
    invertY = false;

    // Construct a new bitmap
    constructor(readonly width: number, readonly height: number, readonly buffer: Buffer) {}

    // Resample a rectangular region
    resample(
        src:        DysonBitmapOctetBounds,
        destWidth:  number,
        destHeight: number,
        filter:     DysonOctetResampleFilter<Octet>
    ): DysonBitmapOctet<Octet> {
        const destBuffer = Buffer.alloc(destWidth * destHeight);
        const width = src.width / destWidth, height = src.height / destHeight;
        for (let destY = 0; destY < destHeight; ++destY) {
            for (let destX = 0; destX < destWidth; ++destX) {
                const x = src.x + destX * width;
                const y = src.y + destY * height;
                const octets = this.pixels({ x, y, width, height });
                destBuffer[destY * destWidth + destX] = filter(octets);
            }
        }
        return new DysonBitmapOctet<Octet>(destWidth, destHeight, destBuffer);
    }

    // Read a single pixel
    read(x: number, y: number): Octet {
        const py = this.invertY ? this.height - 1 - y : y;
        return this.buffer.readUInt8(py * this.width + x) as Octet;
    }

    // Write a single pixel
    write(x: number, y: number, octet: Octet): void {
        const py = this.invertY ? this.height - 1 - y : y;
        this.buffer.writeUInt8(octet, py * this.width + x);
    }

    // Pixels within a rectangle
    pixels({x, y, width, height}: DysonBitmapOctetBounds): Octet[] {
        const startX = Math.max(Math.ceil(x), 0), endX = Math.min(Math.ceil(x + width),  this.width);
        const startY = Math.max(Math.ceil(y), 0), endY = Math.min(Math.ceil(y + height), this.height);
        const octets: Octet[] = [];
        for (let y = startY; y < endY; ++y) {
            for (let x = startX; x < endX; ++x) {
                octets.push(this.read(x, y));
            }
        }
        return octets;
    }

    // Determine the bounding box of occupied pixels
    boundingBox(filter: DysonOctetOccupancyFilter<Octet>): DysonBitmapOctetBounds | undefined {
        let minX = this.width, maxX = 0, minY = this.height, maxY = 0;
        for (let y = 0; y < this.height; ++y) {
            for (let x = 0; x < this.width; ++x) {
                if (filter(this.read(x, y))) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x + 1);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y + 1);
                }
            }
        }
        if (maxX === 0) return undefined;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // Count the number of occupied pixels
    occupied(filter: DysonOctetOccupancyFilter<Octet>): number {
        let count = 0;
        for (let y = 0; y < this.height; ++y) {
            for (let x = 0; x < this.width; ++x) {
                if (filter(this.read(x, y))) ++count;
            }
        }
        return count;
    }

    // Create a bitmap from a PNG, using a filter function from RGBA values
    static fromPNG<Octet extends number>(png: Buffer, filter: DysonOctetColourFilter<Octet>): DysonBitmapOctet<Octet> {
        const { width, height, data } = PNG.sync.read(png);
        const buffer = Buffer.alloc(width * height);
        for (let i = 0; i < buffer.length; ++i) {
            const rgba = data.readUInt32BE(i << 2);
            const rawOctet = filter(rgba);
            buffer[i] = Math.min(Math.max(Math.round(rawOctet), 0), 255);
        }
        return new DysonBitmapOctet(width, height, buffer);
    }

    // Create a bitmap from a PNG, using a map of RGBA values
    static fromPNGMapped<Octet extends number>(png: Buffer, map: Map<number, Octet>): DysonBitmapOctet<Octet> {
        const unmappedRGBA = new Set<string>();
        const filter = (rgba: number): Octet => {
            if (!map.has(rgba)) unmappedRGBA.add(`#${rgba.toString(16).toUpperCase().padStart(8, '0')}`);
            return map.get(rgba) ?? 0 as Octet;
        };
        const bitmap = DysonBitmapOctet.fromPNG(png, filter);
        if (unmappedRGBA.size) {
            throw new Error(`${plural(unmappedRGBA.size, 'unmapped bitmap colour')}: ${formatList([...unmappedRGBA.values()])}`);
        }
        return bitmap;
    }
}