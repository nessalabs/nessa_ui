/** @responsibility The WindowDeck's overview geometry: a readable strip of tiles, capped to what the viewport can show, with the rest waiting off to the side. */

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

/** The space the overview strip is laid out inside, in pixels. */
export interface WindowDeckViewport {
  /** Usable width. */
  width: number
  /** Usable height. */
  height: number
}

/** Space reserved around the overview strip, in pixels. */
export interface WindowDeckOverviewInsets {
  /** Space above the strip. */
  top: number
  /** Space below the strip, where a host's dock or composer would sit. */
  bottom: number
  /** Space at each side of the visible page of tiles. */
  horizontal: number
}

/** How the overview strip is proportioned. */
export interface WindowDeckOverviewOptions {
  /**
   * How many tiles the viewport may show at once. Extra tiles extend the
   * strip to the side and are reached by scrolling. `columns` is the same
   * cap under the name the grid used to use.
   * @defaultValue 8, then clamped to what still fits at `minTileWidth`
   */
  maxVisible?: number
  /**
   * Alias of `maxVisible`, kept so a host that still names columns does not
   * have to rename the field.
   */
  columns?: number
  /**
   * Unused. The overview is one row that scrolls sideways rather than a
   * grid that grows extra rows.
   * @deprecated The strip does not stack rows.
   */
  maxRows?: number
  /** Space between tiles. @defaultValue 28 */
  gap?: number
  /**
   * Space around the visible page of tiles. Raise `bottom` when the host
   * draws a dock or a composer over the deck, so the strip is not laid out
   * underneath it.
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
  /**
   * The smallest cell the visible page will try to reserve, in pixels. The
   * visible count drops until each on-screen tile is at least this wide.
   * @defaultValue 88
   */
  minTileWidth?: number
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

/**
 * The strip the overview lays out: one transform per pane, plus the
 * measurements the deck needs to scroll the tiles that did not fit.
 */
export interface WindowDeckOverviewLayout {
  /** One transform per pane, in pane order, at scroll offset 0. */
  tiles: WindowDeckTile[]
  /**
   * Each tile's centre in strip coordinates, origin at the viewport's left
   * edge when the strip has not been panned.
   */
  centres: readonly { x: number; y: number }[]
  /** Width of the strip including side insets. */
  contentWidth: number
  /** How many tiles the viewport shows at once. */
  visibleCount: number
  /** Cell width used for the strip. */
  tileWidth: number
}

/** The smallest tile the overview will present, as a scale factor. */
const MIN_TILE_SCALE = 0.12

/** The narrow viewport below which the strip tightens its side insets. */
const NARROW_VIEWPORT = 720

/** How many tiles a viewport may show before the rest scroll off to the side. */
const DEFAULT_MAX_VISIBLE = 8

/** The smallest on-screen tile the strip will try to reserve, in pixels. */
const DEFAULT_MIN_TILE_WIDTH = 88

/** Space between tiles when the host does not say otherwise. */
const DEFAULT_GAP = 28

/**
 * How many tiles a viewport can show at once.
 *
 * The count is the smaller of the pane count, the host's cap, and how many
 * cells of `minTileWidth` fit in the viewport. A deck of twenty windows
 * still shows a readable page; the rest of the strip is reached by
 * scrolling sideways.
 *
 * @param count - How many panes the deck holds.
 * @param viewportWidth - The width the strip is laid out inside.
 * @param maxVisible - The host's cap. @defaultValue 8
 * @returns At least one tile when the deck is not empty, and never more
 * than there are panes.
 */
export function computeOverviewColumns(
  count: number,
  viewportWidth: number,
  maxVisible?: number,
): number {
  return computeOverviewVisibleCount(count, viewportWidth, { maxVisible })
}

/**
 * How many tiles a viewport can show at once, honouring gap and inset
 * overrides the column helper does not take.
 *
 * @param count - How many panes the deck holds.
 * @param viewportWidth - The width the strip is laid out inside.
 * @param options - Cap, gap, inset, and minimum tile width overrides.
 * @returns At least one tile when the deck is not empty, and never more
 * than there are panes.
 */
export function computeOverviewVisibleCount(
  count: number,
  viewportWidth: number,
  options: Pick<
    WindowDeckOverviewOptions,
    "maxVisible" | "columns" | "gap" | "insets" | "minTileWidth"
  > = {},
): number {
  if (count <= 0) return 0

  const gap = options.gap ?? DEFAULT_GAP
  const insets = resolveInsets(viewportWidth, options.insets)
  const minTileWidth = options.minTileWidth ?? DEFAULT_MIN_TILE_WIDTH
  const availableWidth = viewportWidth - insets.horizontal * 2
  const cap = Math.max(
    1,
    Math.floor(options.maxVisible ?? options.columns ?? DEFAULT_MAX_VISIBLE),
  )
  const fitByWidth = Math.max(
    1,
    Math.floor((availableWidth + gap) / (minTileWidth + gap)),
  )

  return Math.max(1, Math.min(count, cap, fitByWidth))
}

/**
 * Resolves the insets the strip is laid out inside, filling anything the host
 * left unspecified with the responsive defaults.
 *
 * @param viewportWidth - The width the strip is laid out inside.
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
    // else gets a strip that sits in the middle of its box rather than one
    // pushed up against the top edge with a band of dead space below it.
    bottom: insets?.bottom ?? 32,
    horizontal:
      insets?.horizontal ?? (narrow ? 20 : Math.max(48, viewportWidth * 0.07)),
  }
}

/**
 * Clamps a strip scroll offset to the range the content can actually travel.
 *
 * @param scroll - The requested offset, in pixels.
 * @param contentWidth - The strip's width including insets.
 * @param viewportWidth - The visible width.
 * @returns A scroll offset of at least 0 and at most the leftover width.
 */
export function clampOverviewScroll(
  scroll: number,
  contentWidth: number,
  viewportWidth: number,
): number {
  return Math.min(Math.max(0, scroll), Math.max(0, contentWidth - viewportWidth))
}

/**
 * The scroll offset that centres one tile in the viewport, for the moment
 * the overview opens onto a window that may sit past the first page.
 *
 * @param centreX - The tile's centre in strip coordinates.
 * @param contentWidth - The strip's width including insets.
 * @param viewportWidth - The visible width.
 * @returns The clamped scroll offset that puts the tile in the middle.
 */
export function overviewScrollToCentre(
  centreX: number,
  contentWidth: number,
  viewportWidth: number,
): number {
  return clampOverviewScroll(centreX - viewportWidth / 2, contentWidth, viewportWidth)
}

/**
 * The scroll offset that brings one tile fully on screen, leaving the
 * current offset alone when the tile is already visible.
 *
 * @param centreX - The tile's centre in strip coordinates.
 * @param tileWidth - The cell width used for the strip.
 * @param contentWidth - The strip's width including insets.
 * @param viewportWidth - The visible width.
 * @param currentScroll - The offset already applied.
 * @param padding - Extra space kept between the tile and the viewport edge.
 * @returns The clamped scroll offset that reveals the tile.
 */
export function overviewScrollToReveal(
  centreX: number,
  tileWidth: number,
  contentWidth: number,
  viewportWidth: number,
  currentScroll: number,
  padding = 16,
): number {
  const left = centreX - tileWidth / 2 - padding
  const right = centreX + tileWidth / 2 + padding
  const viewRight = currentScroll + viewportWidth

  if (left >= currentScroll && right <= viewRight) return currentScroll
  if (left < currentScroll) {
    return clampOverviewScroll(left, contentWidth, viewportWidth)
  }

  return clampOverviewScroll(right - viewportWidth, contentWidth, viewportWidth)
}

/**
 * Whether a tile sits in or next to the visible page, so its preview is
 * worth mounting.
 *
 * @param centreX - The tile's centre in strip coordinates.
 * @param tileWidth - The cell width used for the strip.
 * @param scroll - The offset already applied.
 * @param viewportWidth - The visible width.
 * @param buffer - Extra width on each side treated as still near. Defaults
 * to one cell, so a tile about to scroll on is already painted.
 * @returns Whether the tile should show its preview.
 */
export function overviewPreviewInView(
  centreX: number,
  tileWidth: number,
  scroll: number,
  viewportWidth: number,
  buffer = tileWidth,
): boolean {
  const left = centreX - tileWidth / 2
  const right = centreX + tileWidth / 2

  return right >= scroll - buffer && left <= scroll + viewportWidth + buffer
}

/**
 * Places every pane on a single-row overview strip.
 *
 * Each pane is translated so its centre lands on its tile's centre and scaled
 * by one factor shared across the deck, so tiles read as the same surface
 * shrunk rather than as separately fitted boxes. The transform is relative to
 * where the pane currently sits, which is what a CSS transform applies to,
 * and is computed at scroll offset 0 — the deck subtracts the current strip
 * scroll when it paints.
 *
 * The viewport shows at most `maxVisible` tiles. Any further pane extends
 * the strip to the right rather than shrinking the page, which is how a
 * deck of twenty windows stays readable.
 *
 * @param rects - Each pane's current rectangle, in pane order.
 * @param viewport - The space the visible page is laid out inside.
 * @param options - Visible-count, gap, and inset overrides.
 * @returns The strip layout; an empty layout when there are no panes, and
 * `null` when the deck is too small to hold even one readable tile — a
 * caller that gets `null` must stay in the carousel rather than present an
 * overview nobody can read.
 */
export function computeOverviewLayout(
  rects: readonly WindowDeckRect[],
  viewport: WindowDeckViewport,
  options: WindowDeckOverviewOptions = {},
): WindowDeckOverviewLayout | null {
  if (rects.length === 0) {
    return {
      tiles: [],
      centres: [],
      contentWidth: viewport.width,
      visibleCount: 0,
      tileWidth: 0,
    }
  }

  const gap = options.gap ?? DEFAULT_GAP
  const insets = resolveInsets(viewport.width, options.insets)
  const availableWidth = viewport.width - insets.horizontal * 2
  const availableHeight = viewport.height - insets.top - insets.bottom

  if (availableWidth <= 0 || availableHeight <= 0) return null

  const visibleCount = computeOverviewVisibleCount(rects.length, viewport.width, options)
  const tileWidth = (availableWidth - gap * (visibleCount - 1)) / visibleCount

  if (tileWidth <= 0) return null

  // One factor for the whole deck: the pane that fits least generously sets
  // it, so no tile overflows its cell and none is scaled differently.
  const scale = rects.reduce((smallest, rect) => {
    if (rect.width <= 0 || rect.height <= 0) return smallest

    return Math.min(smallest, tileWidth / rect.width, availableHeight / rect.height)
  }, Number.POSITIVE_INFINITY)
  const uniformScale = Number.isFinite(scale) ? Math.min(scale, 1) : 1

  // Too small to be an overview. A page of unreadable smudges is worse than
  // staying in the carousel, so the caller is told there is no room.
  if (uniformScale < (options.minScale ?? MIN_TILE_SCALE)) return null

  const stripWidth = rects.length * tileWidth + (rects.length - 1) * gap
  const originX =
    rects.length <= visibleCount
      ? (viewport.width - stripWidth) / 2
      : insets.horizontal
  const contentWidth =
    rects.length <= visibleCount
      ? viewport.width
      : originX + stripWidth + insets.horizontal

  const centres = rects.map((_, index) => ({
    x: originX + index * (tileWidth + gap) + tileWidth / 2,
    y: insets.top + availableHeight / 2,
  }))

  const tiles = rects.map((rect, index) => ({
    x: centres[index].x - (rect.left + rect.width / 2),
    y: centres[index].y - (rect.top + rect.height / 2),
    scale: uniformScale,
  }))

  return { tiles, centres, contentWidth, visibleCount, tileWidth }
}

/**
 * Places every pane on the overview strip.
 *
 * @param rects - Each pane's current rectangle, in pane order.
 * @param viewport - The space the visible page is laid out inside.
 * @param options - Visible-count, gap, and inset overrides.
 * @returns One transform per pane, in the order the rectangles arrived; an
 * empty array when there are no panes, and `null` when the deck is too small
 * to hold a strip at all — a caller that gets `null` must stay in the
 * carousel rather than present an overview nobody can read.
 */
export function computeOverviewTiles(
  rects: readonly WindowDeckRect[],
  viewport: WindowDeckViewport,
  options: WindowDeckOverviewOptions = {},
): WindowDeckTile[] | null {
  const layout = computeOverviewLayout(rects, viewport, options)

  return layout === null ? null : layout.tiles
}
