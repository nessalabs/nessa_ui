/** @responsibility Reads what a Codex session can do from the app-server, which is the only place that answers. */

import { asArray, asNumber, asRecord, asString } from "../json"
import type { JsonValue } from "../json"

/**
 * Codex reports capabilities on a different channel from its stream.
 *
 * `codex exec --json` opens with a thread id and nothing else — no model list,
 * no skills, no plugins — so a composer built on that stream has nothing to
 * populate its pickers with. The interactive `codex app-server` answers
 * `model/list`, `skills/list`, `plugin/list` and `hooks/list` on request.
 *
 * This module reads those replies. It does **not** speak to the app-server:
 * holding that connection is a host's job, and this stays a pure function over
 * whatever the host got back — which is also what makes it testable against a
 * captured reply.
 */

export interface CodexModel {
  readonly id: string
  readonly displayName: string
  readonly description: string | null
  readonly isDefault: boolean
}

export interface CodexSkill {
  readonly name: string
  readonly description: string | null
}

export interface CodexHook {
  readonly event: string | null
  readonly source: string | null
}

/**
 * A plugin source.
 *
 * `count` is the marketplace's real size and `sample` is what was returned:
 * a curated marketplace holds thousands, so a picker searches it rather than
 * listing it, and a surface that showed only the sample would misreport the
 * catalogue's size.
 */
export interface CodexMarketplace {
  readonly name: string
  readonly count: number
  readonly sample: readonly { readonly id: string | null; readonly name: string | null }[]
}

export interface CodexCapabilities {
  readonly models: readonly CodexModel[]
  readonly skills: readonly CodexSkill[]
  readonly hooks: readonly CodexHook[]
  readonly marketplaces: readonly CodexMarketplace[]
}

/** The app-server methods this reads, so a host knows what to ask for. */
export const CODEX_CAPABILITY_METHODS = Object.freeze([
  "model/list",
  "skills/list",
  "plugin/list",
  "hooks/list",
] as const)

export type CodexCapabilityMethod = (typeof CODEX_CAPABILITY_METHODS)[number]

/**
 * Reads the app-server's replies, keyed by the method that produced each.
 *
 * A missing method reads as an empty list rather than an error: a host may ask
 * for only what a surface needs, and a picker with no plugins is a picker, not
 * a failure.
 */
export function codexCapabilities(replies: Readonly<Record<string, JsonValue>>): CodexCapabilities {
  const models: CodexModel[] = []
  for (const entry of asArray(asRecord(replies["model/list"]).data)) {
    const model = asRecord(entry)
    const id = asString(model.id)
    if (id === null) continue
    models.push({
      id,
      displayName: asString(model.displayName) ?? id,
      description: asString(model.description),
      isDefault: model.isDefault === true,
    })
  }

  // Skills and hooks are reported per working directory, since both can be
  // defined by the project as well as the user.
  const skills: CodexSkill[] = []
  for (const scope of asArray(asRecord(replies["skills/list"]).data)) {
    for (const entry of asArray(asRecord(scope).skills)) {
      const skill = asRecord(entry)
      const name = asString(skill.name)
      if (name === null) continue
      skills.push({ name, description: asString(skill.description) })
    }
  }

  const hooks: CodexHook[] = []
  for (const scope of asArray(asRecord(replies["hooks/list"]).data)) {
    for (const entry of asArray(asRecord(scope).hooks)) {
      const hook = asRecord(entry)
      hooks.push({ event: asString(hook.event) ?? asString(hook.type), source: asString(hook.source) ?? asString(hook.path) })
    }
  }

  const marketplaces: CodexMarketplace[] = []
  for (const entry of asArray(asRecord(replies["plugin/list"]).marketplaces)) {
    const marketplace = asRecord(entry)
    const name = asString(marketplace.name)
    if (name === null) continue
    const sample = asArray(marketplace.plugins).map((plugin) => ({
      id: asString(asRecord(plugin).id),
      name: asString(asRecord(plugin).name),
    }))
    marketplaces.push({
      name,
      // The reply carries the true size when the sample is trimmed; without it
      // the sample's length is the best available answer.
      count: asNumber(marketplace.pluginCount) ?? sample.length,
      sample,
    })
  }

  return { models, skills, hooks, marketplaces }
}
