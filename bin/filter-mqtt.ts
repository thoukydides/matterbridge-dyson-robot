// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

// Read the log file from stdin
const log = readFileSync(0).toString();

// Filter out messages that only differ by timestamp or message identifier
const prevByMethod = new Map<string, object>();
for (const line of log.split('\n')) {
    if (!line.trim()) continue;

    // Parse the payload
    const payload = JSON.parse(line) as unknown;
    if (typeof payload !== 'object' || payload === null) throw new Error(`Not a JSON object: ${line}`);

    // Remove timestamps and message identifiers
    if ('time'          in payload) delete payload.time;
    if ('msgId'         in payload) delete payload.msgId;
    if ('mode-reason'   in payload) delete payload['mode-reason'];

    // Determine an identifier for this message type
    let key: string | undefined;
    if ('msg'    in payload && typeof payload.msg    === 'string') key = payload.msg;
    if ('method' in payload && typeof payload.method === 'string') {
        key = `${'version' in payload ?  'Command' : 'Status'} ${payload.method}`;
    }

    // Skip duplicate messages
    if (key) {
        const prev = prevByMethod.get(key);
        if (prev && isDeepStrictEqual(payload, prev)) continue;
        prevByMethod.set(key, payload);
    }

    // Skip uninteresting messages
    if ('params' in payload && typeof payload.params === 'object' && payload.params !== null) {
        const params = Object.keys(payload.params);
        if (params.length === 1 && params[0] === 'cur_path') continue;
    }
    if ('globalPosition' in payload) continue;

    // Output the filtered log entry
    console.log(line);
}