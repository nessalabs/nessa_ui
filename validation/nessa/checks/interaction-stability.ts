import ts from "typescript"

import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"

const modelPickerPath = "packages/react/src/components/model-picker.tsx"
const searchableListboxPath = "packages/react/src/components/searchable-listbox.tsx"
const modelPickerStoryPath = "apps/storybook/stories/model-picker.stories.tsx"

function parse(source: string, fileName: string) {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  )
}

function attribute(
  opening: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  )
}

function stringAttribute(
  opening: ts.JsxOpeningLikeElement,
  name: string,
): string | null {
  const value = attribute(opening, name)?.initializer
  return value && ts.isStringLiteral(value) ? value.text : null
}

function slottedElements(ast: ts.SourceFile, slot: string) {
  const matches: ts.JsxOpeningLikeElement[] = []
  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      stringAttribute(node, "data-slot") === slot
    ) {
      matches.push(node)
    }
    ts.forEachChild(node, visit)
  })
  return matches
}

function elementsWithTagName(ast: ts.SourceFile, tagName: string) {
  const matches: ts.JsxOpeningLikeElement[] = []
  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === tagName
    ) {
      matches.push(node)
    }
    ts.forEachChild(node, visit)
  })
  return matches
}

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text
  }
  if (
    ts.isComputedPropertyName(node) &&
    (ts.isStringLiteral(node.expression) ||
      ts.isNoSubstitutionTemplateLiteral(node.expression))
  ) {
    return node.expression.text
  }
  return null
}

function isCapabilityField(name: string) {
  const normalized = name.toLocaleLowerCase()
  return (
    /capabilit|effort|thinking|fast|slow/.test(normalized) ||
    /^modes?$/.test(normalized)
  )
}

function forbiddenTypeFields(
  ast: ts.SourceFile,
  rootNames: readonly string[],
  isForbidden: (name: string, type?: ts.TypeNode) => boolean,
  isForbiddenType: (type: ts.TypeNode) => boolean = () => false,
) {
  const declarations = new Map<
    string,
    Array<ts.InterfaceDeclaration | ts.TypeAliasDeclaration>
  >()
  ast.forEachChild(function collect(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const entries = declarations.get(node.name.text) ?? []
      entries.push(node)
      declarations.set(node.name.text, entries)
    }
    ts.forEachChild(node, collect)
  })

  const fields: string[] = []
  const visited = new Set<string>()

  function inspectMembers(members: ts.NodeArray<ts.TypeElement>) {
    for (const member of members) {
      if (ts.isPropertySignature(member) && member.name) {
        const name = propertyName(member.name)
        if (
          name &&
          (isForbidden(name, member.type) ||
            (member.type && isForbiddenType(member.type)))
        ) {
          fields.push(name)
        }
        if (member.type) inspectType(member.type)
      }
    }
  }

  function inspectType(type: ts.TypeNode) {
    if (isForbiddenType(type)) fields.push(type.getText())
    if (ts.isTypeLiteralNode(type)) inspectMembers(type.members)
    if (ts.isIntersectionTypeNode(type) || ts.isUnionTypeNode(type)) {
      for (const entry of type.types) inspectType(entry)
    }
    if (ts.isParenthesizedTypeNode(type)) inspectType(type.type)
    if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
      inspectDeclaration(type.typeName.text)
    }
  }

  function inspectDeclaration(name: string) {
    if (visited.has(name)) return
    visited.add(name)
    for (const declaration of declarations.get(name) ?? []) {
      if (ts.isInterfaceDeclaration(declaration)) {
        inspectMembers(declaration.members)
        for (const clause of declaration.heritageClauses ?? []) {
          for (const type of clause.types) {
            if (ts.isIdentifier(type.expression)) {
              inspectDeclaration(type.expression.text)
            }
          }
        }
      } else {
        inspectType(declaration.type)
      }
    }
  }

  for (const name of rootNames) inspectDeclaration(name)
  return fields
}

