// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import assert from 'node:assert';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Config } from '../dist/config-types.js';
import { once } from 'node:events';

// Spawn command to run Matterbridge (-homedir is added later)
const SPAWN_COMMAND = 'node';
const SPAWN_ARGS = ['node_modules/matterbridge/dist/cli.js'];

// Plugin configuration file for running tests
const PLUGIN_CONFIG_FILE = '.matterbridge/matterbridge-dyson-robot.config.json';
const PLUGIN_CONFIG_CONTENT: Partial<Config> = {
    'debugFeatures': []
};

// Log messages indicating success or failure
interface Test {
    name:   string,
    regexp: RegExp
}
const SUCCESS_TESTS: Test[] = [
    { name: 'Discovery',    regexp: /\[Dyson Robot\] \d+ devices in account, [1-9]\d* device[s]? selected/ },
    { name: 'Registered',   regexp: /\[Dyson Robot\] Registered [1-9]\d* Dyson device/ },
    { name: 'Configured',   regexp: /\[Dyson Robot\] Configured [1-9]\d* Dyson device/ }
];
const FAILURE_TESTS: Test[] = [
    { name: 'MQTT Checker', regexp: /MQTT topic '.*':\s*$/ },
    { name: 'API Checker',  regexp: / (GET|POST) \// }
];

// Match ANSI colour codes so that they can be stripped
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1B\[[0-9;]*[msuK]/g;

// Length of time to wait
const TIMEOUT_MATTERBRIDGE_MS = 45 * 1000; // 45 seconds

// Register the plugin with Matterbridge
async function configureAndRegisterPlugin(): Promise<void> {

    // Create a temporary directory for Matterbridge to use as its home directory
    const matterbridgeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matterbridge-test-'));
    SPAWN_ARGS.push('-homedir', matterbridgeDir);

    // Create a plugin configuration file
    const pluginConfigFile = path.join(matterbridgeDir, PLUGIN_CONFIG_FILE);
    await fs.mkdir(path.dirname(pluginConfigFile), { recursive: true });
    await fs.writeFile(pluginConfigFile, JSON.stringify(PLUGIN_CONFIG_CONTENT, null, 4));

    // Register the plugin with Matterbridge
    const child = spawn(SPAWN_COMMAND, [...SPAWN_ARGS, '-add', '.'], {
        stdio:      'ignore',
        timeout:    TIMEOUT_MATTERBRIDGE_MS
    });
    await once(child, 'exit');
}

// Run the plugin test
let rawOutput = '';
async function testPlugin(): Promise<void> {
    // Launch Matterbridge, piping stdout and stderr for monitoring
    const child = spawn(SPAWN_COMMAND, SPAWN_ARGS, {
        stdio:      'pipe',
        timeout:    TIMEOUT_MATTERBRIDGE_MS
    });

    // Monitor stdout and stderr until they close
    let remainingTests = SUCCESS_TESTS;
    let failureTest: Test | undefined;
    const testOutputStream = async (
        child: ChildProcessWithoutNullStreams,
        streamName: 'stdout' | 'stderr'
    ): Promise<void> => {
        const stream = child[streamName];
        stream.setEncoding('utf8');
        for await (const chunk of stream) {
            assert(typeof chunk === 'string');
            rawOutput += chunk.toString();

            // Check for any of the success or failure log messages
            const cleanChunk = chunk.toString().replace(ANSI_ESCAPE, '');
            failureTest ??= FAILURE_TESTS.find(({ regexp }) => regexp.test(cleanChunk));
            remainingTests = remainingTests.filter(({ regexp }) => !regexp.test(cleanChunk));
            if (remainingTests.length === 0) child.kill('SIGTERM');
        }
    };
    await Promise.all([
        testOutputStream(child, 'stdout'),
        testOutputStream(child, 'stderr')
    ]);

    // Check whether the test was successful
    if (child.exitCode !== null) {
        throw new Error(`Process exited with code ${child.exitCode}`);
    }
    if (failureTest) {
        throw new Error(`Process terminated with test failure: ${failureTest.name}`);
    }
    if (remainingTests.length) {
        const failures = remainingTests.map(t => t.name).join(', ');
        throw new Error(`Process terminated with test failures: ${failures}`);
    }
}

// Run the test
void (async (): Promise<void> => {
    try {

        // Prepare the plugin configuration and register with Matterbridge
        console.log('🔧 Configuring plugin and registering with Matterbridge...');
        await configureAndRegisterPlugin();

        // Run the test
        console.log('🔍 Running Matterbridge plugin test...');
        await testPlugin();

        // If this point is reached, the test was successful
        console.log('🟢 Test successful');

    } catch (err) {

        // The test failed so log the command output
        console.log(rawOutput);

        // Extract and log the individual error messages
        const errs = err instanceof AggregateError ? err.errors : [err];
        const messages = errs.map(e => e instanceof Error ? e.message : String(e));
        console.error('🔴 Test failed:\n' + messages.map(m => `    ${m}\n`).join(''));

        // Return a non-zero exit code
        process.exitCode = 1;
    }
})();