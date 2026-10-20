// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { Checker, CheckerT, ICheckerSuite, IErrorDetail } from 'ts-interface-checker';
import {
    assertIsDefined,
    columns,
    formatList,
    getValidationTree,
    plural
} from './utils.js';
import {
    TI_ANY_STRING,
    getTiBaseTypes,
    getTiStringUnionProperty,
    TI_NON_LITERAL,
    TiError,
    TiSuiteTypeFor
} from './ti-tagged-utils.js';
import { INSPECT_VERBOSE } from './logger-options.js';
import { inspect } from 'node:util';

// Configuration for a tagged object type checker suite
export interface TiTaggedConfigTagged<TagKey extends string, Tagged extends Partial<Record<TagKey, string>>> {
    path:           string,
    checker:        CheckerT<Tagged>,
    key:            TagKey
}
export interface TiTaggedConfig<Checkers extends ICheckerSuite, TagKey extends string, Tagged extends Partial<Record<TagKey, string>>> {
    description:    string,
    checkerSuite:   Checkers,
    tagged:         TiTaggedConfigTagged<TagKey, Tagged>;
}

// Checker suite for object types with an (optional) discriminating tag property
export class TiTaggedChecker<Checkers extends ICheckerSuite, TagKey extends string, Tagged extends Partial<Record<TagKey, string>>> {

    // Map of tag values to checker names
    readonly tagToName: Map<string, string>;

