/** @responsibility The WindowDeck's overview geometry: how many columns a viewport takes, and the transform that carries each pane from its carousel position to its tile. */

/** A measured rectangle, in viewport pixels. */
export interface WindowDeckRect {
  /** Distance from the viewport's left edge to the rectangle's left edge. */
  left: number
  /** Distance from the viewport's top edge to the rectangle's top edge. */
  top: number
  /** The rectangle's width. */
  width: number
  /** The rectangle's height. */
  height: number
}

/** The space the overview grid is laid out inside, in pixels. */
export interface WindowDeckViewport {
  /** Usable width. */
  width: number
  /** Usable height. */
  height: number
}

/** Space reserved around the overview grid, in pixels. */
export interface WindowDeckOverviewInsets {
  /** Space above the first row. */
  top: number
  /** Space below the last row, where a host's dock or composer would sit. */
  bottom: number
  /** Space at each side of the grid. */
  horizontal: number
}

/** How the overview grid is proportioned. */
export interface WindowDeckOverviewOptions {
  /**
   * Column count. Omit to derive it from the viewport width and the size of
   * the deck: a small deck takes two columns below 720px and three above it,
   * and a larger one takes as many columns as it needs to stay within
   * `maxRows`, so tiles stop shrinking once the grid is deep.
   */
  columns?: number
  /**
   * How many rows the grid may use before it widens instead of shrinking.
   * @defaultValue 3, or 4 below 720px
   */
  maxRows?: number
  /** Space between tiles, both axes. @defaultValue 28 */
  gap?: number
  /**
   * Space around the grid. Raise `bottom` when the host draws a dock or a
   * composer over the deck, so the tiles are not laid out underneath it.
   * @defaultValue 32 top and bottom, responsive sides
   */
  insets?: Partial<WindowDeckOverviewInsets>
  /**
   * The smallest a tile may be scaled to before the deck reports that it has
   * no room for an overview at all. Below this a tile carries no readable
   * content and is barely a pointer target.
   * @defaultValue 0.12
   */
  minScale?: number
}

/** The transform that moves one pane from where it sits to its tile. */
export interface WindowDeckTile {
  /** Horizontal translation, in pixels. */
  x: number
  /** Vertical translation, in pixels. */
  y: number
  /** Uniform scale factor. */
  scale: number
}

/** The smallest tile the overview will present, as a scale factor. */
const MIN_TILE_SCALE = 0.12

/** The narrow viewport below which the overview drops to two columns. */
const NARROW_VIEWPORT = 720

/**
 * Chooses a column count for the overview.
 *
 * @param count - How many panes the deck holds.
 * @param viewportWidth - The width the grid is laid out inside.
 * @returns At least one column, and never more than there are panes.
 */
export function computeOverviewColumns(
  count: number,
  viewportWidth: number,
  maxRows?: number,
): number {
  if (count <= 0) return 0

  const narrow = viewportWidth < NARROW_VIEWPORT
  const rows = Math.max(1, Math.floor(maxRows ?? (narrow ? 4 : 3)))
  const base = narrow ? 2 : 3

  // A deck deeper than the grid allows widens rather than shrinking: one
  // viewport height divided by an unbounded row count is how an overview of
  // twenty windows ends up as a field of unreadable smudges.
  return Math.max(1, Math.min(count, Math.max(base, Math.ceil(count / rows))))
}

/**
 * Resolves the insets the grid is laid out inside, filling anything the host
 * left unspecified with the responsive defaults.
 *
 * @param viewportWidth - The width the grid is laid out inside.
 * @param insets - The host's partial override.
 * @returns Every inset, in pixels.
 */
function resolveInsets(
  viewportWidth: number,
  insets: Partial<WindowDeckOverviewInsets> | undefined,
): WindowDeckOverviewInsets {
  const narrow = viewportWidth < NARROW_VIEWPORT

  return {
    top: insets?.top ?? 32,
    // Symmetric by default. A deck is not assumed to have a dock or a
    // composer under it; a host that puts one there says so, and everything
    // else gets a grid that sits in the middle of its box rather than one
    // pushed up against the top edge with a band of dead space below it.
    bottom: insets?.bottom ?? 32,
    horizontal:
      insets?.horizontal ?? (narrow ? 20 : Math.max(48, viewportWidth * 0.07)),
  }
}

/**
 * Places every pane on the overview grid.
 *
 * Each pane is translated so its centre lands on its tile's centre and scaled
 * by one factor shared across the deck, so tiles read as the same surface
 * shrunk rather than as separately fitted boxes. The transform is relative to
 * where the pane currently sits, which is what a CSS transform applies to.
 *
 * @param rects - Each pane's current rectangle, in pane order.
 * @param viewport - The space the grid is laid out inside.
 * @param options - Column, gap, and inset overrides.
 * @returns One transform per pane, in the order the rectangles arrived; an
 * empty array when there are no panes, and `null` when the deck is too small
 * to hold a grid at all — a caller that gets `null` must stay in the
 * carousel rather than present an overview nobody can read or scroll.
 */
export function computeOverviewTiles(
  rects: readonly WindowDeckRect[],
  viewport: WindowDeckViewport,
  options: WindowDeckOverviewOptions = {},
): WindowDeckTile[] | null {
  if (rects.length === 0) return []

  const columns =
    options.columns !== undefined
      ? Math.max(1, Math.min(rects.length, Math.floor(options.columns)))
      : computeOverviewColumns(rects.length, viewport.width, options.maxRows)
  const rows = Math.ceil(rects.length / columns)
  const gap = options.gap ?? 28
  const insets = resolveInsets(viewport.width, options.insets)

  const tileWidth =
    (viewport.width - insets.horizontal * 2 - gap * (columns - 1)) / columns
  const tileHeight =
    (viewport.height - insets.top - insets.bottom - gap * (rows - 1)) / rows

  // No room for a grid. Returning identity transforms here would leave the
  // deck in a mode where nothing has moved, snapping is off, and the panes
  // beyond the fold cannot be reached at all.
  if (tileWidth <= 0 || tileHeight <= 0) return null

  // One factor for the whole deck: the pane that fits least generously sets
  // it, so no tile overflows its cell and none is scaled differently.
  const scale = rects.reduce((smallest, rect) => {
    if (rect.width <= 0 || rect.height <= 0) return smallest

    return Math.min(smallest, tileWidth / rect.width, tileHeight / rect.height)
  }, Number.POSITIVE_INFINITY)
  const uniformScale = Number.isFinite(scale) ? Math.min(scale, 1) : 1

  // Too small to be an overview. A grid of unreadable smudges is worse than
  // staying in the carousel, so the caller is told there is no room.
  if (uniformScale < (options.minScale ?? MIN_TILE_SCALE)) return null

  return rects.map((rect, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    // The final row is centred when it is short, so a deck of five reads as a
    // composition rather than as a grid with a hole in the corner.
    const columnsInRow = Math.min(columns, rects.length - row * columns)
    const rowWidth = columnsInRow * tileWidth + (columnsInRow - 1) * gap
    const rowLeft = (viewport.width - rowWidth) / 2

    const tileCentreX = rowLeft + column * (tileWidth + gap) + tileWidth / 2
    const tileCentreY = insets.top + row * (tileHeight + gap) + tileHeight / 2

    return {
      x: tileCentreX - (rect.left + rect.width / 2),
      y: tileCentreY - (rect.top + rect.height / 2),
      scale: uniformScale,
    }
  })
}
