import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"
import { preview } from "vite"

const storybookRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

const server = await preview({
  root: storybookRoot,
  build: { outDir: "storybook-static" },
  preview: { host: "127.0.0.1", port: 0, strictPort: false },
})

const address = server.httpServer.address()
if (!address || typeof address === "string") {
  await server.close()
  throw new Error("Could not resolve the Storybook preview address")
}

let browser

try {
  browser = await chromium.launch()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const indexResponse = await fetch(`${baseUrl}/index.json`)
  if (!indexResponse.ok) {
    throw new Error(`Storybook index returned ${indexResponse.status}`)
  }

  const index = await indexResponse.json()
  const entryIds = new Set(Object.keys(index.entries))
  const expectedSidebarEntries = [
    "components-sidebar-examples--documentation",
    "components-sidebar-examples--chat-navigation",
    "components-sidebar-examples--light",
    "components-sidebar-examples--icon-collapsed",
    "components-sidebar-examples--mobile-icon-collapsed",
    "components-sidebar-examples--non-collapsible",
    "components-sidebar-examples--mobile-overlay",
    "components-sidebar-examples--stress-500-rows",
    "components-sidebar-primitives--documentation",
    "components-sidebar-primitives--provider-sidebar-and-inset",
    "components-sidebar-primitives--header",
    "components-sidebar-primitives--content",
    "components-sidebar-primitives--group",
    "components-sidebar-primitives--footer",
    "components-sidebar-primitives--trigger",
    "components-sidebar-primitives--rail",
    "components-sidebar-primitives-menu--documentation",
    "components-sidebar-primitives-menu--menu",
    "components-sidebar-primitives-menu--menu-item",
    "components-sidebar-primitives-menu--menu-skeleton",
    "components-sidebar-primitives-menu--nested-menu",
    "components-sidebar-primitives-menu--nested-menu-guides",
    "components-sidebar-primitives-menu--collapsible-submenu",
    "components-sidebar-primitives-menu--trailing-action",
    "components-sidebar-compositions--documentation",
    "components-sidebar-compositions--rich-chat-row",
    "components-sidebar-compositions--nested-navigation",
    "components-sidebar-compositions--hover-actions",
    "components-sidebar-compositions--logical-direction",
    "components-sidebar-compositions--rail-behavior",
    "components-sidebar-compositions--inset-variant",
  ]
  const actualSidebarEntries = [...entryIds]
    .filter((id) => id.startsWith("components-sidebar-"))
    .sort()
  const expectedSortedSidebarEntries = [...expectedSidebarEntries].sort()
  if (
    JSON.stringify(actualSidebarEntries) !==
    JSON.stringify(expectedSortedSidebarEntries)
  ) {
    throw new Error(
      `Sidebar Storybook inventory drifted:\n${actualSidebarEntries.join("\n")}`,
    )
  }

  const docsEntries = Object.values(index.entries).filter(
    (entry) => entry.type === "docs",
  )

  if (docsEntries.length === 0) {
    throw new Error("Storybook generated no documentation entries")
  }

  const page = await browser.newPage()
  for (const entry of docsEntries) {
    const response = await page.goto(
      `${baseUrl}/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=docs`,
      { waitUntil: "networkidle" },
    )

    if (!response?.ok()) {
      throw new Error(
        `${entry.id} documentation returned ${response?.status() ?? "no response"}`,
      )
    }

    await page.locator("h1:visible").first().waitFor({ state: "visible" })
    const content = (await page.locator("body").innerText()).trim()
    if (content.length < 20 || /couldn't find story|failed to render/i.test(content)) {
      throw new Error(`${entry.id} documentation rendered without usable content`)
    }

    await page.goto(
      `${baseUrl}/?path=/docs/${encodeURIComponent(entry.id)}`,
      { waitUntil: "networkidle" },
    )
    const previewFrame = page.locator("#storybook-preview-iframe")
    await previewFrame.waitFor({ state: "visible" })
    const previewHandle = await previewFrame.elementHandle()
    const managerFrame = await previewHandle?.contentFrame()
    if (!managerFrame) {
      throw new Error(`${entry.id} manager preview iframe did not load`)
    }

    const managerHeading = managerFrame.locator("h1:visible").last()
    await managerHeading.waitFor({ state: "visible" })
    const headingBounds = await managerHeading.boundingBox()
    const managerViewportHeight = await managerFrame.evaluate(() => innerHeight)
    if (
      !headingBounds ||
      headingBounds.y < 0 ||
      headingBounds.y >= managerViewportHeight
    ) {
      throw new Error(
        `${entry.id} documentation heading was outside the initial manager viewport`,
      )
    }
    const managerContent = await previewFrame.evaluate((frame) =>
      frame.contentDocument?.body.innerText.trim() ?? "",
    )
    if (
      managerContent.length < 20 ||
      /couldn't find story|failed to render/i.test(managerContent)
    ) {
      throw new Error(
        `${entry.id} documentation rendered blank through the Storybook manager`,
      )
    }

    const primaryDocumentation = await managerHeading.evaluate((heading) =>
      Array.from(heading.parentElement?.children ?? [])
        .filter((element) => element.tagName === "P")
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean),
    )
    if (primaryDocumentation.length < 2) {
      throw new Error(
        `${entry.id} is missing its component or primary-story documentation`,
      )
    }

    const documentedStories = await managerFrame
      .locator('div[id^="anchor--"] > h3:visible')
      .evaluateAll((headings) =>
        headings.map((heading) => ({
          name: heading.textContent?.trim() ?? "",
          description:
            Array.from(heading.parentElement?.children ?? []).find(
              (element) => element.tagName === "P",
            )?.textContent?.trim() ?? "",
        })),
      )

    const storyCount = Object.values(index.entries).filter(
      (candidate) =>
        candidate.type === "story" && candidate.title === entry.title,
    ).length
    const expectedDocumentedStoryCount = storyCount > 1 ? storyCount : 0

    if (
      documentedStories.length !== expectedDocumentedStoryCount ||
      documentedStories.some(({ name, description }) => !name || !description)
    ) {
      throw new Error(
        `${entry.id} rendered ${documentedStories.length} documented story sections; expected ${expectedDocumentedStoryCount}`,
      )
    }

    if (
      [
        "components-sidebar-primitives--documentation",
        "components-sidebar-primitives-menu--documentation",
        "components-sidebar-compositions--documentation",
      ].includes(entry.id)
    ) {
      const catalogGeometry = await managerFrame
        .locator("[data-sidebar-catalog]:visible")
        .evaluateAll((sidebars) =>
          sidebars.map((sidebar) => {
            const styles = getComputedStyle(sidebar)
            const canvas = sidebar.closest(".docs-story")
            const root = sidebar.closest("[data-sidebar-story-root]")
            return {
              borderColors: [
                styles.borderLeftColor,
                styles.borderRightColor,
              ],
              canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
              rootHeight: root?.getBoundingClientRect().height ?? 0,
              sidebarHeight: sidebar.getBoundingClientRect().height,
            }
          }),
        )

      if (
        catalogGeometry.length === 0 ||
        catalogGeometry.some(
          ({ borderColors, canvasHeight, rootHeight, sidebarHeight }) =>
            borderColors.some(
              (color) => color !== "rgba(0, 0, 0, 0)",
            ) ||
            canvasHeight === 0 ||
            Math.abs(canvasHeight - rootHeight) > 1 ||
            Math.abs(canvasHeight - sidebarHeight) > 1,
        )
      ) {
        throw new Error(
          `${entry.id} contains a split or oversized catalog fixture`,
        )
      }
    }

    if (entry.id === "components-sidebar-primitives-menu--documentation") {
      const menuControlsTable = managerFrame.locator("table").filter({
        has: managerFrame.locator('input[name="rowCount"]'),
      })
      const labelControl = menuControlsTable.locator(
        'textarea[name="label"]',
      )
      const rowCountControl = menuControlsTable.locator(
        'input[name="rowCount"][type="range"]',
      )
      if (
        (await menuControlsTable.count()) !== 1 ||
        (await labelControl.count()) !== 1 ||
        (await rowCountControl.count()) !== 1
      ) {
        throw new Error(
          `${entry.id} did not expose the primary Menu story controls`,
        )
      }
      await labelControl.fill("Controlled row")
      await rowCountControl.fill("2")
      await managerFrame
        .getByRole("button", { name: "Controlled row 2" })
        .waitFor({ state: "visible" })
      const controlledRows = managerFrame.getByRole("button", {
        name: /^Controlled row \d+$/,
      })
      if (
        (await controlledRows.count()) !== 2 ||
        (await managerFrame.getByRole("button", {
          name: "Controlled row 3",
        }).count()) !== 0
      ) {
        throw new Error(
          `${entry.id} did not apply its rowCount control to the Menu preview`,
        )
      }

      const noteSurfaces = await managerFrame
        .locator("[data-sidebar-story-note]:visible")
        .evaluateAll((notes) =>
          notes.map((note) => {
            const styles = getComputedStyle(note)
            const canvas = document.createElement("canvas")
            const context = canvas.getContext("2d")
            canvas.width = 1
            canvas.height = 1
            if (!context) throw new Error("Could not resolve the note color")
            context.fillStyle = styles.backgroundColor
            context.fillRect(0, 0, 1, 1)

            return {
              cardToken: styles.getPropertyValue("--card").trim(),
              channels: [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)],
            }
          }),
        )

      if (
        noteSurfaces.length === 0 ||
        noteSurfaces.some(
          ({ cardToken, channels }) =>
            !cardToken.startsWith("color-mix(in oklab") ||
            Math.max(...channels) - Math.min(...channels) > 4 ||
            Math.max(...channels) > 32,
        )
      ) {
        throw new Error(
          `${entry.id} did not render its notes with the Sidebar-neutral card surface`,
        )
      }

    }
  }

  await page.goto(
    `${baseUrl}/iframe.html?id=components-input--documentation&viewMode=docs&globals=theme:dark`,
    { waitUntil: "networkidle" },
  )
  const darkInputDocumentation = await page
    .locator(".sbdocs-preview")
    .first()
    .evaluate((preview) => {
      const input = preview.querySelector("input")
      const label = preview.querySelector("label")
      const docsWrapper = preview.closest(".sbdocs-wrapper")
      if (!input || !label || !docsWrapper) return null

      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (!context) return null
      canvas.width = 1
      canvas.height = 1

      const normalizeColor = (color) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data]
      }

      const relativeLuminance = ([red, green, blue]) => {
        const channels = [red, green, blue].map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
      }

      const contrast = (first, second) => {
        const lighter = Math.max(
          relativeLuminance(first),
          relativeLuminance(second),
        )
        const darker = Math.min(
          relativeLuminance(first),
          relativeLuminance(second),
        )
        return (lighter + 0.05) / (darker + 0.05)
      }

      const effectiveOpacity = (element) => {
        let opacity = 1
        let current = element
        while (current && current !== preview.parentElement) {
          opacity *= Number.parseFloat(getComputedStyle(current).opacity)
          current = current.parentElement
        }
        return opacity
      }

      const compositeForeground = (foreground, background, opacity) => {
        const alpha = (foreground[3] / 255) * opacity
        return [
          Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
          Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
          Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
          255,
        ]
      }

      const previewStyles = getComputedStyle(preview)
      const previewBackground = normalizeColor(previewStyles.backgroundColor)
      const inputColor = normalizeColor(getComputedStyle(input).color)
      const labelColor = normalizeColor(getComputedStyle(label).color)
      const renderedInputColor = compositeForeground(
        inputColor,
        previewBackground,
        effectiveOpacity(input),
      )
      const renderedLabelColor = compositeForeground(
        labelColor,
        previewBackground,
        effectiveOpacity(label),
      )
      return {
        isDark: document.documentElement.classList.contains("dark"),
        backgroundToken: previewStyles
          .getPropertyValue("--background")
          .trim(),
        previewBackground,
        semanticBackground: normalizeColor(
          previewStyles.getPropertyValue("--background").trim(),
        ),
        docsBackground: normalizeColor(
          getComputedStyle(docsWrapper).backgroundColor,
        ),
        previewOpacity: effectiveOpacity(preview),
        inputContrast: contrast(renderedInputColor, previewBackground),
        labelContrast: contrast(renderedLabelColor, previewBackground),
      }
    })

  if (
    !darkInputDocumentation?.isDark ||
    !darkInputDocumentation.backgroundToken ||
    darkInputDocumentation.previewBackground[3] !== 255 ||
    Math.abs(darkInputDocumentation.previewOpacity - 1) > 0.001 ||
    JSON.stringify(darkInputDocumentation.previewBackground) !==
      JSON.stringify(darkInputDocumentation.semanticBackground) ||
    JSON.stringify(darkInputDocumentation.previewBackground) ===
      JSON.stringify(darkInputDocumentation.docsBackground) ||
    darkInputDocumentation.inputContrast < 4.5 ||
    darkInputDocumentation.labelContrast < 4.5
  ) {
    throw new Error(
      "Input documentation did not render dark tokens on a semantic dark preview surface",
    )
  }

  await page.goto(
    `${baseUrl}/iframe.html?id=components-sidebar-compositions--hover-actions&viewMode=story`,
    { waitUntil: "networkidle" },
  )
  const hoverRow = page.getByTestId("hover-action-row")
  const hoverAction = page.getByRole("button", {
    name: "Open conversation actions",
  })
  const hoverTrailing = hoverAction.locator("..")
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })
  await page.mouse.move(1000, 700)
  await page.waitForFunction(
    (element) => getComputedStyle(element).opacity === "0",
    await hoverTrailing.elementHandle(),
  )
  const finePointerBefore = await hoverTrailing.evaluate((element) => ({
    fine: matchMedia("(hover: hover) and (pointer: fine)").matches,
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }))
  if (
    !finePointerBefore.fine ||
    finePointerBefore.opacity !== "0" ||
    finePointerBefore.pointerEvents !== "none"
  ) {
    throw new Error("Hover actions were not hidden for a fine pointer")
  }
  await hoverRow.hover()
  await page.waitForFunction(
    (element) => {
      const styles = getComputedStyle(element)
      return styles.opacity === "1" && styles.pointerEvents === "auto"
    },
    await hoverTrailing.elementHandle(),
  )

  const coarsePage = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })
  try {
    await coarsePage.goto(
      `${baseUrl}/iframe.html?id=components-sidebar-compositions--hover-actions&viewMode=story`,
      { waitUntil: "networkidle" },
    )
    const coarseTrailing = coarsePage
      .getByRole("button", { name: "Open conversation actions" })
      .locator("..")
    const coarsePointerState = await coarseTrailing.evaluate((element) => ({
      coarse: matchMedia("(pointer: coarse)").matches,
      hoverNone: matchMedia("(hover: none)").matches,
      opacity: getComputedStyle(element).opacity,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }))
    if (
      !coarsePointerState.coarse ||
      !coarsePointerState.hoverNone ||
      coarsePointerState.opacity !== "1" ||
      coarsePointerState.pointerEvents !== "auto"
    ) {
      throw new Error("Hover actions were not persistently visible for touch")
    }
  } finally {
    await coarsePage.close()
  }

  process.stdout.write(
    `PASS: ${docsEntries.length} Storybook documentation entries render usable content\n`,
  )
} finally {
  try {
    await browser?.close()
  } finally {
    await server.close()
  }
}