function describesProviderLayouts(type: ts.TypeNode) {
  const typeSource = type.getText().toLocaleLowerCase()
  return (
    /["']tabs["']/.test(typeSource) &&
    /["'](?:grouped|sections)["']/.test(typeSource)
  )
}

function isLayoutSelectionField(name: string, type?: ts.TypeNode) {
  return (
    /layout|view|presentation|variant|display/i.test(name) ||
    Boolean(type && describesProviderLayouts(type))
  )
}

function modelPickerJsxProps(
  ast: ts.SourceFile,
  isForbidden: (name: string) => boolean,
) {
  const fields: string[] = []
  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === "ModelPicker"
    ) {
      for (const property of node.attributes.properties) {
        if (ts.isJsxAttribute(property)) {
          const name = property.name.getText(ast)
          if (isForbidden(name)) fields.push(name)
        }
      }
    }
    ts.forEachChild(node, visit)
  })
  return fields
}

function modelPickerParameterFields(ast: ts.SourceFile) {
  const fields: string[] = []
  ast.forEachChild(function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "ModelPicker"
    ) {
      for (const parameter of node.parameters) {
        if (!ts.isObjectBindingPattern(parameter.name)) continue
        for (const element of parameter.name.elements) {
          const name = element.propertyName
            ? propertyName(element.propertyName)
            : ts.isIdentifier(element.name)
              ? element.name.text
              : null
          const defaultValue = element.initializer?.getText().toLocaleLowerCase()
          if (
            name &&
            (isLayoutSelectionField(name) ||
              defaultValue === '"tabs"' ||
              defaultValue === '"grouped"' ||
              defaultValue === '"sections"')
          ) {
            fields.push(name)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  })
  return fields
}

function elementsWithStringAttribute(
  ast: ts.SourceFile,
  name: string,
  value: string,
) {
  const matches: ts.JsxOpeningLikeElement[] = []
  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      stringAttribute(node, name) === value
    ) {
      matches.push(node)
    }
    ts.forEachChild(node, visit)
  })
  return matches
}

function elementsWithAttributeText(
  ast: ts.SourceFile,
  name: string,
  text: string,
) {
  const matches: ts.JsxOpeningLikeElement[] = []
  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      attribute(node, name)?.initializer?.getText(ast).includes(text)
    ) {
      matches.push(node)
    }
    ts.forEachChild(node, visit)
  })
  return matches
}

function forbiddenModelCatalogFields(ast: ts.SourceFile) {
  const fields: string[] = []
  const visitedExpressions = new Set<number>()

  function initializerFor(identifier: ts.Identifier) {
    let match: ts.Expression | undefined
    ast.forEachChild(function visit(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === identifier.text &&
        node.initializer &&
        node.getStart(ast) < identifier.getStart(ast) &&
        (!match || node.getStart(ast) > match.getStart(ast))
      ) {
        match = node.initializer
      }
      ts.forEachChild(node, visit)
    })
    return match
  }

  function inspectExpression(expression: ts.Expression) {
    if (visitedExpressions.has(expression.pos)) return
    visitedExpressions.add(expression.pos)

    if (ts.isIdentifier(expression)) {
      const initializer = initializerFor(expression)
      if (initializer) inspectExpression(initializer)
      return
    }
    if (ts.isParenthesizedExpression(expression)) {
      inspectExpression(expression.expression)
      return
    }
    if (
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isNonNullExpression(expression)
    ) {
      inspectExpression(expression.expression)
      return
    }
    if (ts.isConditionalExpression(expression)) {
      inspectExpression(expression.whenTrue)
      inspectExpression(expression.whenFalse)
      return
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        inspectExpression(ts.isSpreadElement(element) ? element.expression : element)
      }
      return
    }
    if (!ts.isObjectLiteralExpression(expression)) return

    for (const member of expression.properties) {
      if (ts.isSpreadAssignment(member)) {
        inspectExpression(member.expression)
        continue
      }
      if (
        ts.isPropertyAssignment(member) ||
        ts.isShorthandPropertyAssignment(member)
      ) {
        const name = propertyName(member.name)
        if (name && isCapabilityField(name)) fields.push(name)
        inspectExpression(
          ts.isPropertyAssignment(member) ? member.initializer : member.name,
        )
      }
    }
  }

  ast.forEachChild(function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === "ModelPicker"
    ) {
      const groups = attribute(node, "groups")?.initializer
      if (groups && ts.isJsxExpression(groups) && groups.expression) {
        inspectExpression(groups.expression)
      }
    }
    ts.forEachChild(node, visit)
  })
  return fields
}

