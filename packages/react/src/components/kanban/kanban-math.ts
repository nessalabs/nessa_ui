"use client"

/** @responsibility Pure list math for the kanban board: insertion-index and drop-indicator geometry from card rectangles, and the column-map transform a settled move produces. */

/** The vertical extent of one card, in any consistent coordinate space. */
interface KanbanCardExtent {
  top: number
  height: number
}

/** A settled card move reported to the board consumer. */
interface KanbanMove {
  /** The card that moved. */
  cardId: string
  /** The column the card left. */
  fromColumn: string
  /** The column the card landed in. */
  toColumn: string
  /**
   * The card's position in the target column, counted with the moved card
   * already removed from its source position.
   */
  index: number
}

/**
 * Restricts a number to a closed range.
 *
 * @param value - The number to restrict.
 * @param min - The smallest allowed value.
 * @param max - The largest allowed value.
 * @returns The value moved inside the range.
 */
function clampKanbanNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max) + 0
}

/**
 * Computes where a pointer would insert a card into a column: the number of
 * cards whose vertical midpoint sits above the pointer.
 *
 * @param cards - The column's card extents in visual order, excluding the
 * card being moved.
 * @param pointerY - The pointer's position in the same coordinate space.
 * @returns The insertion index, from 0 through `cards.length`.
 */
function kanbanInsertionIndex(
  cards: readonly KanbanCardExtent[],
  pointerY: number,
): number {
  let index = 0

  for (const card of cards) {
    if (pointerY > card.top + card.height / 2) {
      index += 1
    }
  }

  return index
}

/**
 * Computes where the opened slot begins for an insertion index — the top
 * of the space the cards part to make, which is where the moved card would
 * come to rest.
 *
 * @param cards - The column's card extents in visual order, excluding the
 * card being moved.
 * @param index - The insertion index, from 0 through `cards.length`.
 * @param emptyTop - The slot position when the column has no cards.
 * @param spacing - The gap the column keeps between cards.
 * @returns The slot's top in the cards' coordinate space.
 */
function kanbanGapTop(
  cards: readonly KanbanCardExtent[],
  index: number,
  emptyTop: number,
  spacing: number,
): number {
  if (cards.length === 0) {
    return emptyTop
  }

  const clamped = clampKanbanNumber(Math.round(index), 0, cards.length)

  // Every card from the insertion point down shifts to open the slot, so
  // the slot starts exactly where the first shifted card sits now.
  if (clamped < cards.length) {
    return cards[clamped].top
  }

  const last = cards[cards.length - 1]

  return last.top + last.height + spacing
}

/**
 * Applies a settled move to a map of column card-id lists — the transform a
 * consumer typically wants in its `onCardMove` handler.
 *
 * @param columns - Card ids per column id.
 * @param move - The settled move.
 * @returns A new map with the card removed from its source position and
 * inserted at the move's index in the target column; the index is clamped
 * into the target list. Untouched columns keep their original arrays.
 */
function applyKanbanMove(
  columns: Readonly<Record<string, readonly string[]>>,
  move: KanbanMove,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}

  for (const [columnId, cardIds] of Object.entries(columns)) {
    next[columnId] = [...cardIds]
  }

  const source = next[move.fromColumn]

  if (source) {
    const position = source.indexOf(move.cardId)

    if (position !== -1) {
      source.splice(position, 1)
    }
  }

  const target = (next[move.toColumn] ??= [])
  const index = clampKanbanNumber(Math.round(move.index), 0, target.length)

  target.splice(index, 0, move.cardId)

  return next
}

export {
  applyKanbanMove,
  clampKanbanNumber,
  kanbanGapTop,
  kanbanInsertionIndex,
  type KanbanCardExtent,
  type KanbanMove,
}
