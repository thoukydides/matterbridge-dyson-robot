// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import * as core from '@actions/core';
import assert from 'node:assert';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Config, DeviceConfigMock } from '../dist/config-types.js';
import { once } from 'node:events';
import { wr, er, ft } from 'matterbridge/logger';

// Spawn command to run Matterbridge (-homedir is added later)
const SPAWN_COMMAND = 'node';
const SPAWN_ARGS = ['node_modules/matterbridge/dist/cli.js'];

// Plugin configuration file for running tests
const PLUGIN_CONFIG_FILE = '.matterbridge/matterbridge-dyson-robot.config.json';
const PLUGIN_CONFIG_CONTENT: Partial<Config> = {
    debug: true,
    debugFeatures: []
};

// Log messages indicating success or failure
type Tests = Record<string, RegExp>;
const SUCCESS_TESTS: Tests = {
    'Registered':   /\[Dyson Robot\] Registered [1-9]\d* Dyson device/,
    'Configured':   /\[Dyson Robot\] Configured [1-9]\d* Dyson device/
};
const FAILURE_TESTS: Tests = {};

// Regular expression to split into lines (allowing CRLF, CR, or LF)
const LINE_SPLIT_REGEX = /\r\n|(?<!\r)\n|\r(?!\n)/;

// Match ANSI colour codes so that they can be stripped
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1B\[[0-9;]*[msuK]/g;

// ANSI colour codes used for warnings and errors
const ANSI_WARNING = new RegExp([wr, er, ft].join('|').replaceAll('[', '\\['));

// Warnings and errors that should not be treated as test failures
/* eslint-disable max-len */
const IGNORED_WARNINGS: RegExp[] = [
    // https://github.com/matter-js/matter.js/pull/3021
    /\[ThermostatServer\] No local TemperatureMeasurement cluster available and externalMeasuredIndoorTemperature state not set. Setting localTemperature to null/
];
/* eslint-enable max-len */

// Length of time to wait
const TIMEOUT_MATTERBRIDGE_MS = 60 * 1000; // 60 seconds

// Process command line arguments
const [ logsDirectory ] = process.argv.slice(2);

// Register the plugin with Matterbridge
async function configureAndRegisterPlugin(): Promise<void> {

    // Create a temporary directory for Matterbridge to use as its home directory
    const matterbridgeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matterbridge-test-'));
    SPAWN_ARGS.push('-homedir', matterbridgeDir);

    // If a logs directory was specified then use it to mock devices
    const config = PLUGIN_CONFIG_CONTENT;
    if (logsDirectory) {
        const logFiles = await fs.readdir(logsDirectory);
        const devices: DeviceConfigMock[] = logFiles.map((logFile, index) => ({
            name:           `Mock ${path.parse(logFile).name}`,
            serialNumber:   String(index + 1),
            rootTopic:      path.parse(logFile).name.replace(/-.*/, ''),
            filename:       path.join(logsDirectory, logFile)
        }));
        Object.assign(config, { provisioningMethod: 'Mock Devices', devices });
        for (const { name, rootTopic } of devices) {
            const pattern = `\\[Dyson Robot - ${name}\\] End of MQTT log file reached`;
            SUCCESS_TESTS[`Mock ${rootTopic}`] = new RegExp(pattern);
        }
    }

    // Create a plugin configuration file
    const pluginConfigFile = path.join(matterbridgeDir, PLUGIN_CONFIG_FILE);
    await fs.mkdir(path.dirname(pluginConfigFile), { recursive: true });
    await fs.writeFile(pluginConfigFile, JSON.stringify(config, null, 4));

    // Register the plugin with Matterbridge
    const child = spawn(SPAWN_COMMAND, [...SPAWN_ARGS, '-add', '.'], { stdio: 'inherit' });
    const timeout = setTimeout(() => { child.kill('SIGTERM'); }, TIMEOUT_MATTERBRIDGE_MS);
    await once(child, 'exit');
    clearTimeout(timeout);
}

// Run the plugin test
async function testPlugin(): Promise<void> {
    // Launch Matterbridge, piping stdout and stderr for monitoring
    const child = spawn(SPAWN_COMMAND, SPAWN_ARGS, { stdio: 'pipe' });
    const timeout = setTimeout(() => { child.kill('SIGTERM'); }, TIMEOUT_MATTERBRIDGE_MS);

    // Monitor stdout and stderr until they close
    let successTests = Object.keys(SUCCESS_TESTS);
    const failureTests = new Set<string>();
    const testOutputStream = async (
        child: ChildProcessWithoutNullStreams,
        streamName: 'stdout' | 'stderr'
    ): Promise<void> => {
        const stream = child[streamName];
        stream.setEncoding('utf8');

        const currentWarning: string[] = [];
        const flushWarning = (): void => {
            if (currentWarning.length) {
                const warning = currentWarning.join('\n');
                if (!IGNORED_WARNINGS.some(re => re.test(warning))) failureTests.add(`Log warning: ${warning}`);
                currentWarning.length = 0;
            }
        };

        for await (const chunk of stream) {
            assert(typeof chunk === 'string');
            for (const line of chunk.split(LINE_SPLIT_REGEX)) {
                if (!line.trim().length) continue;
                console.log(line);

                // Check for any of the success or failure log messages
                const cleanLine = line.replace(ANSI_ESCAPE, '');
                if (ANSI_WARNING.test(line) || streamName === 'stderr') currentWarning.push(cleanLine);
                else flushWarning();
                Object.entries(FAILURE_TESTS).filter(([, regexp]) => regexp.test(cleanLine))
                    .forEach(([name]) => failureTests.add(`${name}: ${cleanLine}`));
                successTests = successTests.filter(name => !SUCCESS_TESTS[name].test(cleanLine));
                if (successTests.length === 0) child.kill('SIGTERM');
            }
        }
        flushWarning();
    };
    await Promise.all([
        testOutputStream(child, 'stdout'),
        testOutputStream(child, 'stderr'),
        once(child, 'exit')
    ]);
    clearTimeout(timeout);

    // Check whether the test was successful
    const errors: string[] = [];
    if (child.exitCode) errors.push(`Process exited with code ${child.exitCode}`);
    errors.push(...failureTests);
    errors.push(...successTests.map(test => `Missing: ${test} (expected /${SUCCESS_TESTS[test].source}/)`));
    if (errors.length) throw new AggregateError(errors, 'Test failed');
}

// Run the test
void (async (): Promise<void> => {
    try {

        // Prepare the plugin configuration and register with Matterbridge
        await core.group(
            '🔧 Configuring plugin and registering with Matterbridge...',
            configureAndRegisterPlugin);

        // Run the test
        await core.group(
            '🔍 Running Matterbridge plugin test...',
            testPlugin);

        // If this point is reached, the test was successful
        console.log('🟢 Test successful');

    } catch (err) {

        // The test failed so log the command output
        console.error('🔴 Test failed');

        // Extract and log the individual error messages
        const errs = err instanceof AggregateError ? err.errors : [err];
        const messages = errs.map(e => e instanceof Error ? e.message : String(e));
        for (const message of messages) core.error(message);

        // Return a non-zero exit code
        process.exitCode = 1;
    }
})();