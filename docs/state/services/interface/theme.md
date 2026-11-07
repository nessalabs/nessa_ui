---
id: "ui-theme"
title: "Theme and appearance"
kind: "contract"
status: "implemented"
summary: "Wrap a React subtree in NessaProvider when it needs a shared theme, scale and color mode. The provider owns one element; it does not restyle `documentElement` or `body`, save a preference, or choose your server's cookie policy."
parent: "ui-interface"
sources:
  [
    "packages/react/src/provider/nessa-provider.tsx",
    "packages/react/src/provider/nessa-color-mode.ts",
    "packages/react/src/provider/nessa-scope.tsx",
    "packages/react/src/theme/nessa-theme-scope.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Own theme and appearance

Wrap a React subtree in NessaProvider when it needs a shared theme, scale and color mode. The provider owns one element; it does not restyle `documentElement` or `body`, save a preference, or choose your server's cookie policy.

The requested mode can be light, dark or system. The DOM receives only the resolved light/dark appearance. Uncontrolled mode starts from `defaultMode` and holds changes locally. Controlled mode calls `onModeChange`, and the host must supply the new `mode`. Pick one ownership style for the provider's lifetime.

For a server-rendered dark page that follows the OS, use a matching initial resolution. `defaultResolvedMode` is an initial seed, not a future override. Re-entering unsupplied system mode carries the last committed appearance until the effect samples `matchMedia`; it does not flash back to the original seed. Supplying controlled `resolvedMode` means the host owns resolution and no OS listener is installed. Otherwise the provider samples and subscribes while following system, invalidating the listener on cleanup so a queued old event cannot publish later.

NessaThemeScope changes theme or scale within a subtree and republishes the current resolved appearance. The finite scale presets coordinate geometry and type. `asChild` uses one host element instead of an extra wrapper; the scope still owns `color-scheme`. Theme attributes follow floating layers separately from their destination. [Layers](layers.md) explains why those responsibilities are independent.

`useNessaColorMode` requires a provider and throws outside one; the optional hook can report no provider. The host owns persistence across reloads and must not interpret local React state as a durable setting.
