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
