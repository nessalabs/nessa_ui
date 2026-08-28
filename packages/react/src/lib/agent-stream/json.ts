/** @responsibility Narrows values decoded from a wire, where the compiler's types have already been erased. */

/**
 * A value as it arrives from `JSON.parse`.
 *
 * Shared rather than provider-scoped: every wire this library reads is JSON,
 * and the readers below are how a provider module gets from a decoded blob to
 * its own declared shapes.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue }

/**
 * Why these exist at all.
 *
 * Everything past `JSON.parse` is `unknown` at runtime — TypeScript's types are
 * erased, so a declared shape is a *claim* about the bytes, not a check on
 * them. There are exactly three ways to bridge that: assert and hope, validate
 * with a schema library, or narrow. Asserting turns one malformed line into a
 * crash somewhere far away; a schema library performs these same checks with a
 * dependency and a per-line cost on the hottest path in the parser.
 *
 * So: narrow — but narrow *once*, here, behind names. Scattering `typeof`
 * through the mapper is the thing worth objecting to; a handful of named
 * readers used consistently is not. Each returns `null` for "not that shape",
 * so a caller uses `??` to state its fallback rather than branching.
 */

/** The value as a string, or null. */
export function asString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null
}

/** The value as a finite number, or null. Rejects NaN, which JSON cannot carry but a producer can still imply. */
export function asNumber(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** The value as a boolean, or null — distinct from `false`, which some flags mean. */
export function asBoolean(value: JsonValue | undefined): boolean | null {
  return typeof value === "boolean" ? value : null
}

/**
 * The value as a plain object, or an empty one.
 *
 * Empty rather than null because every caller wants to read a field from it and
 * `{}` reads a missing field as missing — the same answer an absent object
 * should give.
 */
export function asRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, JsonValue>
}

/**
 * The value as an object, or null when it is anything else — including absent.
 *
 * The strict counterpart of [`asRecord`]: use this where "no object here" and
 * "an object with nothing in it" must stay different answers. Usage is the
 * case that matters — an absent block means the line reported nothing, and
 * flattening it to `{}` turns every counter into a confident zero.
 */
export function asObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, JsonValue>
}

/** The value as an array, or an empty one, for the same reason. */
export function asArray(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : []
}

/** The value as an array of strings, dropping anything that is not one. */
export function asStrings(value: JsonValue | undefined): readonly string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === "string")
}

/**
 * The value if it is one of `allowed`, else null.
 *
 * The bridge from a wire's open vocabulary to a closed union: a status the
 * provider invents tomorrow is rejected here rather than widening a field the
 * rest of the code has already promised is one of a few things.
 */
export function asOneOf<T extends string>(
  value: JsonValue | undefined,
  allowed: readonly T[],
): T | null {
  const text = asString(value)
  return text !== null && (allowed as readonly string[]).includes(text) ? (text as T) : null
}
