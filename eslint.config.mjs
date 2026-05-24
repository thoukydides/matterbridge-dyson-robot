// @ts-check
/* eslint-disable max-len */
import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import semver from 'semver';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Disable deprecation warnings when building against Matterbridge prereleases
const matterbridgePackagePath = fileURLToPath(new URL('node_modules/matterbridge/package.json', import.meta.url));
/** @type { { version: string } } */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const matterbridgePackage = JSON.parse(readFileSync(matterbridgePackagePath, 'utf-8'));
const isMatterbridgePrerelease = semver.prerelease(matterbridgePackage.version) !== null;

// ESLint options
export default defineConfig(
    // ESLint recommended rules
    eslint.configs.recommended,
    // typescript-eslint strict and stylistic rules
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        files: ['**/*.ts', 'eslint.config.mjs'],
        languageOptions: {
            globals:        globals.node,
            ecmaVersion:    'latest',
            sourceType:     'module',
            parserOptions: {
                projectService:         true
            }
        },
        rules: {
            '@typescript-eslint/no-unused-vars':                ['error', { args: 'all', argsIgnorePattern: '^_',  'varsIgnorePattern': '^_', ignoreRestSiblings: true }],
            '@typescript-eslint/restrict-template-expressions': ['error', { allowBoolean: true, allowNullish: true, allowNumber: true}],
            'brace-style':                                      ['warn', '1tbs', { allowSingleLine: true }],
            'comma-dangle':                                     ['warn', 'never'],
            'comma-spacing':                                    ['error'],
            'curly':                                            ['off'],
            'eqeqeq':                                           ['warn'],
            'indent':                                           ['warn', 4, {
                SwitchCase:             0,
                FunctionDeclaration:    { parameters:   'first' },
                FunctionExpression:     { parameters:   'first' },
                CallExpression:         { arguments:    'first' },
                ImportDeclaration:      'first',
                ArrayExpression:        'first',
                ignoredNodes:           ['ConditionalExpression']
            }],
            'lines-between-class-members':                      ['warn', 'always', { exceptAfterSingleLine:  true }],
            'max-len':                                          ['warn', 140],
            'no-trailing-spaces':                               ['warn'],
            'prefer-arrow-callback':                            ['warn'],
            'quotes':                                           ['warn', 'single', { avoidEscape: true }],
            'semi':                                             ['warn'],
            // Special rules for this project
            '@typescript-eslint/no-explicit-any':               ['error', { ignoreRestArgs: true }],
            '@typescript-eslint/no-deprecated':                 [isMatterbridgePrerelease ? 'off' : 'error']
        }
    }, {
        files: ['**/*-types.ts'],
        rules: {
            '@typescript-eslint/consistent-indexed-object-style':   'off'
        }
    }, {
        ignores: [ '**/ti/' ]
    }
);