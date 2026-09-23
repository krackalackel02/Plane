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
