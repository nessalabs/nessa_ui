"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CornerDownRight, Ellipsis, GripVertical, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComposerDeliveryModeValue = "queue" | "steer"

export interface ComposerDeliveryModeProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: ComposerDeliveryModeValue
  onValueChange: (value: ComposerDeliveryModeValue) => void
  disabled?: boolean
}

function ComposerDeliveryMode({
  value,
  onValueChange,
  disabled = false,
  className,
  ...props
}: ComposerDeliveryModeProps) {
  return (
    <div
      data-slot="composer-delivery-mode"
      role="group"
      aria-label="Message delivery mode"
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5",
        className,
      )}
      {...props}
    >
      {(["queue", "steer"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          disabled={disabled}
          onClick={() => onValueChange(mode)}
          className={cn(
            "h-7 rounded-full px-2.5 font-sans nessa-text-2 font-medium capitalize text-muted-foreground outline-none transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
            value === mode && "bg-background text-foreground shadow-xs",
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

export interface ComposerQueueProps extends React.ComponentProps<"ol"> {
  itemIds: string[]
  onReorder: (itemIds: string[]) => void
}

function dragItemLabel(item: {
  id: string | number
  data: React.MutableRefObject<Record<string, unknown> | undefined>
}) {
  const itemLabel = item.data.current?.itemLabel
  return typeof itemLabel === "string" ? itemLabel : String(item.id)
}

const composerQueueAnnouncements: Announcements = {
  onDragStart: ({ active }) =>
    `Picked up pending message: ${dragItemLabel(active)}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `Pending message ${dragItemLabel(active)} moved over ${dragItemLabel(over)}.`
      : `Pending message ${dragItemLabel(active)} is no longer over the queue.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `Dropped pending message ${dragItemLabel(active)} near ${dragItemLabel(over)}.`
      : `Dropped pending message ${dragItemLabel(active)}.`,
  onDragCancel: ({ active }) =>
    `Cancelled moving pending message: ${dragItemLabel(active)}.`,
}

function ComposerQueue({
  itemIds,
  onReorder,
  className,
  ...props
}: ComposerQueueProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = React.useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return
      const activeIndex = itemIds.indexOf(String(active.id))
      const overIndex = itemIds.indexOf(String(over.id))
      if (activeIndex < 0 || overIndex < 0) return
      onReorder(arrayMove(itemIds, activeIndex, overIndex))
    },
    [itemIds, onReorder],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements: composerQueueAnnouncements }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ol
          data-slot="composer-queue"
          aria-label="Pending messages"
          className={cn(
            "m-0 grid list-none overflow-hidden rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-sm",
            className,
          )}
          {...props}
        />
      </SortableContext>
    </DndContext>
  )
}

export interface ComposerQueueItemProps extends React.ComponentProps<"li"> {
  id: string
  itemLabel: string
  onSteer?: () => void
  onRemove?: () => void
  onMore?: () => void
  steerLabel?: string
}

function ComposerQueueItem({
  id,
  itemLabel,
  onSteer,
  onRemove,
  onMore,
  steerLabel = "Steer",
  className,
  children,
  style,
  ...props
}: ComposerQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { itemLabel } })

  return (
    <li
      ref={setNodeRef}
      data-slot="composer-queue-item"
      data-dragging={isDragging ? "true" : "false"}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        "--composer-queue-sort-transition": transition,
      } as React.CSSProperties}
      // The sort-transition class applies only while dnd-kit supplies one, so
      // an idle item leaves consumer transition utilities untouched instead of
      // pinning `transition` to an unset custom property.
      className={cn(
        "group relative z-0 grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-2 py-1.5 font-sans last:border-b-0 data-[dragging=true]:z-10 data-[dragging=true]:rounded-xl data-[dragging=true]:shadow-lg",
        Boolean(transition) && "[transition:var(--composer-queue-sort-transition)]",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="composer-queue-handle"
        aria-label={`Reorder ${itemLabel}`}
        title={`Reorder ${itemLabel}`}
        className="flex size-7 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground/60 outline-none transition-colors hover:bg-accent hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
      <div className="min-w-0 truncate nessa-text-4 text-foreground">{children}</div>
      <div className="flex items-center gap-0.5">
        {onSteer ? (
          <button
            type="button"
            aria-label={`${steerLabel} ${itemLabel}`}
            onClick={onSteer}
            className="inline-flex h-7 items-center gap-1 rounded-full border-0 bg-transparent px-2 font-sans nessa-text-2 font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <CornerDownRight aria-hidden="true" className="size-3" />
            {steerLabel}
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${itemLabel}`}
            title={`Remove ${itemLabel}`}
            onClick={onRemove}
            className="inline-flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        {onMore ? (
          <button
            type="button"
            aria-label={`More actions for ${itemLabel}`}
            title={`More actions for ${itemLabel}`}
            onClick={onMore}
            className="inline-flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Ellipsis aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </li>
  )
}

export {
  ComposerDeliveryMode,
  ComposerQueue,
  ComposerQueueItem,
}
