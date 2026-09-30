# Agent cards spike

A throwaway exploration of selectable agent/model cards, kept on the
`exp-cards` branch as the reference for a future design-system component. It
is not part of `@nessalabs/ui`, the registry, or Storybook.

- `template.html` — the card (CSS layers: gradient, planet arc, orbit line,
  halo, grain, pointer glare), the toolbar, and the tilt/selection script.
- `icons3d.js` — every agent logo as a Three.js scene, rendered by one shared
  WebGL renderer into each card's canvas, with a per-icon hover animation.
- `build.py` — writes `index.html` from the template and the agent list.

## Run it

ES modules need a server:

```bash
python3 build.py && python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765>. Three.js loads from jsDelivr.

## What to try

- **Show**: all agents, or one on its own.
- **Layout**: vertical (4:5) or horizontal (16:7).
- **Hover effect**: tilt + pop, card only, logo only, or subtle.
- Hover each card for its animation; the Claude Code mascot plays a different
  routine on each hover.
