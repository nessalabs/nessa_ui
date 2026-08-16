import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { classTokens, forbiddenPersistenceAccesses, hostBoundaryAccesses, importedClassSurfaceReferences, isForbiddenPersistenceTarget, isPersistenceIdentifierReference, privateAliasReferences, selectorCanTargetHostRoot } from "../nessa/checks/source-boundaries.ts"

const parse = (source: string) => ts.createSourceFile("fixture.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

test("class-token discovery ignores comments and prose but covers multiline class surfaces", () => {
  const ast = parse(`// dark:comment\nconst prose = "dark:prose --_nessa-private";
    const variants = cva(\`base\n dark:bg-real\`); const view = <div className="dark:text-real" />`)
  assert.deepEqual(classTokens(ast), ["base", "dark:bg-real", "dark:text-real"])
  const aliases = parse(`const focus = "focus-visible:ring-[#fff]"; const mode = "dark:bg-red-500";
    const shared = Object.freeze([focus, mode]); const suffix = "500"; const view = <button className={cn(shared, \`hover:bg-red-\${suffix}\`)} />`)
  assert.deepEqual(classTokens(aliases), ["focus-visible:ring-[#fff]", "dark:bg-red-500", "hover:bg-red-500"])
  assert.deepEqual(classTokens(parse('const first = second; const second = first; const view = <div className={first} />')), [])
  assert.deepEqual(classTokens(parse('const mode="dark:bg-red-500"; const view=<div className={mode}/>; { const mode=getMode() }')), ["dark:bg-red-500"])
  assert.deepEqual(classTokens(parse('{ const mode="dark:bg-red-500"; const view=<div className={mode}/> } const mode="text-safe";')), ["dark:bg-red-500"])
  assert.deepEqual(classTokens(parse('let mode="dark:bg-red-500"; mode=""; const view=<div className={mode}/>;')), [])
  assert.deepEqual(classTokens(parse('const mode="dark:bg-red-500"; function Card(mode:string){ return <div className={mode}/> }')), [])
  assert.deepEqual(classTokens(parse('const mode="dark:bg-red-500"; const Card=(mode:string)=><div className={mode}/>;')), [])
  assert.deepEqual(classTokens(parse('const mode="dark:bg-red-500"; const Card=({ mode }:{mode:string})=><div className={mode}/>;')), [])
  assert.deepEqual(importedClassSurfaceReferences(parse('import { shared } from "./styles"; import { cn } from "./utils"; const view=<div className={cn(shared, "safe")}/>')), ["shared"])
  assert.deepEqual(importedClassSurfaceReferences(parse('import { shared } from "./styles"; const local=shared; const view=<div className={local}/>')), ["shared"])
  assert.deepEqual(importedClassSurfaceReferences(parse('import { shared } from "./styles"; const local=Object.freeze([shared]); const view=<div className={local}/>')), ["shared"])
  assert.deepEqual(importedClassSurfaceReferences(parse('import { shared } from "./styles"; const local=`base ${shared}`; const view=<div className={local}/>')), ["shared"])
  assert.deepEqual(importedClassSurfaceReferences(parse('import { shared } from "./styles"; function Card(shared:string){ return <div className={shared}/> }')), [])
})

test("persistence scan ignores property declarations but catches runtime references", () => {
  const ast = ts.createSourceFile("fixture.ts", "const value = localStorage.getItem('x'); const object = { localStorage: 'label' }", ts.ScriptTarget.ES2022, true)
  const results: boolean[] = []
  ast.forEachChild(function visit(node) {
    if (ts.isIdentifier(node) && node.text === "localStorage") results.push(isPersistenceIdentifierReference(node))
    ts.forEachChild(node, visit)
  })
  assert.deepEqual(results, [true, false])
})

test("qualified IndexedDB and cookieStore access remains forbidden in property and element forms", () => {
  const ast = parse("window.indexedDB.open('x'); globalThis['indexedDB']; window.cookieStore; globalThis['cookieStore']")
  const qualified: string[] = []
  ast.forEachChild(function visit(node) {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) qualified.push(node.getText(ast))
    ts.forEachChild(node, visit)
  })
  assert.ok(qualified.includes("window.indexedDB"))
  assert.ok(qualified.includes("globalThis['indexedDB']"))
  assert.ok(qualified.includes("window.cookieStore"))
  assert.ok(qualified.includes("globalThis['cookieStore']"))
  for (const target of ["window.indexedDB", "globalThis.indexedDB", "window.cookieStore", "globalThis.cookieStore"]) assert.equal(isForbiddenPersistenceTarget(target), true)
  assert.deepEqual(forbiddenPersistenceAccesses(parse("const host = window; host['indexedDB']; const scope = globalThis; scope.cookieStore")), ["globalThis.cookieStore", "window.indexedDB"])
  assert.deepEqual(forbiddenPersistenceAccesses(parse("const { localStorage: store, indexedDB: db } = window; store.setItem('x','y'); db.open('x')")), ["window.indexedDB", "window.localStorage"])
  assert.deepEqual(forbiddenPersistenceAccesses(parse("const { cookie } = document; export const leaked = cookie")), ["document.cookie"])
  assert.deepEqual(forbiddenPersistenceAccesses(parse("const { cookie: value } = document; export const leaked = value")), ["document.cookie"])
})