function ownerFunction(node: ts.Node): string | null {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
  }
  return null
}

function exportedStorySource(ast: ts.SourceFile, name: string): string | null {
  for (const statement of ast.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          return declaration.initializer?.getText(ast) ?? null
        }
      }
    }
  }
  return null
}

function variableInitializers(node: ts.Node) {
  const declarations = new Map<string, ts.Expression>()
  node.forEachChild(function visit(child) {
    if (
      ts.isVariableDeclaration(child) &&
      ts.isIdentifier(child.name) &&
      child.initializer
    ) {
      declarations.set(child.name.text, child.initializer)
    }
    ts.forEachChild(child, visit)
  })
  return declarations
}

function isRectMeasurement(expression: ts.Expression, receiver: string) {
  return (
    ts.isCallExpression(expression) &&
    expression.arguments.length === 0 &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === "getBoundingClientRect" &&
    expression.expression.expression.getText() === receiver
  )
}

function containsIdentifierPair(node: ts.Node, first: string, second: string) {
  let found = false
  node.forEachChild(function visit(child) {
    if (
      ts.isArrayLiteralExpression(child) &&
      child.elements.length === 2 &&
      ts.isIdentifier(child.elements[0]!) &&
      child.elements[0]!.text === first &&
      ts.isIdentifier(child.elements[1]!) &&
      child.elements[1]!.text === second
    ) {
      found = true
    }
    ts.forEachChild(child, visit)
  })
  return found
}

function hasZeroGapAssertion(
  node: ts.Node,
  minuend: string,
  subtrahend: string,
) {
  let found = false
  node.forEachChild(function visit(child) {
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      child.expression.name.text === "toBeCloseTo" &&
      child.arguments[0]?.getText() === "0" &&
      ts.isCallExpression(child.expression.expression) &&
      child.expression.expression.expression.getText() === "expect" &&
      child.expression.expression.arguments.some(
        (argument) =>
          ts.isBinaryExpression(argument) &&
          argument.operatorToken.kind === ts.SyntaxKind.MinusToken &&
          argument.left.getText() === minuend &&
          argument.right.getText() === subtrahend,
      )
    ) found = true
    ts.forEachChild(child, visit)
  })
  return found
}

function hasGeometryTransition(classSource: string) {
  return classSource
    .split(/\s+/)
    .map((token) => token.split(":").at(-1) ?? token)
    .some(
      (token) =>
        token === "transition" ||
        (token.startsWith("transition-") &&
          token !== "transition-colors" &&
          token !== "transition-opacity"),
    )
}

function classSource(
  element: ts.JsxOpeningLikeElement | undefined,
  ast: ts.SourceFile,
) {
  if (!element) return ""
  return (
    stringAttribute(element, "className") ??
    attribute(element, "className")?.getText(ast) ??
    ""
  )
}

/** Detects ModelPicker consumption of SearchableListbox's preview-only highlight state. */
function modelPickerConsumesHighlightState(ast: ts.SourceFile) {
  let picker: ts.FunctionDeclaration | undefined
  ast.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "ModelPicker") {
      picker = node
    }
  })
  if (!picker) return false

  let consumesHighlight = false
  picker.forEachChild(function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "highlighted"
    ) {
      consumesHighlight = true
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "highlighted"
    ) {
      consumesHighlight = true
    }
    if (
      ts.isBindingElement(node) &&
      ts.isObjectBindingPattern(node.parent) &&
      ((node.propertyName && ts.isIdentifier(node.propertyName) && node.propertyName.text === "highlighted") ||
        (!node.propertyName && ts.isIdentifier(node.name) && node.name.text === "highlighted"))
    ) {
      consumesHighlight = true
    }
    ts.forEachChild(node, visit)
  })
  return consumesHighlight
}

