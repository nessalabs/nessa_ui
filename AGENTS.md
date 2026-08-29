# Nessa UI agent instructions

These instructions apply to every agent working anywhere in this repository.
Read and follow [CONTRIBUTING.md](./CONTRIBUTING.md) before changing files or
Git state.

## Branch and worktree authorization

- Do not create or switch to a new branch unless the user explicitly asks for
  a branch or pull request.
- Do not create a Git worktree unless the user explicitly asks for a worktree
  or isolated parallel worktrees.
- A request to implement, fix, review, test, commit, push, or delegate work does
  not by itself authorize a new branch or worktree.
- Work in the current checkout and current branch by default. If completing the
  request safely requires new Git isolation that was not authorized, ask first.
- Never create speculative worktrees for subagents or independent reviewers.

## Repository workflow

- Use pnpm 11.9.0 for repository commands and keep only `pnpm-lock.yaml`.
- Do not create npm, Yarn, or Bun lockfiles.
- Do not push directly to protected `main`. If publication is requested while
  on `main`, ask for explicit branch or pull-request authorization first.
- Preserve unrelated user changes and stage only the files in the requested
  scope.
- Do not run pre-commit hooks or `./verify.sh` unless the user explicitly asks.
- For non-trivial changes, use an independent read-only review loop. Fix every
  actionable finding and repeat review until zero actionable findings remain.
- Follow the design-system contract and run validation proportionate to risk.

## Merging and CI

- A clean auto-merge is not evidence of a correct one. After any merge, diff the
  branch against its base and account for every changed file: anything the
  branch never intended to touch is a bad merge, not a merge.
- Resolve a conflict in a file this branch has no intentional change in by
  taking the base's version outright.
- A play test must leave nothing running. A story that leaves a timer or
  animation ticking past its assertions keeps taking main-thread time for the
  rest of the suite, and surfaces as an unrelated story failing on a slow
  machine.
- Assert the end state, never a proxy for it. Waiting for "no running
  animations" is satisfied by a transition that has not started yet; wait for
  the value the test actually cares about.
- When a check fails, first establish whether the base passes at the same
  commit. Fix what this branch caused; report what it inherited rather than
  quietly widening scope.
- Do not claim a fix works until the failing check has actually run and passed.
  For a load-sensitive test, one green run removes the trigger, not the cause —
  say which of the two happened.

## UI and architecture

- Build UI from Nessa UI components. Check for an existing component before
  creating one; add a missing primitive to the design system before consuming
  it in an application.
- Use semantic color, typography, spacing, and theme tokens instead of fixed
  presentation values when tokens exist.
- Diagnose the owning invariant and fix the root cause. Do not add a narrow
  special case unless that scenario is itself an explicit product contract.
- At handoff, explain the relevant before-and-after code path in detail with a
  Mermaid diagram.

## Debugging interactive components

When diagnosing or building interactive/animated components (scroll sync,
animation timing, focus behavior), read
[docs/testing/interaction-debugging.md](./docs/testing/interaction-debugging.md)
— it covers the dev-only `debug` trace pattern and the
reproduce-then-read-the-trace workflow that replaces screen recordings.
