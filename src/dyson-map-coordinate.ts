// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { Dyson360MapPath, Dyson360Position } from './dyson-360-types.js';

// Any type that can represent a coordinate
export interface DysonMapCoordinateInterface {
    x: number;
    y: number;
}
export type AnyDysonMapCoordinate =
    DysonMapCoordinateInterface | Dyson360Position | Dyson360MapPath;

// A transformable coordinate
export class DysonMapCoordinate implements DysonMapCoordinateInterface {

    readonly x: number;
    readonly y: number;

    // Constructor a coordinate
    constructor(coord: AnyDysonMapCoordinate) {
        [this.x, this.y] = Array.isArray(coord) ? coord : [coord.x, coord.y];
    }

    // Scale the coordinate around the origin
    scale(scaleX: number, scaleY?: number): DysonMapCoordinate {
        scaleY ??= scaleX;
        return new DysonMapCoordinate({ x: this.x * scaleX, y: this.y * scaleY });
    }

    // Translate the coordinate
    add(addend: DysonMapCoordinate): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  this.x + addend.x,
            y:  this.y + addend.y
        });
    }

    // Difference between two coordinates
    sub(subtrahend: DysonMapCoordinate): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  this.x - subtrahend.x,
            y:  this.y - subtrahend.y
        });
    }

    // Swap the x and y axis
    transpose(): DysonMapCoordinate {
        return new DysonMapCoordinate({ x: this.y, y: this.x });
    }

    // Rotate the coordinate anti-clockwise around the origin
    rotate(radians: number): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  this.x * Math.cos(radians) - this.y * Math.sin(radians),
            y:  this.x * Math.sin(radians) + this.y * Math.cos(radians)
        });
    }

    // Round a coordinate to the nearest values
    round(): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  Math.round(this.x),
            y:  Math.round(this.y)
        });
    }

    // Round a coordinate down to integral values
    floor(): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  Math.floor(this.x),
            y:  Math.floor(this.y)
        });
    }

    // Round a coordinate up to integral values
    ceil(): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  Math.ceil(this.x),
            y:  Math.ceil(this.y)
        });
    }

    // Minimum of the coordinate and others
    min(...coords: DysonMapCoordinate[]): DysonMapCoordinate {
        return new DysonMapCoordinate({
            x:  Math.min(this.x, ...coords.map(coord => coord.x)),
            y:  Math.min(this.y, ...coords.map(coord => coord.y))
        });
    }

    // Split a coordinate into integral and signed fraction parts
    quantize(): [DysonMapCoordinate, DysonMapCoordinate] {
        const int = this.round();
        const frac = this.sub(int);
        return [int, frac];
    }

    // Test for equality
    equals(other: DysonMapCoordinate): boolean {
        return this.x === other.x && this.y === other.y;
    }

    // Test whether within a bounding box (lower inclusive, upper exclusive)
    inBounds(min: DysonMapCoordinate, max: DysonMapCoordinate): boolean {
        return min.x <= this.x && this.x < max.x
            && min.y <= this.y && this.y < max.y;
    }

    // String representation of the coordinate
    toString(): string {
        return `(${this.x}, ${this.y})`;
    }

    // Bounding box for a collection of coordinates
    static boundingBox(coords: DysonMapCoordinate[]): [DysonMapCoordinate, DysonMapCoordinate] {
        if (!coords.length) throw new Error('Attempting to calculate bounding box of empty array');
        const allX = coords.map(coord => coord.x);
        const allY = coords.map(coord => coord.y);
        return [
            new DysonMapCoordinate({ x: Math.min(...allX), y: Math.min(...allY) }),
            new DysonMapCoordinate({ x: Math.max(...allX), y: Math.max(...allY) })
        ];
    }

    // Mean of a collection of coordinate
    static mean(coords: DysonMapCoordinate[]): DysonMapCoordinate {
        if (!coords.length) throw new Error('Attempting to calculate mean of empty array');
        const mean = (values: number[]): number =>
            values.reduce((prev, current) => prev + current, 0) / values.length;
        return new DysonMapCoordinate({
            x:  mean(coords.map(coord => coord.x)),
            y:  mean(coords.map(coord => coord.y))
        });
    }

    // Useful constants
    static readonly ZERO = new DysonMapCoordinate([0, 0]);
    static readonly ONE = new DysonMapCoordinate([1, 1]);
}