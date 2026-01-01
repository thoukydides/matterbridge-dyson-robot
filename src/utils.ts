// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import assert from 'assert';
import EventEmitter from 'events';
import { MaybePromise } from 'matterbridge/matter';
import { IErrorDetail } from 'ts-interface-checker';

// Milliseconds in a second
export const MS = 1000;

// A mixin class must have a constructor with a single rest parameter of type 'any[]'.ts(2545)
export type Constructor        <T = object> =          new (...args: any[]) => T;
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;

// Convert a union type into an intersection
export type UnionToIntersection<U> =
    (U extends unknown ? (x: U) => unknown : never) extends (x: infer I) => unknown ? I : never;

// Type assertions
export function assertIsDefined<Type>(value: Type): asserts value is NonNullable<Type> {
    assert.notStrictEqual(value, undefined);
    assert.notStrictEqual(value, null);
}
export function assertIsNotUndefined<Type>(value: Type): asserts value is Exclude<Type, undefined> {
    assert.notStrictEqual(value, undefined);
}
export function assertIsBoolean(value: unknown): asserts value is boolean {
    assert.strictEqual(typeof value, 'boolean');
}
export function assertIsNumber(value: unknown): asserts value is number {
    assert.strictEqual(typeof value, 'number');
}
export function assertIsInstanceOf<Type extends object>(value: unknown, type: Constructor<Type>): asserts value is Type {
    assert(value instanceof type, `Not an instance of ${type.name}`);
}

// Format a milliseconds duration
export function formatMilliseconds(ms: number, maxParts = 2): string {
    if (ms < 1) return 'n/a';

    // Split the duration into components
    const duration: [string, number][] = [
        ['day',         Math.floor(ms / (24 * 60 * 60 * MS))     ],
        ['hour',        Math.floor(ms /      (60 * 60 * MS)) % 24],
        ['minute',      Math.floor(ms /           (60 * MS)) % 60],
        ['second',      Math.floor(ms /                 MS ) % 60],
        ['millisecond', Math.floor(ms                      ) % MS]
    ];

    // Remove any leading zero components
    while (duration[0]?.[1] === 0) duration.shift();

    // Combine the required number of remaining components
    return duration.slice(0, maxParts)
        .filter(([_key, value]) => value !== 0)
        .map(([key, value]) => plural(value, key))
        .join(' ');
}

// Format a seconds duration
export function formatSeconds(seconds: number, maxParts = 2): string {
    return formatMilliseconds(seconds * 1000, maxParts);
}

// Format a date as YYYYMMDD or YYYY-MM-DD
export function formatDateISO8601(date: Date, separator: '' | '-'): string {
    const year  =        date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(date.getUTCDate()).padStart(2, '0');
    return [year, month, day].join(separator);
}

// Format a list (with Oxford comma)
export function formatList(items: string[]): string {
    switch (items.length) {
    case 0:     return 'n/a';
    case 1:     return items[0] ?? '';
    case 2:     return `${items[0]} and ${items[1]}`;
    default:    return [...items.slice(0, -1), `and ${items[items.length - 1]}`].join(', ');
    }
}

// Format a counted noun (handling most regular cases automatically)
export function plural(count: number, noun: string | [string, string], showCount = true): string {
    const [singular, plural] = Array.isArray(noun) ? noun : [noun, ''];
    noun = count === 1 ? singular : plural;
    if (!noun) {
        // Apply regular rules
        const rules: [string, string, number][] = [
            ['on$',                 'a',   2], // phenomenon/phenomena criterion/criteria
            ['us$',                 'i',   1], //     cactus/cacti         focus/foci
            ['[^aeiou]y$',          'ies', 1], //        cty/cites         puppy/puppies
            ['(ch|is|o|s|sh|x|z)$', 'es',  0], //       iris/irises        truss/trusses
            ['',                    's',   0]  //        cat/cats          house/houses
        ];
        const rule = rules.find(([ending]) => new RegExp(ending, 'i').test(singular));
        assertIsDefined(rule);
        const matchCase = (s: string): string => singular === singular.toUpperCase() ? s.toUpperCase() : s;
        noun = singular.substring(0, singular.length - rule[2]).concat(matchCase(rule[1]));
    }
    return showCount ? `${count} ${noun}` : noun;
}

// Format strings in columns
export function columns(rows: string[][], separator = '  '): string[] {
    // Determine the required column widths
    const width: number[] = [];
    rows.forEach(row => {
        row.forEach((value, index) => {
            width[index] = Math.max(width[index] ?? 0, value.length);
        });
    });
    width.splice(-1, 1, 0);

    // Format the rows
    return rows.map(row => row.map((value, index) => value.padEnd(width[index] ?? 0)).join(separator));
}

// Recursive object assignment, skipping undefined values
export function deepMerge(...objects: object[]): object {
    const isObject = (value: unknown): value is object =>
        value !== undefined && typeof value === 'object' && !Array.isArray(value);
    return objects.reduce((acc: Record<string, unknown>, object: object) => {
        Object.entries(object).forEach(([key, value]) => {
            const accValue = acc[key];
            if (value === undefined) return;
            if (isObject(accValue) && isObject(value)) acc[key] = deepMerge(accValue, value);
            else acc[key] = value;
        });
        return acc;
    }, {});
}

// Convert checker validation error into lines of text
export function getValidationTree(errors: IErrorDetail[]): string[] {
    const lines: string[] = [];
    errors.forEach((error, index) => {
        const prefix = (a: string, b: string): string => index < errors.length - 1 ? a : b;
        lines.push(`${prefix('├─ ', '└─ ')}${error.path} ${error.message}`);
        if (error.nested) {
            const nested = getValidationTree(error.nested);
            lines.push(...nested.map(line => `${prefix('│  ', '   ')} ${line}`));
        }
    });
    return lines;
}

// Convert any errors in an event listener to 'error' events
export function tryListener<T extends unknown[]>(
    emitter:        EventEmitter,
    op:             (...args: T) => MaybePromise,
    errorHandler:   (err: unknown) => void = (err) => emitter.emit('error', err)
): (...args: T) => void {
    return (...args: T): void => {
        void (async (): Promise<void> => {
            try {
                await op(...args);
            } catch (err) {
                errorHandler(err);
            }
        })();
    };
}