test("host-root detection covers property, element, globalThis, aliases, assignments, and destructuring", () => {
  for (const source of [
    "document.body", "document['documentElement']", "globalThis.document.body", "window.document['body']",
    "document.body.classList.add('x')", "document.documentElement.dataset.theme = 'dark'",
    "document.querySelector('body')?.classList.add('x')", "document.querySelector('body.app')", "document.querySelector('html[data-theme]')",
    "document.querySelector(':is(body, main)')", "document.querySelector(':root.dark')", "document.querySelectorAll('main, body.foo')",
    "document.querySelector(':root')", "document.getElementsByTagName('html')",
    "const selector='body.foo'; document.querySelector(selector)", "document.querySelector(`body.${kind}`)",
    "const query=document.querySelector.bind(document); query('body')", "const query=document.querySelector; query.call(document, 'body')",
    "const { querySelector: query }=document; query('body')", "const doc=window.document; const { querySelectorAll }=doc; querySelectorAll('body')",
    "const { ['querySelector']: query }=document; query('body')", "const doc=window.document; const method='querySelector'; const { [method]: query }=doc; query('body')",
    "let query; ({ querySelector: query }=document); query('body')", "let query; ({ ['querySelector']: query }=window.document); query('body')",
    "let query; const doc=globalThis.document; ({ [method]: query }=doc); query('body')", "let rest; ({ ...rest }=document); rest.querySelector('body')",
    "const { getElementsByTagName: get }=globalThis.document; get('body')", "document['querySelector']('body')",
    "window.document['querySelectorAll']('html.foo')", "globalThis.document['getElementsByTagName']('body')", "document[method]('body')",
    "const doc = document; doc.body", "let doc; doc = globalThis.document; doc.documentElement", "const { body } = document",
  ]) assert.ok(hostBoundaryAccesses(parse(source)).length > 0, source)
  assert.deepEqual(hostBoundaryAccesses(parse('const prose = "document.body"; // document.documentElement')), [])
  assert.equal(selectorCanTargetHostRoot("main.content > section"), false)
  assert.equal(selectorCanTargetHostRoot("body.app, main"), true)
  assert.deepEqual(hostBoundaryAccesses(parse("document.querySelector('main.content')")), [])
})

test("divergent alias branches terminate and never hide a host root", () => {
  // The same name assigned two harmless values must not spin the alias
  // loop forever…
  assert.deepEqual(hostBoundaryAccesses(parse("let size; size = minSize; size = collapsedSize; use(size)")), [])
  // …and when one branch points at a host root, that branch wins no matter
  // which order the assignments appear in.
  assert.deepEqual(hostBoundaryAccesses(parse("let el; el = document.body; el = other; el.appendChild(x)")), ["document.body"])
  assert.deepEqual(hostBoundaryAccesses(parse("let el; el = other; el = document.body; el.appendChild(x)")), ["document.body"])
})

test("private aliases are detected in copied style/object/property APIs but not prose", () => {
  const references = privateAliasReferences(parse(`const prose = "--_nessa-prose";
    const view = <div style={{ "--_nessa-secret": "red", color: "var(--_nessa-color)" }} />;
    style.setProperty("--_nessa-runtime", "x"); object["--_nessa-key"]`))
  assert.deepEqual(references.sort(), ["--_nessa-key", "--_nessa-runtime", "--_nessa-secret", "var(--_nessa-color)"])
  assert.deepEqual(privateAliasReferences(parse('const key = "--_nessa-secret"; const view = <div style={{ [key]: "red" }} />')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const first = "--_nessa-secret"; const second = first; const third = second; const view = <div style={{ [third]: "red" }} />')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const first = second; const second = first; const view = <div style={{ [first]: "red" }} />')), [])
  assert.deepEqual(privateAliasReferences(parse('let key="safe"; key="--_nessa-secret"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('let key; if(flag) key="--_nessa-secret"; else key="safe"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('let key; if(flag) key="safe"; else key="--_nessa-secret"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const key=flag ? "--_nessa-secret" : "safe"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('let key; key=flag ? "--_nessa-secret" : "safe"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const key=safe || "--_nessa-secret"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const secret="--_nessa-secret"; const key=`${secret}`; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const prefix="--_nessa-"; const alias=prefix; const key=`${alias}secret`; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-"])
  assert.deepEqual(privateAliasReferences(parse('import { secret } from "./styles"; const key=`${secret}`; const view=<div style={{[key]:"red"}}/>')), ["__nessa_unresolved_private_import__:secret"])
  assert.deepEqual(privateAliasReferences(parse('var key="safe"; var key="--_nessa-secret"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('var key="--_nessa-secret"; var key="safe"; const view=<div style={{[key]:"red"}}/>')), ["--_nessa-secret"])
  assert.deepEqual(privateAliasReferences(parse('const key="--_nessa-secret"; { const key="safe"; const view=<div style={{[key]:"red"}}/> }')), [])
  assert.deepEqual(privateAliasReferences(parse('import { key } from "./styles"; const view=<div style={{[key]:"red"}}/>')), ["__nessa_unresolved_private_import__:key"])
})
