"use client"

import * as React from "react"
import { ChevronDown, LayoutGrid, Search, Star } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { useComposedRefs } from "@/lib/compose"
import { useOpenerFocusReturn } from "@/lib/overlay-panel"
import {
  PortalContainerProvider,
  useNessaLayerScope,
  usePortalContainer,
  usePortalContainerHost,
} from "@/lib/portal-container"
import { cn } from "@/lib/utils"

import { ModelFastMode } from "./model-capability-controls"

/**
 * One level of thinking a model offers, least first in its model's list.
 * `unlit` is a level that draws no bar of its own — a "none" that means the
 * model answers without thinking: chosen, every bar is dark.
 */
export interface ModelLevelPickerLevel {
  value: string
  label: string
  unlit?: boolean
}

/** One model in a provider's catalog. */
export interface ModelLevelPickerModel {
  id: string
  label: string
  /** A shorter name for the trigger ("Opus 5" for "Claude Opus 5"). */
  shortLabel?: string
  /** The thinking levels it offers, least first; none, and its row has no bars. */
  levels?: readonly ModelLevelPickerLevel[]
  disabled?: boolean
}

/** One provider: its mark, its colour, and its models. */
export interface ModelLevelPickerGroup {
  id: string
  label: string
  /** The provider's mark, drawn on a 16px tile; it should take `currentColor`. */
  icon?: React.ReactNode
  /**
   * The provider's own colour. Its mark is drawn in it, the chosen model's
   * tile is filled with it, and the chosen model's lit bars take it. Without
   * one the kit's foreground stands in.
   */
  accent?: string
  /** What a mark drawn on a tile filled with `accent` is drawn in. */
  accentForeground?: string
  models: readonly ModelLevelPickerModel[]
}

/** A model, by provider and model ids. */
export interface ModelLevelPickerModelRef {
  providerId: string
  modelId: string
}

/**
 * A choice: a model and, when the bar for one was pressed, the level with it.
 * A choice with no `level` keeps the host's level; the host decides what that
 * means for a model that does not offer it.
 */
export interface ModelLevelPickerValue extends ModelLevelPickerModelRef {
  level?: string
}

export interface ModelLevelPickerProps {
  ref?: React.Ref<HTMLButtonElement>
  groups: readonly ModelLevelPickerGroup[]
  /** The model in use. */
  value?: ModelLevelPickerModelRef
  /**
   * The level a model's row shows lit, by its value: the host's level as that
   * model would take it. Every row shows it, so a person sees what each model
   * would think at before choosing. Nothing, and the row's bars are all dark.
   */
  levelFor?: (model: ModelLevelPickerModel, group: ModelLevelPickerGroup) => string | undefined
  /** Called with a model, or a model and a level, when one is chosen. The picker then closes. */
  onValueChange?: (value: ModelLevelPickerValue) => void
  /** The starred models, in the order they were starred. Without `onStarredChange` there are no stars. */
  starred?: readonly ModelLevelPickerModelRef[]
  onStarredChange?: (starred: ModelLevelPickerModelRef[]) => void
  /**
   * Fast mode, a bolt beside search. `available` is whether the model in use
   * offers it; the bolt is there either way and disabled where it does not.
   */
  fast?: { available: boolean; pressed: boolean; onPressedChange: (pressed: boolean) => void }
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  starredEmptyMessage?: string
  /** The accessible name of the dialog. @defaultValue "Choose a model" */
  contentLabel?: string
  triggerLabel?: string
  className?: string
  contentClassName?: string
  /** Where the dialog mounts; the nearest Nessa portal container by default. */
  container?: HTMLElement | null
  /**
   * A sideways trackpad swipe over a model's row moves that model's level,
   * as ← and → do, without closing. Fingers moving right light more bars.
   * Scrolling up and down still scrolls the list.
   */
  swipeLevels?: boolean
}

