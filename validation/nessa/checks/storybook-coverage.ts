import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

interface StoryRelations { labelFors: readonly string[]; inputs: readonly { id: string; describedByIds: readonly string[] }[]; nonControlTargetIds: readonly string[] }
interface StoryAnalysis { hasTaggedMeta: boolean; metaComponent: string | null; namedStories: ReadonlyMap<string, string>; storyRelations: ReadonlyMap<string, StoryRelations> }

function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => property.name?.getText().replaceAll(/["']/g, "") === name)
}

export function analyzeStory(ast: ts.SourceFile): StoryAnalysis {
  const variables = new Map<string, ts.Expression>()
  const namedStories = new Map<string, string>()
  const storyRelations = new Map<string, StoryRelations>()
  let defaultName: string | null = null
  ast.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        variables.set(declaration.name.text, declaration.initializer)
        if (exported && /^[A-Z]/.test(declaration.name.text)) {
          namedStories.set(declaration.name.text, declaration.getText(ast))
          const labelFors: string[] = []
          const inputs: { id: string; describedByIds: string[] }[] = []
          const nonControlTargetIds: string[] = []
          const attribute = (attributes: ts.JsxAttributes, name: string): string | null => {
            const match = attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(ast) === name)
            if (!match?.initializer) return null
            if (ts.isStringLiteral(match.initializer)) return match.initializer.text
            if (ts.isJsxExpression(match.initializer) && match.initializer.expression && ts.isStringLiteral(match.initializer.expression)) return match.initializer.expression.text
            return null
          }
          function inspectJsx(candidate: ts.Node): void {
            if (ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate)) {
              const tag = candidate.tagName.getText(ast)
              const id = attribute(candidate.attributes, "id")
              if (tag === "label") { const value = attribute(candidate.attributes, "htmlFor"); if (value) labelFors.push(value) }
              if (tag === "Input") {
                const value = attribute(candidate.attributes, "aria-describedby")
                if (id) inputs.push({ id, describedByIds: value?.split(/\s+/).filter(Boolean) ?? [] })
              } else if (id) nonControlTargetIds.push(id)
            }
            ts.forEachChild(candidate, inspectJsx)
          }
          inspectJsx(declaration.initializer)
          storyRelations.set(declaration.name.text, { labelFors, inputs, nonControlTargetIds })
        }
      }
    }
    if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) defaultName = node.expression.text
  })
  const metaExpression = defaultName ? variables.get(defaultName) : undefined
  const meta = metaExpression && ts.isSatisfiesExpression(metaExpression) ? metaExpression.expression : metaExpression
  let hasTaggedMeta = false
  let metaComponent: string | null = null
  if (meta && ts.isObjectLiteralExpression(meta)) {
    const tags = objectProperty(meta, "tags")
    if (tags && ts.isPropertyAssignment(tags) && ts.isArrayLiteralExpression(tags.initializer)) {
      const values = tags.initializer.elements.filter(ts.isStringLiteral).map((entry) => entry.text)
      hasTaggedMeta = values.includes("autodocs") && values.includes("test")
    }
    const component = objectProperty(meta, "component")
    if (component && ts.isPropertyAssignment(component) && ts.isIdentifier(component.initializer)) metaComponent = component.initializer.text
  }
  return { hasTaggedMeta, metaComponent, namedStories, storyRelations }
}

export function inputStoryIssues(analysis: StoryAnalysis): string[] {
  const issues: string[] = []
  const playground = analysis.storyRelations.get("Playground")
  const invalid = analysis.storyRelations.get("Invalid")
  if (!playground || !playground.inputs.some((input) => playground.labelFors.includes(input.id))) issues.push("Playground label association")
  if (!invalid || !invalid.inputs.some((input) => invalid.labelFors.includes(input.id) && input.describedByIds.some((id) => id !== input.id && invalid.nonControlTargetIds.includes(id)))) issues.push("Invalid label/error association")
  return issues
}

export function storyDocumentsPublicComponent(analysis: StoryAnalysis, publicNames: readonly string[]): boolean {
  return Boolean(analysis.metaComponent && publicNames.includes(analysis.metaComponent))
}

export function publicComponentModules(index: ts.SourceFile): Map<string, string[]> {
  const modules = new Map<string, string[]>()
  index.forEachChild((node) => {
    if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith("./components/")) return
    const names = node.exportClause && ts.isNamedExports(node.exportClause)
      ? node.exportClause.elements.filter((element) => !element.isTypeOnly && /^[A-Z][A-Za-z0-9]*$/.test(element.name.text)).map((element) => element.name.text)
      : []
    if (names.length) modules.set(node.moduleSpecifier.text.replace(/^\.\/components\//, ""), names)
  })
  return modules
}

export const storybookCoverageCheck = defineCheck({
  id: "storybook-coverage",
  ...checkMetadata["storybook-coverage"],
  async run(context) {
    const findings = []
    const modules = context.files.match(["packages/react/src/components/**/*.tsx"])
    const stories = context.files.match(["apps/storybook/stories/**/*.stories.tsx"])
    const publicModules = publicComponentModules(await context.parseTypeScript("packages/react/src/index.ts"))

    for (const modulePath of modules) {
      const moduleName = modulePath.replace(/^packages\/react\/src\/components\//, "").replace(/\.tsx$/, "")
      if (!publicModules.has(moduleName)) continue
      const storyPath = stories.find((candidate) => candidate.replace(/^apps\/storybook\/stories\//, "").replace(/\.stories\.tsx$/, "") === moduleName)
      if (!storyPath) { findings.push(context.fail(`Public component module ${moduleName} has no Storybook story.`, { contractId: "STORY-001", path: modulePath })); continue }
      const analysis = analyzeStory(await context.parseTypeScript(storyPath))
      const publicNames = publicModules.get(moduleName) ?? []
      if (!analysis.hasTaggedMeta || analysis.namedStories.size === 0 || !storyDocumentsPublicComponent(analysis, publicNames)) findings.push(context.fail(`${moduleName} story must export tagged metadata bound to a public module component and at least one named story.`, { contractId: "STORY-001", path: storyPath }))
    }
    const inputPath = "apps/storybook/stories/input.stories.tsx"
    const inputIssues = inputStoryIssues(analyzeStory(await context.parseTypeScript(inputPath)))
    if (inputIssues.length) findings.push(context.fail(`Input stories lost per-story accessibility: ${inputIssues.join(", ")}.`, { contractId: "STORY-002", path: inputPath }))
    if (!findings.length) findings.push(context.pass("Every public component module has tagged documentation, named stories, and accessible Input examples.", { contractId: "STORY-001" }))
    return findings
  },
})
