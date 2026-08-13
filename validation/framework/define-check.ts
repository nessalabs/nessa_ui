import { Minimatch } from "minimatch"

import type { CheckDefinition } from "./types.ts"

const GLOB_OPTIONS = {
  dot: true,
  nocase: false,
  nonegate: true,
  nocomment: true,
  noext: true,
} as const

function assertBalanced(pattern: string, open: string, close: string): void {
  let depth = 0
  for (const character of pattern) {
    if (character === open) depth += 1
    if (character === close) depth -= 1
    if (depth < 0) throw new Error(`Invalid glob ${JSON.stringify(pattern)}: unbalanced ${close}`)
  }
  if (depth !== 0) throw new Error(`Invalid glob ${JSON.stringify(pattern)}: unbalanced ${open}`)
}

export function validateGlob(pattern: string): void {
  if (!pattern || pattern.startsWith("!") || pattern.startsWith("#")) {
    throw new Error(`Invalid glob ${JSON.stringify(pattern)}: empty, negated, and comment patterns are unsupported`)
  }
  if (/(^|[^\\])[+*@?!]\(/.test(pattern)) {
    throw new Error(`Invalid glob ${JSON.stringify(pattern)}: extglobs are unsupported`)
  }
  assertBalanced(pattern, "[", "]")
  assertBalanced(pattern, "{", "}")
  new Minimatch(pattern, GLOB_OPTIONS)
}

export function defineCheck(definition: CheckDefinition): CheckDefinition {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new Error(`Invalid check id: ${definition.id}`)
  }
  for (const pattern of definition.inputs) validateGlob(pattern)
  return Object.freeze({
    ...definition,
    inputs: Object.freeze([...definition.inputs]),
    dependsOn: Object.freeze([...definition.dependsOn]),
  })
}

export { GLOB_OPTIONS }
