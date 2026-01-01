// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { EventEmitter } from 'events';

// Node doesn't use DOMException for AbortError...
class AbortError extends Error {
    constructor(cause: unknown) {
        super('The operation was aborted', { cause });
        this.name = 'AbortError';
    }
}

type EventMap<T> = Record<keyof T, unknown[]>;
type Event<T extends EventMap<T>> = ReturnType<EventEmitter<T>['eventNames']>[number];
type EventArgs<T extends EventMap<T>, K> = K extends keyof T ? T[K] : never;
type ListenerFn<T extends EventMap<T>, K> =
    EventEmitter<T> extends { on(event: K, listener: infer A): unknown } ? A : never;

// An EventEmitter with well-behaved Promisified listeners
export class AsyncEventEmitter<T extends EventMap<T>> extends EventEmitter<T> {

    // Typed event.once() that ignores unrelated errors
    async onceAsync<K extends Event<T>>(eventName: K, signal?: AbortSignal): Promise<EventArgs<T, K>> {
        // Handle already-aborted signal immediately
        if (signal?.aborted) throw new AbortError(signal.reason);

        // Otherwise return a promise that...
        return new Promise((resolve, reject) => {
            // ... resolves when the event occurs
            const resolver = ((...args: EventArgs<T, K>): void => {
                signal?.removeEventListener('abort', abortListener);
                resolve(args);
            }) as ListenerFn<T, K>;
            this.once(eventName, resolver);

            // ... or rejects if the signal is aborted
            const abortListener = (): void => {
                this.off(eventName, resolver);
                reject(new AbortError(signal?.reason));
            };
            signal?.addEventListener('abort', abortListener, { once: true });
        });
    }
}