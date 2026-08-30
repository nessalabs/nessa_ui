## What this changes for a consumer

Required. Name every surface this repository ships and say what a consumer
writes today versus after this change. "No change" is a valid answer for a
surface; silence is not.

- **`@nessa-ui/react` (npm):**
- **`@nessa-ui/agent-stream` (npm):**
- **shadcn registry (`shadcn add <item>`):**

Add a row for any surface not listed. Reach for the consumer's own words — the
import they write, the command they run — not the internal file that moved.

### Before and after

Required whenever anything a consumer can reach changes shape: a public export,
an exports map, a registry item's files or targets, an import path, or the
layout of copied source. One Mermaid diagram, before beside after.

```mermaid

```

If nothing consumer-reachable changed shape, delete the fence and write
`No consumer-reachable shape changed.` instead.

## Contract conformance

- Applicable contract IDs:
- `pnpm validate:full` result:
- Review-required evidence (or `not applicable`):
- Independent review result or link (or `not applicable`):
- Contract amendment/migration reference (or `none`):

The author records the listed evidence and resolves actionable review findings.
A GitHub approval is required only when native branch protection enables that
rule; Nessa does not publish a custom reviewer-approval status.
