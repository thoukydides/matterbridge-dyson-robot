// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { MaybePromise } from 'matterbridge/matter';
import { isDeepStrictEqual } from 'util';
import { formatList } from './utils.js';

// Include a 'changed: Changed' instance in class to detect value changes
type ChangedKey = string | symbol;
export class Changed {

    // The previous values
    readonly prevValues = new Map<ChangedKey, unknown>();

    // Construct a new value change tracker
    constructor(readonly log: AnsiLogger) {}

    // Check if the value has changed
    isChanged(key: ChangedKey, newValue: unknown): boolean {
        const oldValue = this.prevValues.get(key);
        const changed = !isDeepStrictEqual(oldValue, newValue);
        if (changed) {
            this.log.debug(`${String(key)} changed: ${diffChanged(oldValue, newValue)}`);
            this.setLast(key, newValue);
        }
        return changed;
    }

    // Set the last value
    setLast(key: ChangedKey, value: unknown): void {
        this.prevValues.set(key, structuredClone(value));
    }

    // Flush previous values, so anything new is considered a change
    flush(key?: ChangedKey): void {
        if (key) this.prevValues.delete(key);
        else this.prevValues.clear();
    }
}

// Decorator to only invoke method if the parameter value has changed
export function ifValueChanged<T extends { changed: Changed }, V, R extends MaybePromise>(
    originalMethod: (this: T, value: V) => R,
    context:        ClassMethodDecoratorContext
): (this: T, value: V) => R {
    function replacementMethod(this: T, value: V): R {
        if (this.changed.isChanged(context.name, value)) {
            return originalMethod.call(this, value);
        }
        // Must return a Promise in async context, but also safe when R is void
        return Promise.resolve() as unknown as R;
    }
    return replacementMethod;
}

// Diff two values (that are not equal)
function diffChanged(oldValue: unknown, newValue: unknown): string {
    const isObject = (value: unknown): value is object =>
        typeof value === 'object' && value !== null;
    const stringify = (value: unknown): string => JSON.stringify(value);

    // Handle non-object comparisons
    if (!isObject(oldValue) || !isObject(newValue)) {
        return `${stringify(oldValue)} → ${stringify(newValue)}`;
    }

    // Compare the individual properties of objects
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    const diffs = [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])]
        .filter(key => !isDeepStrictEqual(oldObj[key], newObj[key]))
        .map(key => `${key}: ${stringify(oldObj[key])} → ${stringify(newObj[key])}`);
    return formatList(diffs);
}