    // Construct a new checker suite
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    TiTaggedConfig<Checkers, TagKey, Tagged>
    ) {
        // Identify the leaf types and the tags that each type handles
        const typeToLeafType    = this.getTypeLeafMap();
        const typeToTag         = this.getTypeTagMap();

        // Generate mapping from tag values to checker names
        this.tagToName          = this.getTagTypeMap(typeToLeafType, typeToTag);

        // Check for potential problems with the type definitions
        this.checkTagTypeMap(typeToLeafType, typeToTag, this.tagToName);
    }

    // Check that the object is of the general form expected
    assertIsTagged(context: string, value: unknown): asserts value is Tagged {
        const { description, tagged } = this.config;
        const checker = tagged.checker;
        checker.setReportedPath(tagged.path);
        assertWithChecker(this.log, context, description, checker, value, false);
    }

    // Check that the object is a specific tagged type
    assertIsTag(context: string, value: Tagged, defaultTagValue?: string): asserts value is TiSuiteTypeFor<Checkers, TagKey> & Tagged {
        const { checkerSuite, description, tagged } = this.config;

        // Use the tag value from the object, with fallback to the default
        const tagName = `${tagged.path}.${tagged.key}`;
        const tagValue = value[tagged.key] ?? defaultTagValue;
        if (!tagValue) {
            logCheckerValidation(this.log, LogLevel.ERROR, context, value);
            throw new Error(`Unable to determine ${description} ${tagName}`);
        } else if (defaultTagValue && tagValue !== defaultTagValue) {
            this.log.warn(`Unexpected ${description}: ${tagName} = '${tagValue}' ≠ '${defaultTagValue}'`);
        }

        // Find the appropriate checker for this type
        const typeName = this.tagToName.get(tagValue);
        if (!typeName) {
            logCheckerValidation(this.log, LogLevel.ERROR, context, value);
            throw new Error(`Unrecognised ${description}: ${tagName} = '${defaultTagValue}'`);
        }
        const checker = checkerSuite[typeName];
        assertIsDefined(checker);

        // Validate the object using the selected checker
        checker.setReportedPath(typeName);
        assertWithChecker(this.log, context, description, checker, value);
    }

    // Identify the leaf types for each type in the checker suite
    getTypeLeafMap(): Map<string, Set<string>> {
        const { checkerSuite } = this.config;

        // First find the base types for every type
        const typeBases: { name: string, bases: Set<string> }[] = [];
        let nonLeafTypes = new Set<string>();
        const typeLeafMap = new Map<string, Set<string>>();
        for (const name of Object.keys(checkerSuite).sort()) {
            const bases: Set<string> = getTiBaseTypes(checkerSuite, name);
            bases.delete(name); // (exclude self)
            typeBases.push({ name, bases });
            nonLeafTypes = nonLeafTypes.union(bases);
            typeLeafMap.set(name, new Set());
        }

        // Construct a map of the leaf types that are derived from each type
        for (const { name: leafName, bases } of typeBases) {
            if (nonLeafTypes.has(leafName)) continue; // Not a leaf type
            for (const base of bases) typeLeafMap.get(base)?.add(leafName);
        }
        return typeLeafMap;
    }

    // Identify the tag values handled by each type in the checker suite
    getTypeTagMap(): Map<string, Set<string>> {
        const { checkerSuite, description, tagged } = this.config;
        const typeTagMap = new Map<string, Set<string>>();
        const errors: [string, string, string][] = [];
        for (const name of Object.keys(checkerSuite).sort()) {
            try {
                // Identify the tag values that this checker handles
                const tagUnion = getTiStringUnionProperty(checkerSuite, name, tagged.key);
                if (tagUnion.has(TI_ANY_STRING)) throw new TiError(name, "'string' is not a discriminated tag");
                typeTagMap.set(name, tagUnion.difference(TI_NON_LITERAL) as Set<string>); // (remove undefined)
            } catch (err) {
                // Ignore types that are not tagged messages
                if (!(err instanceof TiError)) throw err;
                errors.push([name, err.typeName === name ? '' : err.typeName, err.problem]);
            }
        }

        // Report errors only if no tagged types were identified
        if (typeTagMap.size === 0) {
            this.log.error(`Tag identification failed for all ${plural(errors.length, `${description} type`)}:`);
            columns(errors).forEach(line => { this.log.error(`    ${line}`); });
        }
        return typeTagMap;
    }

    // Generate mapping from tag values to checker names
    getTagTypeMap(typeLeafMap: Map<string, Set<string>>, typeTagMap: Map<string, Set<string>>): Map<string, string> {
        // Generate the mapping from tag values to checker names
        const tagTypeMap = new Map<string, string>();
        const tagTypeMapSet = new Map<string, Set<string>>();
        for (const [base, tags] of typeTagMap.entries()) {
            if (typeLeafMap.get(base)?.size) continue; // Exclude non-leaf types
            for (const tag of tags) {
                tagTypeMap.set(tag, base);
                let checkerTypes = tagTypeMapSet.get(tag);
                if (!checkerTypes) tagTypeMapSet.set(tag, checkerTypes = new Set());
                checkerTypes.add(base);
            }
        }

        // Check that there is only a single checker for each tag
        const problems: [string, string][] = [];
        for (const [tag, checkerTypes] of tagTypeMapSet.entries()) {
            if (checkerTypes.size === 1) continue;
            problems.push([tag, formatList([...checkerTypes])]);
        }
        if (problems.length) {
            const { description } = this.config;
            this.log.error(`Multiple checker types defined for ${plural(problems.length, `${description} tag`)}:`);
            columns(problems).forEach(line => { this.log.error(`    ${line}`); });
        }
        return tagTypeMap;
    }

    // Check whether the type mapping is self-consistent
    checkTagTypeMap(typeLeafMap: Map<string, Set<string>>, typeTagMap: Map<string, Set<string>>, tagNameMap: Map<string, string>): void {
        // Identify the leaf types being checked (have mappings from tag values)
        const checkedTypes = new Set(tagNameMap.values());

        // Check every tagged type
        const problems: [string, string, string | Iterable<string>][] = [];
        const typeStems = new Set<string>();
        for (const [base, tags] of typeTagMap.entries()) {
            const leafTypes = typeLeafMap.get(base);
            if (leafTypes?.size) {
                // Verify that non-leaf types are used by exactly one checker
                const usedBy = [...leafTypes.intersection(checkedTypes)].sort();
                if (usedBy.length === 0)    problems.push([base, 'Not in any checked types', tags]);
                else if (1 < usedBy.length) problems.push([base, 'Appears in multiple checked types', usedBy]);
            } else {
                // Verify that leaf types include the tag value in their name
                const pascalTags = [...tags].map(heterogeneousToPascalCase);
                const commonTag = longestPrefix(pascalTags);
                const tagIndex = base.lastIndexOf(commonTag);
                const description = `'${commonTag}' for ${formatList([...tags].sort())}`;
                if (tagIndex === -1) {
                    problems.push([base, 'Type name does not include tag', description]);
                } else {
                    typeStems.add(base.substring(0, tagIndex));
                    if (tags.size === 1 && tagIndex + commonTag.length !== base.length) {
                        problems.push([base, 'Type name does not end with tag', description]);
                    }
                }
            }
        }

        // Verify that leaf types share a common stem
        if (1 < typeStems.size) problems.push(['*', 'Type names have multiple stems', typeStems]);

        // Report any problems found
        if (problems.length) {
            const { description } = this.config;
            this.log.error(`${plural(problems.length, 'problem')} found in ${description} type suite:`);
            const formatDetail = (list: string[]): string =>
                formatList(4 < list.length ? [...list.slice(0, 3), `... ${list.length - 3} more`] : list);
            const rows = problems.map(([base, problem, detail]) =>
                [base, problem, typeof detail === 'string' ? detail : formatDetail([...detail].sort())]);
            columns(rows).forEach(line => { this.log.error(`    ${line}`); });
        }
    }
}

