// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import {
    BasicType,
    CheckerT,
    ICheckerSuite,
    TEnumLiteral,
    TEnumType,
    TIface,
    TIntersection,
    TLiteral,
    TName,
    TOptional,
    TType,
    TUnion
} from 'ts-interface-checker';
import { basicTypes, TypeSpec } from 'ts-interface-checker/dist/types.js';

// The type checked by a CheckerT
export type TiExtract<T> = T extends CheckerT<infer V> ? V : never;

// Value of a string tag property from a CheckerT
export type TiExtractTag<T, P extends PropertyKey> =
    T extends CheckerT<infer V>
    ? P extends keyof V
      ? NonNullable<V[P]> extends infer N
        ? string extends N
          ? never
          : N extends string ? N : never
        : never
      : never
    : never;

// Type names in an ICheckerSuite
export type TiCheckerTypeName<T extends ICheckerSuite> =
    keyof {
        [K in keyof T as T[K] extends CheckerT<unknown> ? K : never]: true;
    };

// Map of tag values to types checked by an ICheckerSuite
export type TiSuiteTagType<T extends ICheckerSuite, P extends PropertyKey> = {
    [K in keyof T as TiExtractTag<T[K], P>]: TiExtract<T[K]>;
};
export type TiSuiteTypeFor<T extends ICheckerSuite, P extends PropertyKey, V extends TiSuiteTag<T, P> = TiSuiteTag<T, P>> =
    TiSuiteTagType<T, P>[V];

// String tag property values in types checked by an ICheckerSuite
export type TiSuiteTag<T extends ICheckerSuite, P extends PropertyKey> =
    keyof TiSuiteTagType<T, P>;

// Error for a missing tag property
export class TiError extends Error {
    constructor(readonly typeName: string, readonly problem: string) {
        super(`Type '${typeName}' error: ${problem}`);
        this.name = 'TiError';
    }
}
export class TiMissingPropertyError extends TiError {
    constructor(readonly key: PropertyKey, typeName: string) {
        super(typeName, `Property '${key.toString()}' does not exist`);
        this.name = 'TiMissingPropertyError';
    }
}

// Representation of an (optionally undefined) string union's values
export const TI_ANY_STRING = Symbol('string');
export const TI_NON_LITERAL = new Set([TI_ANY_STRING, undefined]);
export type TiStringUnionElement = string | undefined | typeof TI_ANY_STRING;
export type TiStringUnion = Set<TiStringUnionElement>;

// Identify the types that a specified object type is derived from
export function getTiBaseTypes<T extends ICheckerSuite>(
    suite:      ICheckerSuite,
    typeSpec:   TypeSpec,
    name?:      string
): Set<TiCheckerTypeName<T>> {
    const { type, aliases } = resolveTiTypeSpec(suite, typeSpec, name);

    // Collect base types from a list of type specifications
    const resolveBaseTypes = (typeSpecs: TypeSpec[]): Set<TiCheckerTypeName<T>> =>
        typeSpecs.reduce(
            (acc, spec) => acc.union(getTiBaseTypes(suite, spec)),
            new Set<TiCheckerTypeName<T>>());

    // Process this type instance
    if (type instanceof TIface) {
        // Base types of an interface
        return aliases.union(resolveBaseTypes(type.bases));
    } else if (type instanceof TUnion || type instanceof TIntersection) {
        // Types in a union or intersection
        return aliases.union(resolveBaseTypes(type.ttypes));
    } else {
        // Not an object type
        return new Set();
    }
}

// Evaluate an (optionally undefined) string union property
// (returns empty set if property does not exist)
export function getTiStringUnionProperty(
    suite:      ICheckerSuite,
    typeSpec:   TypeSpec,
    key:        string,
    name?:      string
): TiStringUnion {
    const { type, typeName } = resolveTiTypeSpec(suite, typeSpec, name);

    // Collect property union values from a list of type specifications
    const resolvePresentProperties = (typeSpecs: TypeSpec[]): TiStringUnion[] => {
        const values: TiStringUnion[] = [];
        for (const spec of typeSpecs) {
            try {
                values.push(getTiStringUnionProperty(suite, spec, key));
            } catch (err) {
                if (!(err instanceof TiMissingPropertyError)) throw err;
            }
        }
        return values;
    };

    // Process this type instance
    if (type instanceof TIface) {
        // Intersect values across the local definition and all base classes
        const values = resolvePresentProperties(type.bases);
        const prop = type.props.find(p => p.name === key);
        if (prop) {
            values.push(getTiStringUnion(suite, prop.ttype, `${typeName}.${key}`)
                .union(new Set(prop.isOpt ? [undefined] : [])));
        }
        const [first, ...rest] = values;
        if (!first) throw new TiMissingPropertyError(key, typeName);
        return rest.reduce<TiStringUnion>((acc, v) => stringIntersection(acc, v), first);
    } else if (type instanceof TUnion) {
        // Union aggregates any valid matched property branches
        const values = resolvePresentProperties(type.ttypes);
        if (values.length === 0) throw new TiMissingPropertyError(key, typeName);
        return values.reduce<TiStringUnion>((acc, v) => stringUnion(acc, v), new Set());
    } else if (type instanceof TIntersection) {
        // Intersection narrows constraints across all types providing the key
        const values = resolvePresentProperties(type.ttypes);
        const [first, ...rest] = values;
        if (!first) throw new TiMissingPropertyError(key, typeName);
        return rest.reduce<TiStringUnion>((acc, v) => stringIntersection(acc, v), first);
    } else {
        throw new TiError(typeName, `Incompatible with a '${key}' tagged object`);
    }
}

