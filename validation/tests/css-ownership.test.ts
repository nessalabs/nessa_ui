import assert from "node:assert/strict"
import test from "node:test"

import postcss from "postcss"
import { hasUnscopedUniversal, importsExactly, ruleOwnsGlobalReset, selectorOwnership } from "../nessa/checks/css-ownership.ts"

test("selector AST distinguishes body and universal nodes from text", () => {
  assert.deepEqual(selectorOwnership("body, :where(*)"), { body: true, universal: true })
  assert.deepEqual(selectorOwnership('.body, #body, [data-part="body"]'), { body: false, universal: false })
  assert.deepEqual(selectorOwnership("custom-body"), { body: false, universal: false })
  assert.throws(() => selectorOwnership("body["))
})

test("built CSS distinguishes Tailwind variable initialization/scoped variants from global resets", () => {
  const rules = (css: string) => {
    const result: boolean[] = []
    postcss.parse(css).walkRules((rule) => { result.push(ruleOwnsGlobalReset(rule)) })
    return result
  }
  assert.deepEqual(rules("*{--tw-ring:0}.dark\\:x:is(.dark *){color:red}"), [false, false])
  assert.deepEqual(rules("*{box-sizing:border-box} body{margin:0}"), [true, true])
  assert.deepEqual(rules(":where(*){margin:0}"), [true])
  assert.equal(hasUnscopedUniversal("*:not(.keep)"), true)
  assert.equal(hasUnscopedUniversal(".host *"), false)
  assert.equal(hasUnscopedUniversal(":where(.host *)"), false)
  assert.equal(hasUnscopedUniversal(":not(.keep) *"), true)
  assert.equal(hasUnscopedUniversal("html *"), true)
})

test("CSS import allowlists reject additions, omissions, and reordering", () => {
  const expected = ["tailwindcss/theme.css", "./theme.css", "tailwindcss/utilities.css"]
  assert.equal(importsExactly(expected, expected), true)
  assert.equal(importsExactly([...expected, "reset.css"], expected), false)
  assert.equal(importsExactly(expected.slice(1), expected), false)
  assert.equal(importsExactly([...expected].reverse(), expected), false)
})

test("body ownership is represented by a parsed rule, never comment text", () => {
  let realBody = false
  postcss.parse("/* body { @apply bg-background text-foreground } */\nbody { @apply bg-background text-foreground; }").walkRules((rule) => { if (selectorOwnership(rule.selector).body) realBody = true })
  assert.equal(realBody, true)
  let commentOnly = false
  postcss.parse("/* body { @apply bg-background text-foreground } */").walkRules((rule) => { if (selectorOwnership(rule.selector).body) commentOnly = true })
  assert.equal(commentOnly, false)
})