function modelPickerPreviewMountedSubtrees(ast: ts.SourceFile) {
  let picker: ts.FunctionDeclaration | undefined
  ast.forEachChild((node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "ModelPicker"
    ) picker = node
  })
  if (!picker) return 0

  const tainted = new Set(["previewValue"])
  const bindingNames = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
        )
  const taintBinding = (name: ts.BindingName) => {
    for (const identifier of bindingNames(name)) tainted.add(identifier)
  }
  const assignmentTargetNames = (expression: ts.Expression): string[] => {
    if (ts.isParenthesizedExpression(expression)) {
      return assignmentTargetNames(expression.expression)
    }
    if (ts.isIdentifier(expression)) return [expression.text]
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.flatMap((element) =>
        ts.isExpression(element) ? assignmentTargetNames(element) : [],
      )
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return expression.properties.flatMap((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return [property.name.text]
        if (ts.isPropertyAssignment(property)) {
          return assignmentTargetNames(property.initializer)
        }
        return []
      })
    }
    return []
  }
  let changed = true
  while (changed) {
    changed = false
    picker.forEachChild(function visit(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        [...tainted].some((name) => node.initializer!.getText().includes(name)) &&
        bindingNames(node.name).some((name) => !tainted.has(name))
      ) {
        taintBinding(node.name)
        changed = true
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        [...tainted].some((name) => node.right.getText().includes(name)) &&
        assignmentTargetNames(node.left).some((name) => !tainted.has(name))
      ) {
        for (const name of assignmentTargetNames(node.left)) tainted.add(name)
        changed = true
      }
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.body &&
        [...tainted].some((name) => node.body!.getText().includes(name)) &&
        !tainted.has(node.name.text)
      ) {
        tainted.add(node.name.text)
        changed = true
      }
      ts.forEachChild(node, visit)
    })
  }

  const mountsFromPreview = (expression: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(expression)) {
      return mountsFromPreview(expression.expression)
    }
    if (ts.isIdentifier(expression)) return tainted.has(expression.text)
    if (ts.isConditionalExpression(expression)) {
      return (
        [...tainted].some((name) => expression.condition.getText().includes(name)) &&
        [expression.whenTrue, expression.whenFalse].some(
          (branch) =>
            ts.isJsxElement(branch) ||
            ts.isJsxSelfClosingElement(branch) ||
            ts.isJsxFragment(branch),
        )
      )
    }
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return (
        [...tainted].some((name) => expression.left.getText().includes(name)) &&
        (ts.isJsxElement(expression.right) ||
          ts.isJsxSelfClosingElement(expression.right) ||
          ts.isJsxFragment(expression.right))
      )
    }
    if (ts.isCallExpression(expression)) {
      if (
        ts.isIdentifier(expression.expression) &&
        tainted.has(expression.expression.text)
      ) return true
      return expression.arguments.some(
        (argument) =>
          !ts.isArrowFunction(argument) &&
          !ts.isFunctionExpression(argument) &&
          [...tainted].some((name) => argument.getText().includes(name)),
      )
    }
    return false
  }

  let count = 0
  picker.forEachChild(function visit(node) {
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      !ts.isJsxAttribute(node.parent) &&
      mountsFromPreview(node.expression)
    ) {
      count += 1
    }
    ts.forEachChild(node, visit)
  })
  return count
}

