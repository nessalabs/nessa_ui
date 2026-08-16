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
