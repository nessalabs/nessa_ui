import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const iconDirectory = path.join(root, "apps/storybook/public/model-icons")

function pathData(source: string): string[] {
  return Array.from(source.matchAll(/<path d="([^"]+)"/g), (match) => match[1]!)
}

test("Kimi uses exact theme-specific marks on light and dark surfaces", async () => {
  const [lightIcon, darkIcon, component, notice] = await Promise.all([
    readFile(path.join(iconDirectory, "kimi-color.svg"), "utf8"),
    readFile(path.join(iconDirectory, "kimi-color-dark.svg"), "utf8"),
    readFile(
      path.join(
        root,
        "apps/storybook/stories/icons/model/kimi-model-icon.tsx",
      ),
      "utf8",
    ),
    readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ])

  assert.deepEqual(pathData(lightIcon), pathData(darkIcon))
  assert.equal(pathData(lightIcon).length, 2)
  assert.match(lightIcon, /fill="#1783FF"/)
  assert.match(lightIcon, /fill="#1C1F21"/)
  assert.doesNotMatch(lightIcon, /fill="#fff"/)
  assert.match(darkIcon, /fill="#1783FF"/)
  assert.match(darkIcon, /fill="#fff"/)
  assert.match(component, /src="\/model-icons\/kimi-color\.svg"/)
  assert.match(component, /className="[^"]*dark:hidden[^"]*"/)
  assert.match(component, /src="\/model-icons\/kimi-color-dark\.svg"/)
  assert.match(component, /className="[^"]*dark:block[^"]*"/)
  assert.match(notice, /Lobe Icons/)
})