export function interactionStabilityIssues(
  componentSource: string,
  storySource: string,
  searchableListboxSource: string,
): string[] {
  const issues: string[] = []
  const componentAst = parse(componentSource, "model-picker.tsx")
  const searchableListboxAst = parse(
    searchableListboxSource,
    "searchable-listbox.tsx",
  )
  const storyAst = parse(storySource, "model-picker.stories.tsx")
  const modelSurfaces = slottedElements(componentAst, "model-picker-models")
  const effortSurfaces = slottedElements(componentAst, "model-picker-efforts")
  const contentSurfaces = slottedElements(componentAst, "model-picker-content")
  const searchableListboxes = elementsWithTagName(
    componentAst,
    "SearchableListbox",
  )
  const optionSurfaces = slottedElements(
    searchableListboxAst,
    "searchable-listbox-option",
  )
  const optionsRegions = slottedElements(
    searchableListboxAst,
    "searchable-listbox-list",
  )
  const providerRails = slottedElements(componentAst, "model-picker-provider-tabs")

  if (
    modelSurfaces.length !== 1 ||
    ownerFunction(modelSurfaces[0]!) !== "ModelPicker"
  ) {
    issues.push("ModelPicker must own exactly one primary model hit-target surface.")
  }
  if (
    contentSurfaces.length !== 1 ||
    contentSurfaces[0]!.tagName.getText() !== "Popover.Content" ||
    ownerFunction(contentSurfaces[0]!) !== "ModelPicker"
  ) {
    issues.push("ModelPicker must own one collision-positioned primary Popover.Content.")
  }
  if (
    effortSurfaces.length !== 0 ||
    componentSource.includes("data-model-capability-control")
  ) {
    issues.push("ModelPicker must not render capability controls from model hover or focus state.")
  }
  if (
    forbiddenTypeFields(
      componentAst,
      ["ModelPickerModel", "ModelPickerGroup"],
      isCapabilityField,
    ).length > 0 ||
    /data-slot=["']model-picker-(?:efforts?|modes?|capabilities?)["']/.test(
      componentSource,
    )
  ) {
    issues.push("ModelPicker types and rendering must not own model capability or mode data.")
  }
  if (forbiddenModelCatalogFields(storyAst).length > 0) {
    issues.push("ModelPicker Storybook catalogs must not embed capability or mode fixtures.")
  }
  if (
    forbiddenTypeFields(
      componentAst,
      ["ModelPickerProps"],
      isLayoutSelectionField,
      describesProviderLayouts,
    ).length > 0 ||
    modelPickerParameterFields(componentAst).length > 0 ||
    modelPickerJsxProps(storyAst, isLayoutSelectionField).length > 0
  ) {
    issues.push("ModelPicker must expose one canonical provider-tab layout without a layout-selection API or provider-section branch.")
  }
  if (
    searchableListboxes.length !== 1 ||
    ownerFunction(searchableListboxes[0]!) !== "ModelPicker" ||
    modelPickerPreviewMountedSubtrees(componentAst) !== 0 ||
    modelPickerConsumesHighlightState(componentAst)
  ) {
    issues.push(
      "ModelPicker must delegate one searchable option surface without rendering highlight-owned content.",
    )
  }
  if (
    optionSurfaces.length !== 1 ||
    ownerFunction(optionSurfaces[0]!) !== "SearchableListbox"
  ) {
    issues.push(
      "SearchableListbox must own one canonical reusable option surface.",
    )
  } else {
    const option = optionSurfaces[0]!
    if (!attribute(option, "onPointerMove") || !attribute(option, "onFocus")) {
      issues.push("Model options must preview from pointer movement and focus.")
    }
    if (attribute(option, "onMouseEnter") || attribute(option, "onMouseOver")) {
      issues.push("Model preview must not be owned by reflow-triggered mouse enter/over events.")
    }
  }
  if (
    optionsRegions.length !== 1 ||
    ownerFunction(optionsRegions[0]!) !== "SearchableListbox" ||
    providerRails.length !== 1
  ) {
    issues.push(
      "Provider-tab layout must compose one reusable options region with one adjacent provider rail.",
    )
  }
  const providerTabs = elementsWithStringAttribute(componentAst, "role", "tab")
  const providerPanels = elementsWithAttributeText(
    componentAst,
    "role",
    '"tabpanel"',
  )
  const providerRail = providerRails[0]
  const providerTab = providerTabs[0]
  const providerPanel = providerPanels[0]
  if (
    !providerRail ||
    stringAttribute(providerRail, "role") !== "tablist" ||
    attribute(providerRail, "aria-label")?.initializer?.getText() !==
      "{tabsLabel}" ||
    !componentSource.includes('tabsLabel = "Model providers"')
  ) {
    issues.push("The canonical provider rail must expose labelled tablist semantics.")
  }
  if (
    providerTabs.length !== 1 ||
    !providerTab ||
    attribute(providerTab, "aria-selected")?.initializer?.getText() !==
      "{selected}" ||
    attribute(providerTab, "aria-controls")?.initializer?.getText() !==
      "{providerPanelId}" ||
    !attribute(providerTab, "tabIndex")?.initializer?.getText().includes(
      "selected ? 0 : -1",
    )
  ) {
    issues.push("Provider tabs must retain one roving tab stop and control the shared provider panel.")
  }
  if (
    providerPanels.length !== 1 ||
    !providerPanel ||
    !attribute(providerPanel, "role")?.initializer?.getText().includes(
      'activeProvider ? "tabpanel" : undefined',
    ) ||
    !attribute(providerPanel, "id")?.initializer?.getText().includes(
      "activeProvider ? providerPanelId : undefined",
    ) ||
    !attribute(providerPanel, "aria-labelledby")
      ?.initializer?.getText()
      .includes("activeProvider ? providerTabId(activeProvider.id) : undefined")
  ) {
    issues.push("The provider panel must be labelled by the active tab and omit tabpanel semantics when no provider exists.")
  }
  if (
    !componentSource.includes("sideOffset?: number") ||
    !componentSource.includes("sideOffset = 0") ||
    !contentSurfaces[0] ||
    attribute(contentSurfaces[0], "sideOffset")?.initializer?.getText() !==
      "{sideOffset}"
  ) {
    issues.push("ModelPicker must default its public collision offset to a flush zero-gap anchor.")
  }

  const modelClass = classSource(modelSurfaces[0], componentAst)
  const contentClass = classSource(contentSurfaces[0], componentAst)
  const modelHasIndependentWidth =
    /(?:^|\s)(?:[\w-]+:)*(?:w-|max-w-)/.test(modelClass) ||
    Boolean(modelSurfaces[0] && attribute(modelSurfaces[0], "style"))
  if (!contentClass.includes("w-[min(24rem") || modelHasIndependentWidth) {
    issues.push("Primary Popover collision footprint and model surface must share one width contract.")
  }
  if (hasGeometryTransition(modelClass) || hasGeometryTransition(contentClass)) {
    issues.push("Preview-owned hit-target geometry must not be transitioned.")
  }
  if (
    !searchableListboxSource.includes("highlightedId === itemId") ||
    !searchableListboxSource.includes("setHighlightedId(itemId)")
  ) {
    issues.push(
      "Reusable pointer highlighting must retain stable item identity.",
    )
  }
  const regression = exportedStorySource(storyAst, "StablePointerPreview")
  if (!regression) {
    issues.push("ModelPicker stories must export StablePointerPreview.")
  } else {
    if (!regression.includes('defaultViewport: "mobile1"')) {
      issues.push("StablePointerPreview must execute in a narrow viewport.")
    }
    for (const evidence of [
      "modelRectBefore",
      "contentRectBefore",
      "triggerRectBefore",
      "providerTabsRectBefore",
      "solRectBefore",
      "terraRectBefore",
      "getBoundingClientRect()",
      "toBeCloseTo",
      "data-model-capability-control",
      "not.toBeInTheDocument()",
      'toHaveAttribute("data-highlighted", "false")',
    ]) {
      if (!regression.includes(evidence)) {
        issues.push(`StablePointerPreview lacks rendered evidence ${evidence}.`)
      }
    }

    const regressionAst = parse(regression, "stable-pointer-preview.tsx")
    const declarations = variableInitializers(regressionAst)
    const measurements = [
      ["modelRectBefore", "modelSurface"],
      ["modelRectAfter", "modelSurface"],
      ["contentRectBefore", "pickerContent"],
      ["contentRectAfter", "pickerContent"],
      ["triggerRectBefore", "pickerTrigger"],
      ["triggerRectAfter", "pickerTrigger"],
      ["providerTabsRectBefore", "providerTabs"],
      ["providerTabsRectAfter", "providerTabs"],
      ["solRectBefore", "sol"],
      ["solRectAfter", "sol"],
      ["terraRectBefore", "terra"],
      ["terraRectAfter", "terra"],
    ] as const
    for (const [variable, receiver] of measurements) {
      const initializer = declarations.get(variable)
      if (!initializer || !isRectMeasurement(initializer, receiver)) {
        issues.push(
          `StablePointerPreview must measure ${variable} from ${receiver} after its corresponding interaction.`,
        )
      }
    }
    const secondHoverPosition = regression.lastIndexOf("userEvent.hover(terra)")
    for (const variable of [
      "modelRectAfter",
      "contentRectAfter",
      "triggerRectAfter",
      "providerTabsRectAfter",
      "solRectAfter",
      "terraRectAfter",
    ]) {
      const initializer = declarations.get(variable)
      if (!initializer || initializer.pos <= secondHoverPosition) {
        issues.push(`${variable} must be measured after the second model hover.`)
      }
    }
    for (const [before, after] of [
      ["modelRectBefore", "modelRectAfter"],
      ["contentRectBefore", "contentRectAfter"],
      ["triggerRectBefore", "triggerRectAfter"],
      ["providerTabsRectBefore", "providerTabsRectAfter"],
      ["solRectBefore", "solRectAfter"],
      ["terraRectBefore", "terraRectAfter"],
    ] as const) {
      if (!containsIdentifierPair(regressionAst, before, after)) {
        issues.push(`StablePointerPreview must compare ${before} with ${after}.`)
      }
    }
  }
  const providerRegression = exportedStorySource(storyAst, "ProviderTabs")
  if (!providerRegression) {
    issues.push("ModelPicker stories must export ProviderTabs adjacency evidence.")
  } else {
    const providerAst = parse(providerRegression, "provider-tabs.tsx")
    const declarations = variableInitializers(providerAst)
    for (const [variable, receiver] of [
      ["contentRect", "content"],
      ["triggerRect", "trigger"],
      ["optionsRect", "options"],
      ["providerTabsRect", "providerTabs"],
    ] as const) {
      const initializer = declarations.get(variable)
      if (!initializer || !isRectMeasurement(initializer, receiver)) {
        issues.push(`ProviderTabs must measure ${variable} from ${receiver}.`)
      }
    }
    if (!hasZeroGapAssertion(providerAst, "triggerRect.top", "contentRect.bottom")) {
      issues.push("ProviderTabs must prove the picker surface is flush with its trigger.")
    }
    if (!hasZeroGapAssertion(providerAst, "providerTabsRect.top", "optionsRect.bottom")) {
      issues.push("ProviderTabs must prove the provider rail is flush with the options region.")
    }
  }
  for (const [storyName, evidence] of [
    [
      "SingleProvider",
      ["getByRole(\"tablist\"", "getByRole(\"tab\"", "getByRole(\"tabpanel\"", "aria-controls", "aria-labelledby"],
    ],
    [
      "DisabledProviderFallback",
      ["Refresh catalog", "toBeDisabled()", 'toHaveAttribute(\"tabindex\", \"0\")', "toHaveFocus()"],
    ],
    ["Loading", ["queryByRole(\"tablist\")", "queryByRole(\"tabpanel\")"]],
    ["Empty", ["queryByRole(\"tablist\")", "queryByRole(\"tabpanel\")"]],
  ] as const) {
    const source = exportedStorySource(storyAst, storyName)
    if (!source || evidence.some((marker) => !source.includes(marker))) {
      issues.push(`${storyName} must preserve canonical provider-tab accessibility evidence.`)
    }
  }
  return issues
}

export const interactionStabilityCheck = defineCheck({
  id: "interaction-stability",
  ...checkMetadata["interaction-stability"],
  async run(context) {
    if (
      !context.files.has(modelPickerPath) ||
      !context.files.has(searchableListboxPath) ||
      !context.files.has(modelPickerStoryPath)
    ) {
      return [context.fail("ModelPicker interaction-stability sources are missing.", {
        contractId: "INT-001",
      })]
    }
    const issues = interactionStabilityIssues(
      await context.readText(modelPickerPath),
      await context.readText(modelPickerStoryPath),
      await context.readText(searchableListboxPath),
    )
    return issues.length
      ? issues.map((message) => context.fail(message, {
        contractId: "INT-001",
          repair: "Keep ModelPicker domain-only, delegate generic search/listbox behavior to SearchableListbox, join capabilities after selection, and retain narrow-viewport bounding-box evidence.",
        }))
      : [context.pass("ModelPicker owns only provider/model selection and retains narrow-viewport geometry evidence.", {
          contractId: "INT-001",
        })]
  },
})