// Evaluate an (optionally undefined) string union type
export function getTiStringUnion(
    suite:      ICheckerSuite,
    typeSpec:   TypeSpec,
    name?:      string
): TiStringUnion {
    const { type, typeName } = resolveTiTypeSpec(suite, typeSpec, name);

    // Process this type instance
    if (type instanceof TLiteral && typeof type.value === 'string') {
        // String literal is a single-value
        return new Set([type.value]);
    } else if (type instanceof TUnion) {
        // Set of string literals in any member of the union
        return type.ttypes.reduce<TiStringUnion>(
            (acc, t) => stringUnion(acc, getTiStringUnion(suite, t)),
            new Set());
    } else if (type instanceof TIntersection) {
        // Set of string literals in all members of the intersection
        const [first, ...rest] = type.ttypes;
        if (!first)                             throw new TiError(typeName, 'Intersection type has no members');
        return rest.reduce<TiStringUnion>(
            (acc, t) => stringIntersection(acc, getTiStringUnion(suite, t)),
            getTiStringUnion(suite, first));
    } else if (type instanceof TEnumType) {
        // All enum values, unless any are numeric
        const enumHasNumericValues = [...type.validValues].some(v => typeof v === 'number');
        if (enumHasNumericValues)               throw new TiError(typeName, 'Enum type has numeric values');
        return new Set([...type.validValues] as string[]);
    } else if (type instanceof TEnumLiteral) {
        // A single enum literal value
        const { type: enumType } = resolveTiTypeSpec(suite, type.enumName);
        if (!(enumType instanceof TEnumType))   throw new TiError(typeName, 'Invalid enum literal type');
        const value = enumType.members[type.prop];
        if (value === undefined)                throw new TiError(`${typeName}.${type.prop}`, 'Invalid enum literal');
        if (typeof value === 'number')          throw new TiError(`${typeName}.${type.prop}`, 'Enum literal is numeric');
        return new Set([value]);
    } else if (type instanceof TOptional) {
        // An optional property is equivalent to a union with undefined
        return getTiStringUnion(suite, type.ttype, name).union(new Set([undefined]));
    } else if (type instanceof BasicType) {
        // Only a few primitive types can be converted to string unions
        switch (type) {
        case basicTypes.string:     return new Set([TI_ANY_STRING]);
        case basicTypes.undefined:  return new Set([undefined]);
        case basicTypes.never:      return new Set();
        default:                                throw new TiError(typeName, 'Primitive type is incompatible with a string union');
        }
    } else {
        throw new TiError(typeName, 'Type is incompatible with a string union');
    }
}

// Resolve a type specification to a type and its most specific name
export function resolveTiTypeSpec<T extends ICheckerSuite>(
    suite:      T,
    typeSpec:   TypeSpec,
    typeName    = '<AnonymousType>'
): { type: TType, typeName: string, aliases: Set<TiCheckerTypeName<T>> } {
    const isCheckerType = (typeName: string): typeName is TiCheckerTypeName<T> => typeName in suite;
    const aliases = new Set<TiCheckerTypeName<T>>;
    while (!(typeSpec instanceof TType) || typeSpec instanceof TName) {
        // Resolve a named type
        typeName = typeSpec instanceof TName ? typeSpec.name : typeSpec;
        const basicType = basicTypes[typeName];
        if (basicType) {
            typeSpec = basicType;
        } else {
            const checker = suite[typeName];
            if (!isCheckerType(typeName) || !checker) throw new TiError(typeName, 'Type not found in Checker suite');
            aliases.add(typeName);
            typeSpec = checker.getType();
        }
    }

    // If the type has its own name then use it
    if ('name' in typeSpec && typeof typeSpec.name === 'string') typeName = typeSpec.name;
    return { type: typeSpec, typeName, aliases };
}

// Set operations on string unions (handling TI_NON_LITERAL values correctly)
function stringIntersection(a: TiStringUnion, b: TiStringUnion): TiStringUnion {
    const result = a.intersection(b);
    if (!result.has(TI_ANY_STRING)) {
        const literals = (values: TiStringUnion): TiStringUnion => values.difference(TI_NON_LITERAL);
        if (a.has(TI_ANY_STRING)) return result.union(literals(b));
        if (b.has(TI_ANY_STRING)) return result.union(literals(a));
    }
    return result;
}
function stringUnion(a: TiStringUnion, b: TiStringUnion): TiStringUnion {
    const result = a.union(b);
    return result.has(TI_ANY_STRING) ? result.intersection(TI_NON_LITERAL) : result;
}