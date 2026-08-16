# Nessa UI

Nessa UI is the open design system for Nessa products. It builds on the
shadcn/ui source model and provides two ways to adopt the same components:

- install `@nessa-ui/react` as a conventional React package;
- copy owned source into an application through the `@nessa` shadcn registry.

Storybook is the visual workshop and living component documentation.

## Architecture contract

All future component, theming, packaging, registry, documentation, and tooling
work is governed by the
[Nessa Design System Core Contract](./docs/architecture/design-system-contract.md).
Implementation plans sequence changes but cannot silently override that
contract; amendments require explicit architecture review.

## Workspace

```text
apps/storybook    visual workshop, stories, and accessibility tests
packages/react    components, tokens, and package entrypoints
public/r          generated shadcn registry artifacts
registry.json     public registry catalog
docs/architecture permanent design-system contracts
```

## Start Storybook

The workspace requires Node.js 22.13 or newer and pnpm 11.9.0.

```bash
./start.sh
```

Then open [http://localhost:6006](http://localhost:6006).

`start.sh` verifies the repository's Node and pnpm versions, reconciles
workspace dependencies against the frozen lockfile, and starts Storybook.
Override its address with `NESSA_STORYBOOK_HOST` or `NESSA_STORYBOOK_PORT`.

## Consume the package

The repository uses pnpm, while consumers can use their package manager of
choice:

```bash
pnpm add @nessa-ui/react @fontsource-variable/geist @fontsource-variable/geist-mono
npm install @nessa-ui/react @fontsource-variable/geist @fontsource-variable/geist-mono
yarn add @nessa-ui/react @fontsource-variable/geist @fontsource-variable/geist-mono
bun add @nessa-ui/react @fontsource-variable/geist @fontsource-variable/geist-mono
```

```tsx
import { Button } from "@nessa-ui/react"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@nessa-ui/react/styles.css"

export function Example() {
  return <Button>Continue</Button>
}
```

The default stylesheet includes Nessa tokens and component utilities without
resetting the host application. Import it before the application's stylesheet;
Nessa's named cascade layer lets host Tailwind utilities remain authoritative.
Nessa-owned applications can opt into Tailwind Preflight and global body
defaults with `@nessa-ui/react/app.css`. A token-only entry is available at
`@nessa-ui/react/theme.css`.

Package consumers customize the system by overriding semantic variables after
the Nessa import. Registry consumers own the copied variables directly:

```css
:root {
  --primary: oklch(0.45 0.2 260);
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.55 0.17 260);
}
```

## Consume the registry

Because this is a public GitHub registry, a project can install a component and
its Nessa base directly from the repository in one command:

```bash
pnpm dlx shadcn@latest add nessalabs/nessa_ui/button
```

Generate static JSON artifacts for registry hosting or inspection:

```bash
pnpm build:registry
```

## Commands

| Command | Purpose |
| --- | --- |
| `./start.sh` | Verify the toolchain and start the Storybook workshop |
| `pnpm storybook` | Start the visual workshop |
| `pnpm build` | Build the React package and compiled theme CSS |
| `pnpm build:storybook` | Produce the static Storybook site |
| `pnpm build:registry` | Generate installable shadcn registry JSON |
| `pnpm test` | Run Storybook render and accessibility checks in Chromium |
| `pnpm typecheck` | Type-check every workspace package |
| `pnpm validate` | Run the fast, read-only design-contract source gate |
| `pnpm validate:full` | Run the complete review/CI artifact and contract gate |

Validation details, focused commands, and performance guarantees live in
[`validation/README.md`](./validation/README.md).

Contributor setup, protected-main practices, and the explicitly authorized
worktree workflow live in [CONTRIBUTING.md](./CONTRIBUTING.md). Agents must also
follow [AGENTS.md](./AGENTS.md).

## Naming

- Brand: **Nessa UI**
- npm: `@nessa-ui/react`
- shadcn registry namespace: `@nessa`
- repository: `nessalabs/nessa_ui`

## License

[MIT](./LICENSE) © 2026 nessalabs
