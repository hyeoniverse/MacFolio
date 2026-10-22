[한국어](../migration-cra-to-vite.md) | **English**

# CRA → Vite migration

I moved a project built with Create React App (CRA) to Vite. Dev server startup got about 8x faster, production builds about 3x faster, and the number of installed packages dropped from 1,438 to 171.

## Why migrate

- **CRA is no longer maintained.** The React team officially deprecated CRA in February 2025. There's no expecting it to keep up with new React versions and toolchains.
- **Waiting during development was long.** CRA bundles the whole app with webpack before it starts the dev server. Vite uses the browser's native ES modules and transforms only the files that are requested, as they're requested.
- **The dependencies were heavy.** `react-scripts` alone pulls in entire webpack, Babel, Jest and ESLint setups.

## Results

| Metric                             | CRA      | Vite     | Difference        |
| ---------------------------------- | -------- | -------- | ----------------- |
| Dev server start (no cache)        | 5.05s    | 0.58s    | about 8.7x faster |
| Production build (with type check) | 6.33s    | 1.88s    | about 3.4x faster |
| Production build (bundling only)   | –        | 1.32s    |                   |
| JS bundle (gzip)                   | 138.2 KB | 127.7 KB | 7.6% smaller      |
| CSS bundle (gzip)                  | 30.2 KB  | 28.3 KB  | 6.3% smaller      |
| Installed packages                 | 1,438    | 171      | 88% fewer         |
| `node_modules` size                | 548 MB   | 276 MB   | 50% smaller       |

Times are the average of 3 runs.

### Methodology

- **What was compared**
  - CRA: commit `bca7095d` right before the switch to Vite (tag `v1-cra`, react-scripts 5.0.1 / webpack 5.97.1)
  - Vite: commit `432039cc` after the Phase 0 cleanup (Vite 6.2.1, @vitejs/plugin-react 4)
  - Both versions use React 19.0.0.
- **Environment:** Apple M4 Pro, 24 GB memory, macOS 26.7, Node.js 23.10.0, npm 11.19.1
- **Dev server start**
  - Caches (`node_modules/.cache`, `node_modules/.vite`) were cleared before each run.
  - For CRA, measured until `/static/js/bundle.js` responded with 200. At that point the whole app has been compiled.
  - For Vite, measured until `/` and `/src/App.tsx` responded with 200. Vite transforms the remaining modules when the browser requests them, so this number is shorter than the time until the first screen is fully drawn.
- **Production build**
  - CRA ran `react-scripts build` with `GENERATE_SOURCEMAP=false`, turning off source maps to match Vite's default.
  - The CRA build includes type checking, so Vite was measured as `tsc && vite build` as well.
- **Bundle size:** the sum of `.js` and `.css` files, excluding source maps. Both versions were compressed with `gzip -9` and measured.

### Caveats when interpreting

- There are code changes between the two commits besides the tooling switch (39 files in `src/`). The bundle size difference isn't purely the effect of the tooling. It's fair to read the sizes only as "about the same or slightly smaller".
- HMR update speed and Lighthouse scores need a browser, so they haven't been measured yet.

## What changed

| Area                  | CRA                                              | Vite                                                            |
| --------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| HTML entry point      | `public/index.html`, `%PUBLIC_URL%` substitution | Root `index.html`, `<script type="module" src="/src/main.tsx">` |
| Environment variables | `process.env.REACT_APP_*`                        | `import.meta.env.VITE_*`                                        |
| Types                 | `react-app-env.d.ts` (react-scripts types)       | `vite-env.d.ts` (`vite/client` + `ImportMetaEnv`)               |
| React plugin          | Built in (Babel)                                 | `@vitejs/plugin-react` in `vite.config.ts`                      |
| Build output          | `build/`                                         | `dist/` (`public` in `firebase.json` changed too)               |
| Tests                 | Jest (built in)                                  | Removed. Vitest to be added later                               |
| Other removals        | `web-vitals`, `browserslist`, `setupTests.ts`    |                                                                 |

## What I missed during the switch

Right after the switch the build worked, but a few things were silently broken. All of them were the kind that pass without errors, so they were found late.

- **Deploy path:** `firebase.json` still pointed to `build/`, so a deploy could have uploaded the old CRA build.
- **Environment variable prefix:** one file was reading `import.meta.env.REACT_APP_IMAGE_URL`. Vite only exposes variables starting with `VITE_`, so the value was `undefined` and images broke.
- **React plugin not applied:** `@vitejs/plugin-react` was installed, but there was no `vite.config.ts`. Vite transforms JSX with esbuild, so the app worked, but Fast Refresh didn't.
- **Missing dependencies:** `react-dom` and `typescript` weren't in `package.json`. They were still in the existing `node_modules`, so it didn't show up locally.

I declared `ImportMetaEnv` in `vite-env.d.ts` so autocompletion works. However, Vite's default types include an index signature (`[key: string]: any`), so using a name that doesn't exist doesn't cause a type error. Consolidating environment variable reads into a single place, `config/env.ts`, is done in Phase 2 (#4).