/** How far a sideways swipe goes for one level, in pixels. */
const LEVEL_STEP = 44
/** A pause this long between wheel events starts a new gesture. */
const GESTURE_GAP_MS = 160

type Filter = { kind: "starred" } | { kind: "all" } | { kind: "group"; id: string }

interface Row {
  group: ModelLevelPickerGroup
  model: ModelLevelPickerModel
  key: string
}

const rowKey = (providerId: string, modelId: string) => JSON.stringify([providerId, modelId])

function sameRef(a: ModelLevelPickerModelRef | undefined, providerId: string, modelId: string) {
  return a?.providerId === providerId && a.modelId === modelId
}

function accentStyle(group: ModelLevelPickerGroup): React.CSSProperties | undefined {
  if (!group.accent && !group.accentForeground) return undefined
  return {
    ...(group.accent ? { "--model-level-picker-accent": group.accent } : {}),
    ...(group.accentForeground
      ? { "--model-level-picker-accent-foreground": group.accentForeground }
      : {}),
  } as React.CSSProperties
}

/** The provider's mark on its 16px tile; filled with the provider's colour when chosen. */
function ModelLevelPickerMark({
  group,
  selected = false,
}: {
  group: ModelLevelPickerGroup
  selected?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="model-level-picker-mark"
      data-selected={selected || undefined}
      style={accentStyle(group)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted font-mono text-[0.55em] font-semibold text-[var(--model-level-picker-accent,var(--foreground))] transition-colors [transition-duration:var(--nessa-motion-duration-fast)] motion-reduce:transition-none [&_svg]:size-[11px]",
        selected &&
          "bg-[var(--model-level-picker-accent,var(--foreground))] text-[var(--model-level-picker-accent-foreground,var(--background))]",
      )}
    >
      {group.icon ?? group.label.slice(0, 2)}
    </span>
  )
}

/**
 * The bars a row draws: one per level that lights one, rising, lit up to the
 * level the row shows. Each bar chooses its model at its level, except that
 * the lowest bar is a toggle: pressed while it is the only one lit, it chooses
 * the model's unlit level, so a pointer can turn thinking off too.
 */
function LevelBars({
  row,
  lit,
  onChoose,
}: {
  row: Row
  lit: string | undefined
  onChoose: (level: string) => void
}) {
  const levels = row.model.levels ?? []
  const bars = levels.filter((level) => !level.unlit)
  if (bars.length === 0) return <span data-slot="model-level-picker-bars" className="w-14 shrink-0" />
  const litAt = levels.findIndex((level) => level.value === lit)
  const off = levels.find((level) => level.unlit)
  return (
    <span
      data-slot="model-level-picker-bars"
      className="flex h-[18px] w-14 shrink-0 items-end justify-end gap-px"
    >
      {bars.map((level, index) => {
        const on = litAt >= 0 && levels.indexOf(level) <= litAt
        const turnsOff = off !== undefined && index === 0 && level.value === lit
        const target = turnsOff ? off : level
        return (
          <button
            key={level.value}
            type="button"
            tabIndex={-1}
            data-slot="model-level-picker-bar"
            data-level={level.value}
            data-lit={on || undefined}
            aria-label={`${row.model.label}, ${target.label}`}
            disabled={row.model.disabled}
            onClick={(event) => {
              event.stopPropagation()
              onChoose(target.value)
            }}
            className="group/bar flex h-[18px] w-2.5 items-end justify-center outline-none"
          >
            <i
              aria-hidden="true"
              style={{ height: `${5 + Math.round((11 * (index + 1)) / bars.length)}px` }}
              className={cn(
                "block w-1 rounded-[1.5px] bg-muted-foreground/35 transition-colors [transition-duration:var(--nessa-motion-duration-fast)] group-hover/bar:bg-muted-foreground motion-reduce:transition-none",
                on &&
                  "bg-[color-mix(in_oklab,var(--model-level-picker-accent,var(--foreground))_55%,transparent)] group-hover/row:bg-[var(--model-level-picker-accent,var(--foreground))] group-focus-visible/row:bg-[var(--model-level-picker-accent,var(--foreground))] group-data-[selected]/row:bg-[var(--model-level-picker-accent,var(--foreground))]",
              )}
            />
          </button>
        )
      })}
    </span>
  )
}

