# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment variables

Display/debug flags are read in `src/context/envContext.tsx` via Vite's `import.meta.env`. `.env.development` and `.env.production` are gitignored (local-only), so a fresh clone or worktree won't have them — every flag below falls back to its **Default** column, which matches production, unless you set the var explicitly.

| Variable | Effect | Default |
| --- | --- | --- |
| `VITE_SHOW_SHIP` | Renders the ship model | `true` |
| `VITE_SHOW_CAMERA` | Renders the camera helper/frustum overlay | `false` |
| `VITE_SHOW_STATS` | Renders the three.js perf stats panel (FPS counter) | `false` |
| `VITE_SHOW_DEBUG` | Enables `print()` debug console logging (`src/utils/common.ts`) | `false` |
| `VITE_SHOW_SPHERES` | Renders debug axis-helper spheres | `false` |
| `VITE_MUSIC_ENABLED` | Plays the ambient background music | `true` |

To opt into any of these locally (e.g. for perf debugging), set `VITE_SHOW_STATS=true` etc. in your own `.env.development` or `.env.local` — Vite loads `.env.local`/`.env.development.local` automatically and they're gitignored too, so they won't affect anyone else.

## Component sandbox

A separate page for developing and tuning a single 3D component in isolation, without the rest of the scene (ship physics, timeline layout, audio, etc.) around it. Useful for iterating on a component's look by hand or from an agent, since it's a plain URL rather than something requiring you to fly the ship over to it in the full scene.

**Dev-only, never deployed:** `sandbox.html` is served by `vite`/`vite dev` (and `npm run sandbox`) unconditionally, but `npm run build` — what `.github/workflows/main.yaml` runs to produce the GitHub Pages artifact — leaves it out of `dist/` by default (see the `includeSandbox` flag in `vite.config.ts`), so it's never part of the deployed site or reachable by a visitor. Build a local copy anyway (e.g. to run it through `vite preview`) with `VITE_INCLUDE_SANDBOX=true npm run build`.

Run it with:

```sh
npm run sandbox      # opens /Plane/sandbox.html
# or, with an existing `npm run dev` already running:
open http://localhost:5173/Plane/sandbox.html?component=board
```

With no `?component=` param it shows a picker linking to every registered component. Once a component is picked, the page gives you:

- An orbit camera (drag to rotate, scroll to zoom in/out — `OrbitControls` with a very close `minDistance`, for inspecting detail) centered on the component.
- A grid + axes helper for scale/orientation reference (toggleable, "Scene" folder).
- A [leva](https://github.com/pmndrs/leva) panel exposing whatever parameters that component takes — e.g. the Board's `outerX/outerY/outerZ/frame/depth` dimensions with a Save-to-JSON button, or the Ship's scale/rotation/exhaust-mode.

Currently registered: `board` (`src/components/timeline/board.tsx`) and `ship` (`src/components/ship`).

**Adding a new component:** write a thin wrapper under `src/sandbox/components/` that renders the real component centered at the origin (call `useControls()` there for any props worth tuning live — see `boardSandbox.tsx` and `shipSandbox.tsx` for two different shapes of this: one reuses the component's own existing debug controls, the other adds new ones for a component with no props of its own), then add one entry to the registry in `src/sandbox/registry.tsx`. The shell (`src/sandbox/sandboxApp.tsx` + `sandboxScene.tsx`) handles the camera, lights, grid and picker for you. Only wrap the isolated component in the specific context providers it actually reads from (check with `grep -rn "use<ContextName>" src/components/<path>`) — the sandbox intentionally leaves out the heavier full-scene providers (physics, audio, loading screen, world boundary) since those drive gameplay concerns outside an isolated component's own rendering.

Built as its own Vite entry (`sandbox.html` → `src/sandbox/main.tsx`, wired up via `build.rollupOptions.input` in `vite.config.ts`) so leva and the sandbox registry never reach the main app's bundle — only `/sandbox.html` visitors pay for them.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
