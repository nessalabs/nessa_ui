# Nessa UI

Nessa UI is the open design system for Nessa products. It builds on the
shadcn/ui source model and provides two ways to adopt the same components:

- install `@nessa-ui/react` as a conventional React package;
- copy owned source into an application through the `@nessa` shadcn registry.

Storybook is the visual workshop and living component documentation.

## Workspace

```text
apps/storybook    visual workshop, stories, and accessibility tests
packages/react    components, tokens, and package entrypoints
public/r          generated shadcn registry artifacts
registry.json     public registry catalog
```

## Start Storybook

The workspace requires Node.js 20.19 or newer and pnpm 11.

```bash
pnpm install
pnpm storybook
```

Then open [http://localhost:6006](http://localhost:6006).

## Consume the package

```bash
pnpm add @nessa-ui/react @fontsource-variable/geist @fontsource-variable/geist-mono
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
| `pnpm storybook` | Start the visual workshop |
| `pnpm build` | Build the React package and compiled theme CSS |
| `pnpm build:storybook` | Produce the static Storybook site |
| `pnpm build:registry` | Generate installable shadcn registry JSON |
| `pnpm test` | Run Storybook render and accessibility checks in Chromium |
| `pnpm typecheck` | Type-check every workspace package |

## Naming

- Brand: **Nessa UI**
- npm: `@nessa-ui/react`
- shadcn registry namespace: `@nessa`
- repository: `nessalabs/nessa_ui`

## License

[MIT](./LICENSE) © 2026 nessalabs
