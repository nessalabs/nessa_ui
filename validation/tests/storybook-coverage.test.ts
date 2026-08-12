import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { analyzeStory, inputStoryIssues, publicComponentModules, storyDocumentsPublicComponent } from "../nessa/checks/storybook-coverage.ts"

const parse = (source: string) => ts.createSourceFile("fixture.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

test("public component discovery excludes non-component and type-only exports", () => {
  const modules = publicComponentModules(parse('export { Button, buttonVariants, type ButtonProps } from "./components/button"'))
  assert.deepEqual(modules.get("button"), ["Button"])
})

test("public component discovery preserves nested module identity", () => {
  const ast = parse('export { Widget } from "./components/nested/widget"')
  assert.deepEqual([...publicComponentModules(ast)], [["nested/widget", ["Widget"]]])
})

test("story analysis requires real meta tags and a named story", () => {
  const valid = analyzeStory(parse('const meta={component: Button, tags:["autodocs","test"]} satisfies Meta; export default meta; export const Playground = {}'))
  assert.equal(valid.hasTaggedMeta, true)
  assert.equal(valid.metaComponent, "Button")
  assert.deepEqual([...valid.namedStories.keys()], ["Playground"])
  const commentOnly = analyzeStory(parse('// tags: ["autodocs", "test"]\nconst meta={}; export default meta'))
  assert.equal(commentOnly.hasTaggedMeta, false)
  assert.equal(commentOnly.metaComponent, null)
  assert.equal(commentOnly.namedStories.size, 0)
  assert.equal(storyDocumentsPublicComponent(valid, ["Button"]), true)
  assert.equal(storyDocumentsPublicComponent(valid, ["Badge"]), false)
})

test("Input accessibility is evaluated independently per required story", () => {
  const valid = analyzeStory(parse(`const meta={tags:["autodocs","test"]}; export default meta;
    export const Playground = {render:()=> <><label htmlFor="story-email">Email</label><Input id="story-email" /></>};
    export const Invalid = {render:()=> <><label htmlFor="invalid-story-email">Email</label><Input id="invalid-story-email" aria-describedby="invalid-story-email-error"/><p id="invalid-story-email-error">Bad</p></>};`))
  assert.deepEqual(inputStoryIssues(valid), [])
  const split = analyzeStory(parse(`const meta={tags:["autodocs","test"]}; export default meta;
    export const Playground = {render:()=> <label htmlFor="story-email">Email</label>};
    export const Invalid = {render:()=> <Input id="story-email" aria-describedby="invalid-story-email-error"/>};`))
  assert.deepEqual(inputStoryIssues(split), ["Playground label association", "Invalid label/error association"])
  const reordered = analyzeStory(parse(`const meta={tags:["autodocs","test"]}; export default meta;
    export const Playground = {render:()=> <><Input id="story-email" />{/* <label htmlFor="wrong" /> */}<label htmlFor="story-email">Email</label></>};
    export const Invalid = {render:()=> <><p id="error">Bad</p><Input aria-describedby="error" id="invalid"/><label htmlFor="invalid">Email</label></>};`))
  assert.deepEqual(inputStoryIssues(reordered), [])
  const selfReference = analyzeStory(parse(`const meta={tags:["autodocs","test"]}; export default meta;
    export const Playground = {render:()=> <><label htmlFor="p">P</label><Input id="p"/></>};
    export const Invalid = {render:()=> <><label htmlFor="i">I</label><Input id="i" aria-describedby="i"/></>};`))
  assert.deepEqual(inputStoryIssues(selfReference), ["Invalid label/error association"])
  const splitControls = analyzeStory(parse(`const meta={tags:["autodocs","test"]}; export default meta;
    export const Playground = {render:()=> <><label htmlFor="p">P</label><Input id="p"/></>};
    export const Invalid = {render:()=> <><label htmlFor="first">I</label><Input id="first"/><Input id="second" aria-describedby="error"/><p id="error">Bad</p></>};`))
  assert.deepEqual(inputStoryIssues(splitControls), ["Invalid label/error association"])
})