/**
 * The model and how hard it thinks, chosen in one place. A chip names the
 * model in use and its level ("Opus 5 · Low"); it opens a modal dialog with
 * search and Fast across the top, providers in a rail down the left (Starred,
 * All, then each provider, scrolling on its own as providers are added), and
 * the models on the right.
 *
 * Each row is a model's mark, its name, a star, and its thinking levels as
 * rising bars lit up to the level it would take. Pressing a name chooses the
 * model and keeps the host's level; pressing a bar chooses the model at that
 * level; pressing the lowest bar while it alone is lit turns thinking off,
 * when the model can. Either closes the picker. The model in use has its mark's tile
 * filled with its provider's colour. From the keyboard: ↑ ↓ move between
 * rows, ← → choose the row's model a level down or up, Enter chooses the row,
 * `s` stars it, and `/` goes to search.
 *
 * Which level a model shows, and which it takes when chosen by name, is the
 * host's (`levelFor`, `onValueChange`): the picker knows no level names.
 */
function ModelLevelPicker({
  ref,
  groups,
  value,
  levelFor,
  onValueChange,
  starred = [],
  onStarredChange,
  fast,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  placeholder = "Choose model",
  searchPlaceholder,
  emptyMessage = "No model matches",
  starredEmptyMessage = "Star a model to keep it here",
  contentLabel = "Choose a model",
  triggerLabel,
  className,
  contentClassName,
  container: containerProp,
  swipeLevels = false,
}: ModelLevelPickerProps) {
  const container = usePortalContainer(containerProp)
  const layerScope = useNessaLayerScope()
  const layers = usePortalContainerHost()
  const focusReturn = useOpenerFocusReturn()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const composedTriggerRef = useComposedRefs(triggerRef, ref)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const [query, setQuery] = React.useState("")
  const starsOffered = onStarredChange !== undefined
  const [filter, setFilter] = React.useState<Filter>({ kind: "all" })

  const selectedGroup = groups.find((group) => group.id === value?.providerId)
  const selectedModel = selectedGroup?.models.find((model) => model.id === value?.modelId)
  const selectedLevel =
    selectedGroup && selectedModel
      ? selectedModel.levels?.find(
          (level) => level.value === levelFor?.(selectedModel, selectedGroup),
        )
      : undefined

  const allRows = React.useMemo<Row[]>(
    () =>
      groups.flatMap((group) =>
        group.models.map((model) => ({ group, model, key: rowKey(group.id, model.id) })),
      ),
    [groups],
  )
  const isStarred = (row: Row) => starred.some((ref) => sameRef(ref, row.group.id, row.model.id))
  // A star on a model the groups no longer list is kept, but neither shown nor counted.
  const starredRows = starred
    .map((ref) => allRows.find((row) => sameRef(ref, row.group.id, row.model.id)))
    .filter((row): row is Row => row !== undefined)

  /** Where the picker opens: the starred list when there is one, else the provider in use. */
  const openingFilter = (): Filter => {
    if (starsOffered && starredRows.length > 0) return { kind: "starred" }
    if (selectedGroup) return { kind: "group", id: selectedGroup.id }
    return { kind: "all" }
  }

  // Each opening starts afresh, however it was opened (the trigger, `open`,
  // `defaultOpen`): adjusted while rendering, so no frame shows the last one.
  const [openedAt, setOpenedAt] = React.useState(false)
  if (open !== openedAt) {
    setOpenedAt(open)
    if (open) {
      setFilter(openingFilter())
      setQuery("")
    }
  }

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const normalized = query.trim().toLocaleLowerCase()
  const visible: Row[] = normalized
    ? allRows.filter((row) =>
        [row.model.label, row.model.shortLabel, row.group.label, row.model.id].some((text) =>
          text?.toLocaleLowerCase().includes(normalized),
        ),
      )
    : filter.kind === "starred"
      ? starredRows
      : filter.kind === "group"
        ? allRows.filter((row) => row.group.id === filter.id)
        : allRows
  const grouped = normalized !== "" || filter.kind === "all"

  const choose = (row: Row, level?: string) => {
    if (row.model.disabled) return
    onValueChange?.({
      providerId: row.group.id,
      modelId: row.model.id,
      ...(level === undefined ? {} : { level }),
    })
    setOpen(false)
  }

  const toggleStar = (row: Row) => {
    if (!onStarredChange) return
    const ref = { providerId: row.group.id, modelId: row.model.id }
    onStarredChange(
      isStarred(row)
        ? starred.filter((each) => !sameRef(each, ref.providerId, ref.modelId))
        : [...starred, ref],
    )
  }

  // A row unstarred from the keyboard on Starred leaves the list: the keys
  // go to the row after it (or before it), or to search once none is left.
  const focusAfterLeaving = React.useRef<{ leaving: string; next: string | undefined } | null>(null)
  React.useLayoutEffect(() => {
    const pending = focusAfterLeaving.current
    if (!pending || rowElements().some((row) => row.dataset.key === pending.leaving)) return
    focusAfterLeaving.current = null
    if (pending.next) focusRow(pending.next)
    else searchRef.current?.focus()
  })

  const rowElements = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-slot="model-level-picker-row"]') ?? [],
    )

  const focusRow = (key: string | undefined, fallback: "first" | "last" = "first") => {
    const rows = rowElements()
    const target =
      rows.find((row) => row.dataset.key === key) ?? (fallback === "first" ? rows[0] : rows.at(-1))
    target?.focus()
    target?.scrollIntoView?.({ block: "nearest" })
  }

  /**
   * Moves a row's level one step, without closing, so a person can step
   * through it. With no level lit yet, a step up lights the first and a step
   * down the last.
   */
  const stepLevel = (row: Row, step: 1 | -1) => {
    const levels = row.model.levels ?? []
    if (levels.length === 0 || row.model.disabled) return
    const current = levels.findIndex((level) => level.value === levelFor?.(row.model, row.group))
    const at = current < 0 ? (step > 0 ? 0 : levels.length - 1) : current + step
    const next = levels[Math.max(0, Math.min(levels.length - 1, at))]
    if (!next || next.value === levelFor?.(row.model, row.group)) return
    onValueChange?.({ providerId: row.group.id, modelId: row.model.id, level: next.value })
  }

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, row: Row) => {
    if (event.target !== event.currentTarget) return
    const rows = rowElements()
    const at = rows.indexOf(event.currentTarget)
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault()
        const next = rows[at + (event.key === "ArrowDown" ? 1 : -1)]
        if (next) {
          next.focus()
          next.scrollIntoView?.({ block: "nearest" })
        } else if (event.key === "ArrowUp") searchRef.current?.focus()
        return
      }
      case "Home":
      case "End":
        event.preventDefault()
        focusRow(undefined, event.key === "Home" ? "first" : "last")
        return
      case "ArrowLeft":
      case "ArrowRight": {
        if ((row.model.levels ?? []).length === 0) return
        event.preventDefault()
        stepLevel(row, event.key === "ArrowRight" ? 1 : -1)
        return
      }
      case "Enter":
      case " ":
        event.preventDefault()
        choose(row)
        return
      case "s":
      case "S":
        if (event.metaKey || event.ctrlKey || event.altKey) return
        event.preventDefault()
        if (filter.kind === "starred" && !normalized && isStarred(row))
          focusAfterLeaving.current = {
            leaving: row.key,
            next: (rows[at + 1] ?? rows[at - 1])?.dataset.key,
          }
        toggleStar(row)
        return
      case "/":
        event.preventDefault()
        searchRef.current?.focus()
        return
    }
  }

  const railEntries: { filter: Filter; label: string; icon: React.ReactNode; count: number; group?: ModelLevelPickerGroup }[] = [
    ...(starsOffered
      ? [{ filter: { kind: "starred" } as Filter, label: "Starred", icon: <Star className="size-3.5" fill="currentColor" />, count: starredRows.length }]
      : []),
    { filter: { kind: "all" }, label: "All models", icon: <LayoutGrid className="size-3.5" />, count: allRows.length },
    ...groups.map((group) => ({
      filter: { kind: "group", id: group.id } as Filter,
      label: group.label,
      icon: <ModelLevelPickerMark group={group} />,
      count: group.models.length,
      group,
    })),
  ]
  const sameFilter = (a: Filter, b: Filter) =>
    a.kind === b.kind && (a.kind !== "group" || (b.kind === "group" && a.id === b.id))

  // One Tab stop in the list: the model in use where it is shown, else the first.
  const tabStop =
    visible.find((row) => sameRef(value, row.group.id, row.model.id))?.key ?? visible[0]?.key

  // One wheel gesture keeps to the direction its first event took. A
  // sideways one steps the level of the row it began over; an up-and-down
  // one is left to scroll the list. The latest render's rows and handler are
  // read through a ref, since the listener is added once.
  const gesture = React.useRef<{ axis?: "x" | "y"; row?: string; sum: number; last: number }>({
    sum: 0,
    last: -Infinity,
  })
  const swipeState = React.useRef({ visible, stepLevel })
  swipeState.current = { visible, stepLevel }
  const listSwipeRef = React.useCallback(
    (list: HTMLDivElement | null) => {
      listRef.current = list
      if (!list || !swipeLevels) return
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey) return // a pinch zooms
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1
        const dx = event.deltaX * scale
        const dy = event.deltaY * scale
        const state = gesture.current
        if (event.timeStamp - state.last > GESTURE_GAP_MS) {
          state.axis = undefined
          state.row = undefined
          state.sum = 0
        }
        state.last = event.timeStamp
        if (dx === 0 && dy === 0) return
        if (!state.axis) {
          state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
          state.row = (event.target as Element | null)
            ?.closest?.<HTMLElement>('[data-slot="model-level-picker-row"]')?.dataset.key
        }
        if (state.axis === "y") return
        event.preventDefault()
        const row = swipeState.current.visible.find((each) => each.key === state.row)
        if (!row) return
        // Fingers moving right light more bars: on a Mac that is a negative deltaX.
        state.sum -= dx
        while (Math.abs(state.sum) >= LEVEL_STEP) {
          const step = state.sum > 0 ? 1 : -1
          state.sum -= step * LEVEL_STEP
          swipeState.current.stepLevel(row, step)
        }
      }
      list.addEventListener("wheel", onWheel, { passive: false })
      return () => list.removeEventListener("wheel", onWheel)
    },
    [swipeLevels],
  )

  const renderRow = (row: Row) => {
    const selected = sameRef(value, row.group.id, row.model.id)
    const starredRow = isStarred(row)
    const lit = levelFor?.(row.model, row.group)
    return (
      <div
        key={row.key}
        role="option"
        tabIndex={row.key === tabStop ? 0 : -1}
        aria-selected={selected}
        aria-disabled={row.model.disabled || undefined}
        aria-keyshortcuts={starsOffered ? "S" : undefined}
        data-slot="model-level-picker-row"
        data-key={row.key}
        data-provider={row.group.id}
        data-model={row.model.id}
        data-selected={selected || undefined}
        style={accentStyle(row.group)}
        onClick={() => choose(row)}
        onKeyDown={(event) => onRowKeyDown(event, row)}
        className={cn(
          "group/row flex h-[34px] min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 nessa-text-3 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-45",
          selected && "text-foreground",
        )}
      >
        <ModelLevelPickerMark group={row.group} selected={selected} />
        <span data-slot="model-level-picker-row-label" className="min-w-0 flex-1 truncate">
          {row.model.label}
        </span>
        {starsOffered ? (
          <button
            type="button"
            tabIndex={-1}
            data-slot="model-level-picker-star"
            aria-pressed={starredRow}
            aria-label={`${starredRow ? "Unstar" : "Star"} ${row.model.label}`}
            onClick={(event) => {
              event.stopPropagation()
              toggleStar(row)
            }}
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 outline-none transition-opacity [transition-duration:var(--nessa-motion-duration-fast)] hover:bg-background/40 hover:text-muted-foreground group-hover/row:opacity-100 group-focus-visible/row:opacity-100 motion-reduce:transition-none",
              starredRow && "text-muted-foreground opacity-100",
            )}
          >
            <Star className="size-3.5" fill={starredRow ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ) : null}
        <LevelBars row={row} lit={lit} onChoose={(level) => choose(row, level)} />
      </div>
    )
  }

  const rows = () => {
    if (visible.length === 0) {
      return (
        <p data-slot="model-level-picker-empty" className="m-0 px-2 py-4 nessa-text-3 text-muted-foreground">
          {normalized ? `${emptyMessage} “${query.trim()}”` : filter.kind === "starred" ? starredEmptyMessage : emptyMessage}
        </p>
      )
    }
    if (!grouped) return visible.map(renderRow)
    return groups.map((group) => {
      const inGroup = visible.filter((row) => row.group.id === group.id)
      if (inGroup.length === 0) return null
      return (
        <div key={group.id} role="group" aria-label={group.label} className="grid gap-px">
          <div
            aria-hidden="true"
            data-slot="model-level-picker-group-label"
            className="px-2 pt-2 pb-1 nessa-text-1 font-medium uppercase tracking-[0.05em] text-muted-foreground/70"
          >
            {group.label}
          </div>
          {inGroup.map(renderRow)}
        </div>
      )
    })
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          ref={composedTriggerRef}
          type="button"
          data-slot="model-level-picker-trigger"
          disabled={disabled}
          aria-label={
            triggerLabel ??
            (selectedModel
              ? `Change model, currently ${selectedModel.label}${selectedLevel ? `, ${selectedLevel.label}` : ""}`
              : placeholder)
          }
          className={cn(
            "inline-flex h-9 min-w-9 max-w-72 shrink items-center gap-1.5 rounded-full px-3 font-sans nessa-text-4 font-medium text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
        >
          {selectedGroup ? <ModelLevelPickerMark group={selectedGroup} /> : null}
          <span data-slot="model-level-picker-trigger-label" className="min-w-0 truncate">
            {selectedModel ? (selectedModel.shortLabel ?? selectedModel.label) : placeholder}
          </span>
          {selectedLevel ? (
            <span data-slot="model-level-picker-trigger-level" className="shrink-0 text-muted-foreground">
              {selectedLevel.label}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay
          {...layerScope}
          data-slot="model-level-picker-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-xs"
        >
          <DialogPrimitive.Content
            ref={panelRef}
            data-slot="model-level-picker"
            aria-modal="true"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              focusReturn.capture(panelRef.current)
              event.preventDefault()
              searchRef.current?.focus()
            }}
            onCloseAutoFocus={(event) => focusReturn.release(event)}
            // Escape with a search clears it first; the dialog listens before the field does.
            onEscapeKeyDown={(event) => {
              if (!query) return
              event.preventDefault()
              setQuery("")
              searchRef.current?.focus()
            }}
            className={cn(
              "flex h-[min(28rem,100%)] w-full max-w-[39rem] flex-col font-sans outline-none",
              contentClassName,
            )}
          >
            <PortalContainerProvider container={layers.container}>
              <div
                data-slot="model-level-picker-surface"
                className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden rounded-xl border border-foreground/15 bg-popover text-popover-foreground shadow-2xl animate-nessa-enter"
              >
                <DialogPrimitive.Title className="sr-only">{contentLabel}</DialogPrimitive.Title>
                <div data-slot="model-level-picker-top" className="flex items-center gap-2 border-b border-foreground/8 p-2.5">
                  <label
                    data-slot="model-level-picker-search"
                    className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-foreground/8 bg-background/50 px-2.5 text-muted-foreground"
                  >
                    <Search aria-hidden="true" className="size-3.5 shrink-0" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Search models"
                      placeholder={searchPlaceholder ?? `Search ${allRows.length} models`}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          event.preventDefault()
                          focusRow(value ? rowKey(value.providerId, value.modelId) : undefined)
                        } else if (event.key === "Enter") {
                          const first = visible.find((row) => !row.model.disabled)
                          if (first) {
                            event.preventDefault()
                            choose(first)
                          }
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent nessa-text-3 text-foreground outline-none placeholder:text-muted-foreground/70"
                    />
                  </label>
                  {fast ? (
                    <ModelFastMode
                      pressed={fast.available && fast.pressed}
                      onPressedChange={fast.onPressedChange}
                      disabled={!fast.available}
                      title={fast.available ? "Fast mode" : "This model has no Fast mode"}
                      data-slot="model-level-picker-fast"
                      className="rounded-lg border border-foreground/8"
                    />
                  ) : null}
                </div>
                <div className="grid min-h-0 grid-cols-[11rem_1fr] max-sm:grid-cols-[3.25rem_1fr]">
                  <nav
                    aria-label="Providers"
                    data-slot="model-level-picker-rail"
                    className="grid min-h-0 content-start gap-px overflow-y-auto border-r border-foreground/8 p-1.5 [scrollbar-width:thin]"
                  >
                    {railEntries.map((entry, index) => {
                      const current = !normalized && sameFilter(entry.filter, filter)
                      const inUse = entry.group !== undefined && entry.group.id === selectedGroup?.id
                      return (
                        <React.Fragment key={entry.filter.kind === "group" ? entry.filter.id : entry.filter.kind}>
                          {entry.group && index > 0 && !railEntries[index - 1]?.group ? (
                            <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-foreground/8" />
                          ) : null}
                          <button
                            type="button"
                            data-slot="model-level-picker-rail-item"
                            data-filter={entry.filter.kind === "group" ? entry.filter.id : entry.filter.kind}
                            aria-current={current ? "true" : undefined}
                            aria-label={inUse ? `${entry.label}, in use` : entry.label}
                            title={entry.label}
                            onClick={() => {
                              setQuery("")
                              setFilter(entry.filter)
                              if (listRef.current) listRef.current.scrollTop = 0
                            }}
                            className={cn(
                              "flex h-[30px] w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left nessa-text-3 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:justify-center max-sm:px-0",
                              current && "bg-accent text-foreground",
                            )}
                          >
                            <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
                              {entry.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate max-sm:hidden">{entry.label}</span>
                            {inUse ? (
                              <span
                                data-slot="model-level-picker-in-use"
                                aria-hidden="true"
                                className="size-[5px] shrink-0 rounded-full bg-foreground max-sm:hidden"
                              />
                            ) : null}
                            <span aria-hidden="true" className="shrink-0 font-mono nessa-text-1 text-muted-foreground/70 max-sm:hidden">
                              {entry.count}
                            </span>
                          </button>
                        </React.Fragment>
                      )
                    })}
                  </nav>
                  <div
                    ref={listSwipeRef}
                    role="listbox"
                    aria-label="Models"
                    data-slot="model-level-picker-list"
                    className="grid min-h-0 min-w-0 content-start gap-px overflow-y-auto p-1.5 [scrollbar-width:thin]"
                  >
                    {rows()}
                  </div>
                </div>
              </div>
            </PortalContainerProvider>
            <div ref={layers.setContainer} data-slot="model-level-picker-layers" />
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { ModelLevelPicker, ModelLevelPickerMark }
