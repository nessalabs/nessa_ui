# @nessalabs/ui

The React package for Nessa UI. This repository uses pnpm, but the published
package works with every standard JavaScript package manager:

```bash
pnpm add @nessalabs/ui @fontsource-variable/geist @fontsource-variable/geist-mono
npm install @nessalabs/ui @fontsource-variable/geist @fontsource-variable/geist-mono
yarn add @nessalabs/ui @fontsource-variable/geist @fontsource-variable/geist-mono
bun add @nessalabs/ui @fontsource-variable/geist @fontsource-variable/geist-mono
```

```tsx
import { Button } from "@nessalabs/ui"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@nessalabs/ui/styles.css"

export function SaveButton() {
  return <Button>Save changes</Button>
}
```

`styles.css` is the recommended package stylesheet. It includes Nessa theme
tokens and component utilities without resetting the host application. Import
it before your application stylesheet. Nessa utilities are emitted in a named
cascade layer so a host Tailwind application's own utilities remain
authoritative.

For a Nessa-owned application that wants Tailwind Preflight and Nessa's global
body defaults, import the opinionated application baseline instead:

```tsx
import "@nessalabs/ui/app.css"
```

Token-only consumers can import `@nessalabs/ui/theme.css`.

Override semantic tokens after the Nessa import to theme every component:

```css
:root {
  --primary: oklch(0.45 0.2 260);
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.55 0.17 260);
}

.dark {
  --primary: oklch(0.75 0.14 260);
  --primary-foreground: oklch(0.18 0.03 260);
  --ring: oklch(0.7 0.14 260);
}
```

Registry consumers own the copied variables in their application stylesheet
and can edit them directly.

### Git operations and fixed-row virtualization

`GitHistory` accepts newest-first, child-before-parent `GitCommit[]` records. It
computes all graph lanes before windowing rows, so offscreen commits do not break
parent connections. Narrow containers show author/date/hash beneath each subject;
wide containers use metadata columns. Pass `palette={["#2764a5", "var(--brand-graph)"]}`
to supply your own lane colors (cycled as needed). Omit it, or pass an empty array,
for the theme-aware default palette.

```tsx
<GitHistory
  commits={commits}
  selectedHash={selected?.hash}
  onSelect={(commit) => loadCommitDetails(commit.hash)}
/>
<GitCommitDetails
  commit={selected}
  onClose={() => setSelected(null)}
  onFileSelect={(file, commit) => openDiff(commit.hash, file.path)}
  onResourceSelect={(resource) => openLinkedWork(resource.id)}
/>
```

`GitCommitDetails` renders nothing for `commit={null}`. It reuses `FileDiffCard`,
`FileDiffList`, `FileDiffListItem`, `FileDiffPath`, and `DiffStat`. Undefined
`files` means not loaded; `[]` means no changes. Binary/unavailable line counts
are `null`. The host supplies session/plan associations and navigation callbacks;
Git itself does not provide these links. State, loading, errors, and I/O stay in
the application. Keep commit details keyed to the selected hash when asynchronous
responses arrive.

Storybook's **Git Operations** examples use a real local Git snapshot. Refresh it
explicitly with `node apps/storybook/scripts/capture-git-history.mjs /path/to/repo`.
The capture is limited to 300 commits across all refs, including stash refs. File
changes compare with the first parent (empty tree for roots), and renames appear
as delete/add. Builds do not execute Git or refresh this snapshot.

`VirtualList` is a reusable fixed-row renderer, not an automatic variable-height
wrapper:

```tsx
<VirtualList
  items={rows}
  getKey={(row) => row.id}
  rowHeight={40}
  height={400}
>
  {(row) => <YourRow row={row} />}
</VirtualList>
```

Only visible rows plus overscan mount. Keep durable state outside rows, use stable
keys, and ensure content fits `rowHeight`. The default overscan is five rows on
each side; a focused row stays mounted until focus leaves. The viewport ref
supports host-owned scroll actions. `as="ul" itemAsChild` composes native `li`
primitives that forward positioning, events, and accessibility props. Layout
updates are synchronous in scroll handlers to prevent React's deferred continuous
updates from exposing an empty viewport. `debug` publishes a bounded development
trace at `window.__nessaVirtualList`, cleaned up on unmount.

Pass `virtualize={false}` for complete DOM traversal/browser find. Existing
`FileDiffList` compositions can opt in with `virtualize`, `rowHeight`, and `height`;
its default remains nonvirtualized and preserves expansion/collapse behavior.
This does not virtualize Table or WindowDeck: those retain their existing
pagination and pane lifecycle contracts.