// Type assertion using a CheckerT
export function assertWithChecker<T extends Checker>(
    log:            AnsiLogger,
    context:        string,
    description:    string,
    checker:        T,
    value:          unknown,
    strict          = true
): asserts value is T extends CheckerT<infer V> ? V : unknown {
    const validation = checker.validate(value);
    if (validation) {
        logCheckerValidation(log, LogLevel.ERROR, context, value, validation);
        throw new Error(`Unexpected structure of ${description}`);
    }
    const strictValidation = checker.strictValidate(value);
    if (strict && strictValidation) {
        logCheckerValidation(log, LogLevel.WARN, context, value, strictValidation);
        // (Continue processing messages that include unexpected properties)
    }
}

// Log checker validation errors
export function logCheckerValidation(
    log:        AnsiLogger,
    level:      LogLevel,
    context:    string,
    payload:    unknown,
    errors?:    IErrorDetail[]
): void {
    // Log the formatted message
    log.log(level, `${context}:`);
    if (errors) {
        const validationLines = getValidationTree(errors);
        validationLines.forEach(line => { log.log(level, line); });
    }
    const payloadLines = inspect(payload, INSPECT_VERBOSE).split('\n');
    payloadLines.forEach(line => { log.info(`    ${line}`); });
}

// Find the longest sequence of words that prefix all of a set of strings
function longestPrefix(strings: Iterable<string>): string {
    const [first, ...rest] = strings;
    if (first === undefined) return '';
    const words = first.split(/(?<=[a-z])(?=[A-Z])|(?=[A-Z][a-z])/);
    const prefix = rest.reduce((prefix, string) => {
        while (!string.startsWith(prefix.join(''))) prefix.pop();
        return prefix;
    }, words);
    return prefix.join('');
}

// Convert a string from delimiter or letter-case separated words to PascalCase
function heterogeneousToPascalCase(str: string): string {
    const words = str.split(/[^A-Za-z]+(?=[A-Za-z])|(?<=[a-z])(?=[A-Z])|(?=[A-Z][a-z])/);
    const titleWords = words.map(w => w.substring(0, 1).toUpperCase() + w.substring(1).toLowerCase());
    return titleWords.join('');
}