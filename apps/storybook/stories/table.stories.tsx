import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableFilterPanel,
  TableFilterSelect,
  TableFilterToggle,
  TableFooter,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSearchField,
  TableShell,
  TableSortButton,
  TableToolbar,
  TableViewOptions,
  type TableSortDirection,
} from "@nessa-ui/react"
import { ChevronRight, FilterX } from "lucide-react"

import { SearchIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Data/Table",
  component: Table,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A composable data-table kit. The core primitives mirror the familiar Table/TableHeader/TableBody/TableRow/TableHead/TableCell composition on a flat bordered shell; filtering, sorting, column visibility, and pagination are separate composable pieces — a toolbar with a search field, faceted filter selects, a disclosed advanced-filter panel, and a TableViewOptions column menu, a click-to-toggle TableSortButton for headers, and a windowed pagination bar — so hosts wire their own table state (or a headless table library) to exactly the chrome they need.",
      },
    },
  },
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

type TraceStatus = "success" | "active" | "error"
type TraceKind = "conversation" | "task" | "log"

interface Trace {
  id: string
  title: string
  kind: TraceKind
  agent: string
  toolCalls: number
  errorCount: number
  duration: string
  updated: string
  status: TraceStatus
}

const traceKindLabels: Record<TraceKind, string> = {
  conversation: "Conversation",
  task: "Task",
  log: "Log",
}

const traces: Trace[] = [
  { id: "tr_01", title: "Refactor billing webhooks", kind: "task", agent: "Fable 5", toolCalls: 24, errorCount: 0, duration: "4m 12s", updated: "2 min ago", status: "active" },
  { id: "tr_02", title: "Debug flaky deploy pipeline", kind: "task", agent: "Opus 5", toolCalls: 41, errorCount: 2, duration: "12m 08s", updated: "9 min ago", status: "error" },
  { id: "tr_03", title: "Summarize support escalations", kind: "conversation", agent: "Sonnet 5", toolCalls: 3, errorCount: 0, duration: "38s", updated: "14 min ago", status: "success" },
  { id: "tr_04", title: "Nightly registry validation", kind: "log", agent: "Haiku 4.5", toolCalls: 0, errorCount: 0, duration: "1m 51s", updated: "26 min ago", status: "success" },
  { id: "tr_05", title: "Draft launch announcement", kind: "conversation", agent: "Fable 5", toolCalls: 6, errorCount: 0, duration: "2m 44s", updated: "41 min ago", status: "success" },
  { id: "tr_06", title: "Migrate icons to inventory", kind: "task", agent: "Sonnet 5", toolCalls: 18, errorCount: 1, duration: "7m 03s", updated: "1 hr ago", status: "error" },
  { id: "tr_07", title: "Weekly dependency audit", kind: "log", agent: "Haiku 4.5", toolCalls: 0, errorCount: 0, duration: "58s", updated: "2 hr ago", status: "success" },
  { id: "tr_08", title: "Explain focus-treatment ledger", kind: "conversation", agent: "Opus 5", toolCalls: 2, errorCount: 0, duration: "1m 12s", updated: "3 hr ago", status: "success" },
  { id: "tr_09", title: "Backfill contrast matrix pairs", kind: "task", agent: "Fable 5", toolCalls: 29, errorCount: 0, duration: "9m 47s", updated: "4 hr ago", status: "active" },
  { id: "tr_10", title: "Storybook axe sweep", kind: "log", agent: "Haiku 4.5", toolCalls: 0, errorCount: 0, duration: "3m 26s", updated: "5 hr ago", status: "success" },
  { id: "tr_11", title: "Plan calendar drag gates", kind: "conversation", agent: "Fable 5", toolCalls: 5, errorCount: 0, duration: "4m 02s", updated: "6 hr ago", status: "success" },
  { id: "tr_12", title: "Repair worktree sync job", kind: "task", agent: "Opus 5", toolCalls: 33, errorCount: 4, duration: "15m 21s", updated: "8 hr ago", status: "error" },
  { id: "tr_13", title: "Publish registry snapshot", kind: "log", agent: "Haiku 4.5", toolCalls: 0, errorCount: 0, duration: "44s", updated: "11 hr ago", status: "success" },
  { id: "tr_14", title: "Review split-view PR", kind: "task", agent: "Sonnet 5", toolCalls: 12, errorCount: 0, duration: "6m 33s", updated: "13 hr ago", status: "success" },
  { id: "tr_15", title: "Triage listbox focus bug", kind: "conversation", agent: "Opus 5", toolCalls: 8, errorCount: 1, duration: "3m 18s", updated: "1 day ago", status: "error" },
  { id: "tr_16", title: "Compress hero imagery", kind: "task", agent: "Haiku 4.5", toolCalls: 9, errorCount: 0, duration: "2m 05s", updated: "1 day ago", status: "success" },
]

