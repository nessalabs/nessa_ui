import * as React from "react"
import { type SectionedListboxSection } from "@nessa-ui/react"
import { Blocks, FileSearch, Pencil, Puzzle, Sparkles } from "lucide-react"

/** One skill or plugin offered by the composer demo's `/` menu. */
export interface SlashItem {
  id: string
  kind: "skill" | "plugin"
  label: string
  description: string
  icon: React.ReactNode
}

export const slashSections: SectionedListboxSection<SlashItem>[] = [
  {
    id: "skills",
    label: "Skills",
    items: [
      {
        id: "skill-creator",
        kind: "skill",
        label: "Skill Creator",
        description: "Draft a reusable skill from this conversation",
        icon: <Sparkles aria-hidden="true" />,
      },
      {
        id: "commit-helper",
        kind: "skill",
        label: "Commit Helper",
        description: "Write a commit message for staged changes",
        icon: <Pencil aria-hidden="true" />,
      },
      {
        id: "code-review",
        kind: "skill",
        label: "Code Review",
        description: "Review the current diff for defects",
        icon: <FileSearch aria-hidden="true" />,
      },
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    items: [
      {
        id: "linear",
        kind: "plugin",
        label: "Linear",
        description: "Search and update issues",
        icon: <Puzzle aria-hidden="true" />,
      },
      {
        id: "context-packs",
        kind: "plugin",
        label: "Context Packs",
        description: "Attach shared project context",
        icon: <Blocks aria-hidden="true" />,
      },
    ],
  },
]

/** Returns whether any keyword contains the normalized trigger query. */
export function matchesQuery(query: string, keywords: readonly string[]) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true
  return keywords.some((keyword) =>
    keyword.toLocaleLowerCase().includes(normalized),
  )
}

/** Filters every slash section by the trigger query while keeping section order. */
export function filterSlashSections(query: string) {
  return slashSections.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      matchesQuery(query, [item.label, item.description]),
    ),
  }))
}

/** Renders a slash-menu row with an icon and inline description. */
export function renderSlashItem(item: SlashItem) {
  return (
    <span className="grid min-h-11 w-full grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2.5 px-2">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center text-muted-foreground [&_svg]:size-4"
      >
        {item.icon}
      </span>
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium text-foreground">{item.label}</span>
        <span className="text-muted-foreground"> {item.description}</span>
      </span>
    </span>
  )
}

/** One teammate offered by the composer demo's `@` menu. */
export interface Teammate {
  id: string
  name: string
  role: string
}

export const teammates: Teammate[] = [
  { id: "mira", name: "Mira Chen", role: "Design" },
  { id: "noah", name: "Noah Patel", role: "Runtime" },
  { id: "sasha", name: "Sasha Ortiz", role: "Docs" },
]

/** Returns a teammate's initials for avatar affordances. */
export function teammateInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

const teammateAvatarColors: Record<string, string> = {
  mira: "#7c6cf0",
  noah: "#2f9e77",
  sasha: "#d97757",
}

/** Builds a data-URI avatar image, standing in for a real profile photo. */
export function teammateAvatarSrc(teammate: Teammate) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='${teammateAvatarColors[teammate.id] ?? "#64748b"}'/><text x='16' y='21' text-anchor='middle' font-family='sans-serif' font-size='13' font-weight='600' fill='white'>${teammateInitials(teammate.name)}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Builds the @-trigger People section from the shared keyword matcher. */
export function mentionSections(
  query: string,
): SectionedListboxSection<Teammate>[] {
  return [
    {
      id: "people",
      label: "People",
      items: teammates.filter((teammate) =>
        matchesQuery(query, [teammate.name, teammate.role]),
      ),
    },
  ]
}

/** Renders a teammate row with an avatar image and inline role. */
export function renderTeammate(teammate: Teammate) {
  return (
    <span className="flex min-h-11 w-full items-center gap-2.5 px-2">
      <img
        src={teammateAvatarSrc(teammate)}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-6 shrink-0 rounded-full"
      />
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium text-foreground">{teammate.name}</span>
        <span className="text-muted-foreground"> {teammate.role}</span>
      </span>
    </span>
  )
}
