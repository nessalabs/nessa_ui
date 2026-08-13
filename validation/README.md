# Nessa contract validation

The inner-loop gate is intentionally small and read-only:

```bash
pnpm validate
```

It indexes the repository once, caches reads/parses for one invocation, and
runs independent checks with bounded concurrency. The cold-start target for the
current repository is under two seconds. Use `pnpm validate -- --profile` to
inspect local timing.

Before review or release, run the complete source-preserving gate:

```bash
pnpm validate:full
```

The full gate adds validator tests, TypeScript/workspace tests, a fresh package
build, artifact checks, registry reproduction, tarball inspection, and the
static Storybook build. It snapshots tracked and nonignored untracked files and
fails if any of them change.

Useful focused commands:

```bash
pnpm validate -- --list
pnpm validate -- --explain CSS-002
pnpm validate -- --contract CSS-002
pnpm validate -- --changed-since origin/main
pnpm validate -- --format json
```

`validation/framework/` is a domain-neutral TypeScript kernel. Nessa policy,
contract IDs, paths, tokens, and exceptions live outside it. Checks declare
their inputs and receive cached read/parser services; they never walk the
repository or spawn processes independently.