const statusDotClassName: Record<TraceStatus, string> = {
  success: "bg-(--nessa-diff-addition)",
  active: "bg-primary",
  error: "bg-destructive",
}

const statusLabels: Record<TraceStatus, string> = {
  success: "Success",
  active: "Active",
  error: "Error",
}

function TraceStatusBadge({ status }: { status: TraceStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 text-[11px]">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${statusDotClassName[status]}`}
      />
      {statusLabels[status]}
    </Badge>
  )
}

function traceMeta(trace: Trace) {
  const parts = [traceKindLabels[trace.kind]]
  if (trace.toolCalls > 0) parts.push(`${trace.toolCalls} tools`)
  if (trace.errorCount > 0) parts.push(`${trace.errorCount} errors`)
  return parts.join(" · ")
}

const TRACES_PAGE_SIZE = 8

function AgentTracesDemo() {
  const [search, setSearch] = React.useState("")
  // The result summary is a status region, so debounce what feeds it: an
  // undebounced live search re-announces a new count on every keystroke,
  // reading over the user's own typing.
  const [activeSearch, setActiveSearch] = React.useState("")
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [kind, setKind] = React.useState("all")
  const [agent, setAgent] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setActiveSearch(search), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  const agents = Array.from(new Set(traces.map((trace) => trace.agent)))
  const filtered = traces.filter((trace) => {
    const query = activeSearch.trim().toLowerCase()
    if (
      query &&
      ![trace.title, trace.agent, traceMeta(trace)].some((field) =>
        field.toLowerCase().includes(query),
      )
    ) {
      return false
    }
    if (kind !== "all" && trace.kind !== kind) return false
    if (agent !== "all" && trace.agent !== agent) return false
    if (status !== "all" && trace.status !== status) return false
    return true
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / TRACES_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice(
    (currentPage - 1) * TRACES_PAGE_SIZE,
    currentPage * TRACES_PAGE_SIZE,
  )
  const activeFilterCount = [kind, agent, status].filter(
    (value) => value !== "all",
  ).length
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * TRACES_PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * TRACES_PAGE_SIZE, filtered.length)

  const resetToFirstPage = () => setPage(1)

  return (
    <div className="grid w-4xl max-w-full gap-2">
      <TableToolbar>
        <TableSearchField
          aria-label="Search traces"
          placeholder="Search traces"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            resetToFirstPage()
          }}
        />
        <TableFilterToggle
          open={filtersOpen}
          activeCount={activeFilterCount}
          aria-controls="agent-traces-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        />
      </TableToolbar>
      {filtersOpen ? (
        <TableFilterPanel id="agent-traces-filters">
          <TableFilterSelect
            label="Trace type"
            value={kind}
            onValueChange={(value) => {
              setKind(value)
              resetToFirstPage()
            }}
            options={[
              { value: "all", label: "All traces", count: traces.length },
              ...(["conversation", "task", "log"] as const).map((value) => ({
                value,
                label: `${traceKindLabels[value]}s`,
                count: traces.filter((trace) => trace.kind === value).length,
              })),
            ]}
          />
          <TableFilterSelect
            label="Agent"
            value={agent}
            onValueChange={(value) => {
              setAgent(value)
              resetToFirstPage()
            }}
            options={[
              { value: "all", label: "All agents" },
              ...agents.map((name) => ({ value: name, label: name })),
            ]}
          />
          <TableFilterSelect
            label="Status"
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              resetToFirstPage()
            }}
            options={[
              { value: "all", label: "All" },
              { value: "success", label: "Success" },
              { value: "active", label: "Active" },
              { value: "error", label: "Error" },
            ]}
          />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
            aria-label="Clear filters"
            title="Clear filters"
            onClick={() => {
              setKind("all")
              setAgent("all")
              setStatus("all")
              resetToFirstPage()
            }}
          >
            <FilterX aria-hidden="true" className="size-3.5" />
          </Button>
        </TableFilterPanel>
      ) : null}
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/5">Trace</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableEmpty colSpan={6}>
                <SearchIcon aria-hidden="true" className="size-5" />
                <span className="text-xs font-semibold text-foreground">
                  No traces match your filters
                </span>
                <span className="text-[11px]">
                  Adjust the search or clear the active filters.
                </span>
              </TableEmpty>
            ) : (
              pageRows.map((trace) => (
                <TableRow
                  key={trace.id}
                  data-state={selectedId === trace.id ? "selected" : undefined}
                >
                  <TableCell className="max-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {trace.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {traceMeta(trace)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{trace.agent}</TableCell>
                  <TableCell className="font-mono tabular-nums">{trace.duration}</TableCell>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    {trace.updated}
                  </TableCell>
                  <TableCell className="text-center">
                    <TraceStatusBadge status={trace.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {/* The row itself stays a plain row: a focusable <tr>
                        with a click handler announces no role and is skipped
                        in table browse mode, so the affordance is a real
                        button in the cell the "Open" header advertises. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Open trace ${trace.title}`}
                      onClick={() => setSelectedId(trace.id)}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 text-muted-foreground"
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={currentPage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={
            filtered.length === 0
              ? "No traces match your filters"
              : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} traces`
          }
          paginationLabel="Traces pagination"
        />
      </TableShell>
    </div>
  )
}

export const AgentTraces: Story = {
  parameters: storyDocumentation(
    "The flagship composition: an agent-traces view assembled from the kit's separate pieces. The toolbar holds the live search and the Filters disclosure; the disclosed panel carries the faceted trace-type, agent, and status selects with a clear control; the shell stacks the table over a windowed pagination bar. All filter and page state lives in the host.",
  ),
  render: () => <AgentTracesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await expect(canvas.getByRole("table")).toBeVisible()
    await expect(
      canvas.getAllByRole("row").filter((row) => row.dataset.slot === "table-row"),
    ).toHaveLength(TRACES_PAGE_SIZE + 1)

    const search = canvas.getByRole("searchbox", { name: "Search traces" })
    await userEvent.type(search, "deploy")
    await waitFor(() =>
      expect(canvas.getByText("Debug flaky deploy pipeline")).toBeVisible(),
    )
    await waitFor(() =>
      expect(canvas.getByText("Showing 1–1 of 1 traces")).toBeVisible(),
    )
    await userEvent.clear(search)
    await waitFor(() =>
      expect(
        canvas.getByText(`Showing 1–${TRACES_PAGE_SIZE} of ${traces.length} traces`),
      ).toBeVisible(),
    )

    const toggle = canvas.getByRole("button", { name: /Filters/ })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "true")

    const statusSelect = canvas.getByRole("button", { name: /^Status/ })
    await userEvent.click(statusSelect)
    const errorOption = await body.findByRole("menuitemradio", { name: "Error" })
    await userEvent.click(errorOption)
    await waitFor(() =>
      expect(canvas.getByText("Showing 1–4 of 4 traces")).toBeVisible(),
    )
    await expect(statusSelect).toHaveTextContent("Error")

    await userEvent.click(canvas.getByRole("button", { name: "Clear filters" }))
    await waitFor(() =>
      expect(canvas.getByText(`Showing 1–${TRACES_PAGE_SIZE} of ${traces.length} traces`)).toBeVisible(),
    )
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
  },
}

export const Invoices: Story = {
  parameters: storyDocumentation(
    "The core primitives alone: header, body, and footer row groups on the flat shell, with a caption under the rows. The composition matches the familiar Table/TableHeader/TableBody layering, so a host can adopt the primitives without the toolbar or pagination pieces.",
  ),
  render: () => (
    <TableShell className="w-2xl max-w-full">
      <Table>
        <TableCaption>A summary of this month's invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { id: "INV-0087", status: "Paid", method: "Credit card", amount: "$250.00" },
            { id: "INV-0088", status: "Pending", method: "Bank transfer", amount: "$150.00" },
            { id: "INV-0089", status: "Paid", method: "Credit card", amount: "$350.00" },
            { id: "INV-0090", status: "Overdue", method: "PayPal", amount: "$450.00" },
          ].map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-mono tabular-nums">{invoice.id}</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell className="text-muted-foreground">{invoice.method}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {invoice.amount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right font-mono tabular-nums">$1,200.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole("table")
    await expect(table).toBeVisible()
    await expect(canvas.getAllByRole("columnheader")).toHaveLength(4)

    const shell = canvasElement.querySelector<HTMLElement>('[data-slot="table-shell"]')
    await expect(shell).not.toBeNull()
    const shellStyle = getComputedStyle(shell as HTMLElement)
    await expect(shellStyle.borderTopWidth).toBe("1px")
    await expect(shellStyle.borderTopStyle).toBe("solid")
    const container = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    )
    await expect(getComputedStyle(container as HTMLElement).overflowX).toBe("auto")

    // This table fits, so the container must not take a tab stop or a role.
    await expect(container).toHaveAttribute("tabindex", "-1")
    await expect(container).not.toHaveAttribute("role")
  },
}

const sortableRows = [
  { title: "Nightly registry validation", agent: "Haiku 4.5", seconds: 111 },
  { title: "Debug flaky deploy pipeline", agent: "Opus 5", seconds: 728 },
  { title: "Summarize support escalations", agent: "Sonnet 5", seconds: 38 },
  { title: "Refactor billing webhooks", agent: "Fable 5", seconds: 252 },
  { title: "Weekly dependency audit", agent: "Haiku 4.5", seconds: 58 },
]

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`
}

function SortableDemo() {
  const [direction, setDirection] = React.useState<"ascending" | "descending">()
  const rows = direction
    ? [...sortableRows].sort((a, b) =>
        direction === "ascending" ? a.seconds - b.seconds : b.seconds - a.seconds,
      )
    : sortableRows
  return (
    <TableShell className="w-xl max-w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trace</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead aria-sort={direction}>
              <TableSortButton
                direction={direction}
                onClick={() =>
                  setDirection((current) =>
                    current === "ascending" ? "descending" : "ascending",
                  )
                }
              >
                Duration
              </TableSortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.title}>
              <TableCell className="font-semibold text-foreground">{row.title}</TableCell>
              <TableCell className="text-muted-foreground">{row.agent}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatSeconds(row.seconds)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  )
}

export const SortableColumns: Story = {
  parameters: storyDocumentation(
    "A sortable column: the header cell carries `aria-sort` and renders a TableSortButton, which shows the active direction (or a neutral glyph while unsorted). The host owns the sort state and reorders its rows.",
  ),
  render: () => <SortableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sortButton = canvas.getByRole("button", { name: "Duration" })
    const durationHeader = canvas.getByRole("columnheader", { name: "Duration" })
    await expect(durationHeader).not.toHaveAttribute("aria-sort")

    await userEvent.click(sortButton)
    await expect(durationHeader).toHaveAttribute("aria-sort", "ascending")
    let firstDataRow = canvas
      .getAllByRole("row")
      .filter((row) => row.dataset.slot === "table-row")[1]
    await expect(firstDataRow).toHaveTextContent("Summarize support escalations")

    await userEvent.click(sortButton)
    await expect(durationHeader).toHaveAttribute("aria-sort", "descending")
    firstDataRow = canvas
      .getAllByRole("row")
      .filter((row) => row.dataset.slot === "table-row")[1]
    await expect(firstDataRow).toHaveTextContent("Debug flaky deploy pipeline")
  },
}

const PAGINATION_TOTAL = 137
const PAGINATION_PAGE_SIZE = 12

function PaginationDemo() {
  const [page, setPage] = React.useState(1)
  const pageCount = Math.ceil(PAGINATION_TOTAL / PAGINATION_PAGE_SIZE)
  const rows = Array.from({ length: PAGINATION_TOTAL }, (_, index) => ({
    id: `run_${String(index + 1).padStart(3, "0")}`,
    title: `Validation run ${index + 1}`,
  })).slice((page - 1) * PAGINATION_PAGE_SIZE, page * PAGINATION_PAGE_SIZE)
  const rangeStart = (page - 1) * PAGINATION_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGINATION_PAGE_SIZE, PAGINATION_TOTAL)
  return (
    <TableShell className="w-xl max-w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Title</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono tabular-nums text-muted-foreground">
                {row.id}
              </TableCell>
              <TableCell>{row.title}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`Showing ${rangeStart}–${rangeEnd} of ${PAGINATION_TOTAL} runs`}
      />
    </TableShell>
  )
}

export const Pagination: Story = {
  parameters: storyDocumentation(
    "The pagination bar under a long result set: previous/next chevrons around a windowed set of numbered pages — the first page, the last page, and the current page's neighbors, with collapsed runs shown as ellipses — plus a muted result summary on the left.",
  ),
  render: () => <PaginationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pagination = canvas.getByRole("navigation", { name: "Pagination" })
    const scoped = within(pagination)
    await expect(
      scoped.getByRole("button", { name: "Go to previous page" }),
    ).toHaveAttribute("aria-disabled", "true")
    await expect(scoped.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(scoped.getByRole("button", { name: "Page 12" })).toBeVisible()

    await userEvent.click(scoped.getByRole("button", { name: "Go to next page" }))
    await expect(scoped.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(canvas.getByText("Showing 13–24 of 137 runs")).toBeVisible()

    await userEvent.click(scoped.getByRole("button", { name: "Page 12" }))
    await expect(
      scoped.getByRole("button", { name: "Go to next page" }),
    ).toHaveAttribute("aria-disabled", "true")
    await expect(canvas.getByText("Showing 133–137 of 137 runs")).toBeVisible()
    await expect(scoped.queryByRole("button", { name: "Page 6" })).toBeNull()

    await userEvent.click(scoped.getByRole("button", { name: "Go to previous page" }))
    await expect(scoped.getByRole("button", { name: "Page 11" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  },
}

export const EmptyState: Story = {
  parameters: storyDocumentation(
    "The TableEmpty row spans every column with a centered icon, title, and hint — the resting state a filtered-out or unpopulated table shows inside the shell.",
  ),
  render: () => (
    <TableShell className="w-xl max-w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trace</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={3}>
            <SearchIcon aria-hidden="true" className="size-5" />
            <span className="text-xs font-semibold text-foreground">
              No traces match your filters
            </span>
            <span className="text-[11px]">
              Adjust the search or clear the active filters.
            </span>
          </TableEmpty>
        </TableBody>
      </Table>
    </TableShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No traces match your filters")).toBeVisible()
    const emptyCell = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-empty"] > td',
    )
    await expect(emptyCell).not.toBeNull()
    await expect(
      Number.parseFloat(getComputedStyle(emptyCell as HTMLElement).height),
    ).toBeGreaterThanOrEqual(180)
  },
}

const selectableColumns = [
  { id: "trace", label: "Trace", locked: true },
  { id: "agent", label: "Agent" },
  { id: "duration", label: "Duration" },
  { id: "updated", label: "Last updated" },
] as const

const selectableRows = traces.slice(0, 6)

function durationSeconds(label: string) {
  const match = /(?:(\d+)m\s*)?(\d+)s/.exec(label)
  if (!match) return 0
  return Number(match[1] ?? 0) * 60 + Number(match[2])
}

function SelectableTracesDemo() {
  const [search, setSearch] = React.useState("")
  // The count below is a status region, so the search settles before it
  // filters — announcing a new total on every keystroke reads over the user.
  const [activeSearch, setActiveSearch] = React.useState("")
  const [selected, setSelected] = React.useState<string[]>([])
  const [visible, setVisible] = React.useState<string[]>(
    selectableColumns.map((column) => column.id),
  )
  const [sort, setSort] = React.useState<{
    column: string
    direction: TableSortDirection
  }>()

  React.useEffect(() => {
    const timer = window.setTimeout(() => setActiveSearch(search), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  const matching = selectableRows.filter((trace) =>
    trace.title.toLowerCase().includes(activeSearch.trim().toLowerCase()),
  )
  const rows = sort
    ? [...matching].sort((a, b) => {
        const factor = sort.direction === "ascending" ? 1 : -1
        if (sort.column === "duration") {
          return (durationSeconds(a.duration) - durationSeconds(b.duration)) * factor
        }
        if (sort.column === "agent") return a.agent.localeCompare(b.agent) * factor
        return a.title.localeCompare(b.title) * factor
      })
    : matching

  // Measured against the rows actually on screen: comparing lengths alone
  // reports "all selected" whenever a filter happens to leave the same
  // number of rows as there are selections — including zero of each.
  const selectedHere = rows.filter((row) => selected.includes(row.id))
  const allSelected = rows.length > 0 && selectedHere.length === rows.length
  const someSelected = selectedHere.length > 0 && !allSelected

  const toggleSort = (column: string) =>
    setSort((current) =>
      current?.column === column && current.direction === "ascending"
        ? { column, direction: "descending" }
        : { column, direction: "ascending" },
    )

  const renderCell = (id: string, trace: Trace) => {
    if (id === "trace") {
      return (
        <TableCell key={id} className="max-w-0">
          <span className="block truncate font-semibold text-foreground">
            {trace.title}
          </span>
        </TableCell>
      )
    }
    if (id === "agent") {
      return (
        <TableCell key={id} className="text-muted-foreground">
          {trace.agent}
        </TableCell>
      )
    }
    if (id === "duration") {
      return (
        <TableCell key={id} className="font-mono tabular-nums">
          {trace.duration}
        </TableCell>
      )
    }
    return (
      <TableCell key={id} className="font-mono tabular-nums text-muted-foreground">
        {trace.updated}
      </TableCell>
    )
  }

  return (
    <div className="grid w-3xl max-w-full gap-2">
      <TableToolbar>
        <TableSearchField
          aria-label="Search traces"
          placeholder="Search traces"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TableViewOptions
          columns={selectableColumns}
          value={visible}
          onValueChange={setVisible}
          className="ml-auto"
        />
      </TableToolbar>
      <p role="status" className="text-[11px] text-muted-foreground">
        {selectedHere.length > 0
          ? `${selectedHere.length} of ${rows.length} selected`
          : `${rows.length} ${rows.length === 1 ? "trace" : "traces"}`}
      </p>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all traces"
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={rows.length === 0}
                  onChange={(event) =>
                    setSelected((current) => {
                      const visibleIds = rows.map((row) => row.id)
                      const untouched = current.filter(
                        (id) => !visibleIds.includes(id),
                      )
                      return event.target.checked
                        ? [...untouched, ...visibleIds]
                        : untouched
                    })
                  }
                />
              </TableHead>
              {/* Rendered from `visible`, so the order TableViewOptions
                  reports is the order the table actually shows. */}
              {visible.map((id) => {
                const column = selectableColumns.find((entry) => entry.id === id)
                if (!column) return null
                return (
                  <TableHead
                    key={id}
                    className={id === "trace" ? "w-2/5" : undefined}
                    aria-sort={sort?.column === id ? sort.direction : undefined}
                  >
                    {id === "updated" ? (
                      column.label
                    ) : (
                      <TableSortButton
                        direction={sort?.column === id ? sort.direction : undefined}
                        onClick={() => toggleSort(id)}
                      >
                        {column.label}
                      </TableSortButton>
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={visible.length + 1}>
                <SearchIcon aria-hidden="true" className="size-5" />
                <span className="text-xs font-semibold text-foreground">
                  No traces match your search
                </span>
              </TableEmpty>
            ) : null}
            {rows.map((trace) => {
              const rowSelected = selected.includes(trace.id)
              return (
                <TableRow key={trace.id} data-state={rowSelected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${trace.title}`}
                      checked={rowSelected}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, trace.id]
                            : current.filter((id) => id !== trace.id),
                        )
                      }
                    />
                  </TableCell>
                  {visible.map((id) => renderCell(id, trace))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  )
}

export const SelectionAndColumns: Story = {
  parameters: storyDocumentation(
    "Row selection and column management composed from the primitives: a Checkbox in the header cell drives select-all and one per row drives its own state, each sortable column header is a TableSortButton that toggles ascending and descending on click, and the toolbar pairs a search with TableViewOptions for column visibility. Selection is measured against the rows currently shown, so filtering leaves the header checkbox honest, and the count below the toolbar is a debounced status region. The table renders from the visible-column list, so a restored column returns to its place in column order rather than the end. The Trace column is locked visible.",
  ),
  render: () => <SelectableTracesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    const selectAll = canvas.getByRole("checkbox", {
      name: "Select all traces",
    }) as HTMLInputElement
    await expect(selectAll).not.toBeChecked()

    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Refactor billing webhooks" }),
    )
    await expect(selectAll.indeterminate).toBe(true)
    await expect(canvas.getByText("1 of 6 selected")).toBeVisible()

    await userEvent.click(selectAll)
    await waitFor(() => expect(selectAll).toBeChecked())
    await expect(canvas.getByText("6 of 6 selected")).toBeVisible()
    await userEvent.click(selectAll)
    await waitFor(() => expect(selectAll).not.toBeChecked())

    // Select-all is measured against the visible rows: with one row shown
    // and one unrelated row selected, the header must not claim everything
    // is selected.
    const search = canvas.getByRole("searchbox", { name: "Search traces" })
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Refactor billing webhooks" }),
    )
    await userEvent.type(search, "Debug")
    // Wait for the filtered-out row to go, not for the matching one — the
    // match is already on screen, so it would pass before the debounce runs.
    await waitFor(() =>
      expect(canvas.queryByText("Refactor billing webhooks")).toBeNull(),
    )
    await expect(canvas.getByText("Debug flaky deploy pipeline")).toBeVisible()
    await expect(selectAll).not.toBeChecked()
    await waitFor(() => expect(selectAll.indeterminate).toBe(false))
    await expect(canvas.getByText("1 trace")).toBeVisible()

    await userEvent.clear(search)
    await waitFor(() =>
      expect(canvas.getByText("1 of 6 selected")).toBeVisible(),
    )
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Refactor billing webhooks" }),
    )

    // Sorting is a plain toggle: click once for ascending, again for descending.
    const agentHeader = canvas.getByRole("button", { name: "Agent" })
    await userEvent.click(agentHeader)
    await waitFor(() =>
      expect(canvas.getByRole("columnheader", { name: /Agent/ })).toHaveAttribute(
        "aria-sort",
        "ascending",
      ),
    )
    await userEvent.click(agentHeader)
    await waitFor(() =>
      expect(canvas.getByRole("columnheader", { name: /Agent/ })).toHaveAttribute(
        "aria-sort",
        "descending",
      ),
    )

    // Column visibility lives in the toolbar menu, so the header stays a
    // single-purpose sort toggle.
    const columnsTrigger = canvas.getByRole("button", { name: "Columns" })
    await userEvent.click(columnsTrigger)
    await userEvent.click(
      await body.findByRole("menuitemcheckbox", { name: "Duration" }),
    )
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Duration" })).toBeNull(),
    )

    // Restoring it slots it back between Agent and Last updated; appending
    // it to the visible list would leave it last.
    await userEvent.click(
      await body.findByRole("menuitemcheckbox", { name: "Duration" }),
    )
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Duration" })).toBeVisible(),
    )
    await expect(
      canvas.getAllByRole("columnheader").map((header) => header.textContent?.trim()),
    ).toEqual(["", "Trace", "Agent", "Duration", "Last updated"])
  },
}

const wideColumns = [
  "Trace",
  "Agent",
  "Duration",
  "Last updated",
  "Project",
  "Branch",
  "Model",
  "Tokens",
  "Cost",
] as const

export const OverflowingColumns: Story = {
  parameters: storyDocumentation(
    "A table wider than its container. The scroll container only becomes keyboard focusable while the content actually overflows — measured, not assumed — so its off-screen columns stay reachable without a pointer, and it takes the `containerLabel` name so the focusable region is announced. A table that fits adds no tab stop at all.",
  ),
  render: () => (
    <div className="w-md max-w-full">
      <TableShell>
        <Table containerLabel="Trace details">
          <TableHeader>
            <TableRow>
              {wideColumns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.slice(0, 4).map((trace) => (
              <TableRow key={trace.id}>
                <TableCell className="font-semibold text-foreground">
                  {trace.title}
                </TableCell>
                <TableCell className="text-muted-foreground">{trace.agent}</TableCell>
                <TableCell className="font-mono tabular-nums">{trace.duration}</TableCell>
                <TableCell className="font-mono tabular-nums text-muted-foreground">
                  {trace.updated}
                </TableCell>
                <TableCell className="text-muted-foreground">nessa-ui</TableCell>
                <TableCell className="font-mono">main</TableCell>
                <TableCell className="text-muted-foreground">{trace.agent}</TableCell>
                <TableCell className="font-mono tabular-nums">12,480</TableCell>
                <TableCell className="font-mono tabular-nums">$0.42</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const container = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    )
    await expect(container).not.toBeNull()
    const region = container as HTMLElement

    await expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
    await waitFor(() => expect(region).toHaveAttribute("tabindex", "0"))
    await expect(region).toHaveAttribute("role", "region")
    await expect(
      canvas.getByRole("region", { name: "Trace details" }),
    ).toBeInTheDocument()
  },
}

export const CappedHeight: Story = {
  parameters: storyDocumentation(
    "A scrolling body: `containerClassName` caps the scroll container's height, since the table element is not the scroll port, and `TableHeader`'s `sticky` pins the column headers while the rows scroll beneath them. Overflow is measured on both axes, so a table whose columns all fit but whose rows do not still becomes keyboard focusable and reachable.",
  ),
  render: () => (
    <TableShell className="w-lg max-w-full">
      <Table
        containerClassName="max-h-44 scroll-pt-9"
        containerLabel="Trace history"
      >
        <TableHeader sticky>
          <TableRow>
            <TableHead>Trace</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traces.map((trace) => (
            <TableRow key={trace.id}>
              <TableCell className="font-semibold text-foreground">
                {trace.title}
              </TableCell>
              <TableCell className="text-muted-foreground">{trace.agent}</TableCell>
              <TableCell className="font-mono tabular-nums">{trace.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const region = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    ) as HTMLElement
    await expect(region).not.toBeNull()

    // Columns fit; only the rows overflow.
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1)
    await expect(region.scrollHeight).toBeGreaterThan(region.clientHeight)
    // The rows must scroll, not clip: `overflow-y` is left to compute to
    // `auto` beside `overflow-x-auto`, and a clipped region would still
    // satisfy the scrollHeight check above.
    await expect(getComputedStyle(region).overflowY).toBe("auto")
    region.scrollTop = 999
    await expect(region.scrollTop).toBeGreaterThan(0)
    await waitFor(() => expect(region).toHaveAttribute("tabindex", "0"))
    await expect(
      canvas.getByRole("region", { name: "Trace history" }),
    ).toBeInTheDocument()

    // The header stays put while the body scrolls: sticky, opaque, and
    // carrying its own bottom rule, since a collapsed border would scroll
    // away with the rows.
    const headerCell = canvas.getAllByRole("columnheader")[0]
    const headerStyle = getComputedStyle(headerCell)
    await expect(headerStyle.position).toBe("sticky")
    await expect(headerStyle.top).toBe("0px")
    await expect(headerStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    await expect(headerStyle.boxShadow).not.toBe("none")

    // Both samples must straddle the scroll, or a non-sticky header would
    // satisfy this too.
    region.scrollTop = 0
    await waitFor(() => expect(region.scrollTop).toBe(0))
    const headerTopAtRest = headerCell.getBoundingClientRect().top
    const rowTopAtRest = canvas
      .getByText("Refactor billing webhooks")
      .getBoundingClientRect().top

    region.scrollTop = 999
    await waitFor(() =>
      expect(
        canvas.getByText("Refactor billing webhooks").getBoundingClientRect().top,
      ).toBeLessThan(rowTopAtRest),
    )
    // Rows moved; the header did not.
    await expect(headerCell.getBoundingClientRect().top).toBe(headerTopAtRest)

    // The focus ring must survive the pinned header. A sticky cell is an
    // opaque positioned descendant, so a ring drawn by the container (or any
    // ancestor) is painted over; the kit draws it from a later sibling above
    // the cells, on the same box.
    const ring = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-focus-ring"]',
    ) as HTMLElement
    await expect(ring).not.toBeNull()
    const ringStyle = getComputedStyle(ring)
    // Above the pinned cells, and stretched over the same box, so the ring
    // it draws lands exactly where the container's own outline would.
    await expect(Number(ringStyle.zIndex)).toBeGreaterThan(
      Number(getComputedStyle(headerCell).zIndex),
    )
    await expect(ringStyle.position).toBe("absolute")
    await expect([ringStyle.top, ringStyle.right, ringStyle.bottom, ringStyle.left]).toEqual([
      "0px",
      "0px",
      "0px",
      "0px",
    ])
    await expect(ringStyle.outlineWidth).toBe("2px")
    await expect(ringStyle.outlineOffset).toBe("-2px")
  },
}

export const PageOutOfRange: Story = {
  parameters: storyDocumentation(
    "A guard for the window between a filter shrinking the result set and the host resetting its page. `page` is clamped into range for every control, so an out-of-range page still marks a real page current and Next cannot step further out.",
  ),
  render: () => (
    <TableShell className="w-md max-w-full">
      <TablePagination page={99} pageCount={3} summary="Showing 9–12 of 12 traces" />
    </TableShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scoped = within(canvas.getByRole("navigation", { name: "Pagination" }))

    // Clamped to the last real page rather than leaving nothing current.
    await expect(scoped.getByRole("button", { name: "Page 3" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(
      scoped.getByRole("button", { name: "Go to next page" }),
    ).toHaveAttribute("aria-disabled", "true")
    await expect(
      scoped.getByRole("button", { name: "Go to previous page" }),
    ).not.toHaveAttribute("aria-disabled")
    await expect(scoped.queryByRole("button", { name: "Page 99" })).toBeNull()
  },
}
