# Contributing to Nessa UI

Thank you for helping build Nessa UI. This repository uses pull requests,
protected `main`, and pnpm workspaces to keep component, package, registry, and
Storybook changes reviewable and reproducible.

## Toolchain

- Node.js 22.13.0 or newer
- pnpm 11.9.0
- one committed lockfile: `pnpm-lock.yaml`

Install the workspace from the repository root:

```bash
pnpm install --frozen-lockfile
```

Start the component workshop with `./start.sh`. The script checks the pinned
toolchain, reconciles workspace dependencies against the frozen lockfile, and
then delegates to the Storybook workspace. Set `NESSA_STORYBOOK_HOST` or
`NESSA_STORYBOOK_PORT` when the default `127.0.0.1:6006` is unsuitable.

Do not add `package-lock.json`, `yarn.lock`, or Bun lockfiles. Nessa's published
package and shadcn registry remain usable by npm, Yarn, Bun, and pnpm consumers;
pnpm is the contributor tool for this repository.

## Protected-main workflow

Changes reach `main` through pull requests. Direct pushes, force pushes, and
deletion of `main` are blocked. Pull requests must be current with `main`, pass
the required `full` validation check, and have all conversations resolved.
Nessa uses squash merges, and GitHub deletes merged same-repository branches.

Today, `CODEOWNERS` and `architecture-conformance` are advisory. The repository
has one eligible maintainer, so requiring an independent approval would
deadlock maintainer-authored changes. Requiring `architecture-conformance` and
one current independent approval is the migration target after a second
eligible maintainer is available; until then, the app-bound `full` check is the
required automated merge gate.

Maintainers use `origin` for the canonical `nessalabs/nessa_ui` repository. A
fork contributor should keep `origin` pointed at their fork and add the
canonical repository as `upstream`:

```bash
git remote add upstream https://github.com/nessalabs/nessa_ui.git
```

For a human contributor starting a change:

```bash
git switch main
git pull --ff-only <canonical-remote> main
git switch -c <short-feature-branch>
pnpm install --frozen-lockfile
```

Use `origin` as `<canonical-remote>` in the maintainer checkout and `upstream`
in a fork checkout.

Keep a branch focused on one cohesive outcome. Before requesting review, run
the checks proportionate to the change:

```bash
pnpm validate
pnpm typecheck
```

Run `pnpm validate:full` for changes that affect components, Storybook,
packaging, registry output, validation infrastructure, or other distribution
contracts. Open a draft pull request while work or review is still in progress.
Mark it ready only after the relevant checks and review loop pass.

If `main` advances, use GitHub's **Update branch** action or update locally. A
sole owner of a feature branch may fetch immediately before rebasing and push
with `--force-with-lease`. Do not rewrite a branch shared with another
contributor; merge the canonical remote's `main` into that branch instead.

```bash
git fetch <canonical-remote>
git rebase <canonical-remote>/main
git fetch origin <short-feature-branch>
git push --force-with-lease origin <short-feature-branch>
```

After a pull request is merged:

```bash
merged_pr_head=$(gh pr view <pull-request-number> --json state,headRefOid --jq 'select(.state == "MERGED") | .headRefOid')
if [ -n "$merged_pr_head" ] && \
  local_branch_head=$(git rev-parse <merged-feature-branch>) && \
  [ "$local_branch_head" = "$merged_pr_head" ]; then
  git fetch <canonical-remote> --prune && \
    git switch main && \
    git pull --ff-only <canonical-remote> main && \
    git branch -D <merged-feature-branch> && \
    git worktree prune
else
  echo "Branch is not a verified merged PR head; preserving it." >&2
  false
fi
```

Only use `git branch -D` when GitHub confirms the pull request was merged and
the local branch tip exactly matches the merged PR head. If either `test` fails,
stop and preserve the branch: it may contain unmerged local work. Squash merges
do not retain the feature branch's commit ancestry, so ordinary `git branch -d`
may reject an otherwise verified cleanup. Never reuse a merged branch for
unrelated work.

## Agent authorization boundary

Agents must work in the user's current checkout and current branch by default.
A request to implement, fix, review, test, commit, or push is **not** implicit
permission to create a branch or worktree.

An agent may create a branch only when the user explicitly asks for a branch or
pull request. An agent may create a worktree only when the user explicitly asks
for a worktree or isolated parallel worktrees. When authorization is unclear,
the agent must continue safely in the current checkout or ask before creating
either.

Agents must not create speculative worktrees for reviewers, tests, or parallel
features. Independent reviewers should use the shared checkout read-only unless
the user has authorized worktrees. Disposable temporary directories used by a
test are not Git worktrees and must not leave repository changes behind.

## Optional parallel worktrees

Worktrees are useful when the user or maintainer deliberately wants several
isolated features in progress. Each worktree must have its own branch and one
clear owner:

```bash
git switch main
git pull --ff-only <canonical-remote> main
git worktree add ../nessa-theme -b codex/theme-provider
git worktree add ../nessa-icons -b codex/icon-provider

cd ../nessa-theme
pnpm install --frozen-lockfile
```

Each worktree has isolated source, `node_modules`, and build outputs, while pnpm
reuses its content-addressed package store. Do not let multiple agents edit the
same worktree. Remove a worktree only after its changes are safely committed or
otherwise preserved:

```bash
git worktree remove ../nessa-theme
git worktree prune
```

## Design-system requirements

All changes must follow the
[Nessa Design System Core Contract](./docs/architecture/design-system-contract.md).
The fast and full validation gates codify the broad architectural contracts;
component-specific behavior, interaction, visual, and accessibility tests
remain part of each component's implementation.

See [validation/README.md](./validation/README.md) for the available validation
commands and [AGENTS.md](./AGENTS.md) for repository-specific agent rules.
