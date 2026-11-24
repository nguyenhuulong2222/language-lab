# Upgrade log (branch chore/upgrades)

Rule: `main` never receives a broken build. Each package group gets one commit, and only after
typecheck, the full tests, the production build, the Pages Function bundle and the production layout
check all pass. A group that cannot pass is reverted and stays at its old version. No test is weakened,
skipped or deleted. A test expectation changes only when the migration guide documents a behaviour
change, and that is noted under the group.

The check set (`~/ll-up/check.sh`, run for every group):
- `npm run typecheck`
- `npx vitest run` (the full suite)
- `npm run build`, with the output sizes; `dist/` is deleted afterwards
- The Pages Function bundle: `npx esbuild functions/api/coach.ts --bundle --format=esm
  --platform=neutral --target=es2022 --main-fields=module,main --conditions=worker,browser`, as
  Cloudflare Pages bundles a Function
- `node tools/layout-check/run.mjs --lang=en --size=normal --prod` (the production build served
  with the headers and CSP of `public/_headers`)
- `npm run test:hooks`

## Step 0 — Baseline (2026-11-20, `main` at 95db739)

Node 26.13.0, npm 11.20.0 on the machine. CI uses Node 22.18.

| Package | Installed | Latest on npm (2026-11-20) | Newer major? |
|---|---|---|---|
| react | 19.1.0 | 19.3.1 | no |
| react-dom | 19.1.0 | 19.3.1 | no |
| typescript | 5.8.3 | 7.0.2 | yes |
| vite | 6.4.5 | 8.3.8 | yes |
| @vitejs/plugin-react | 4.5.2 | 6.3.0 | yes |
| vitest | 4.1.12 | 5.1.1 | yes |
| @fast-check/vitest | 0.5.0 | 0.5.0 | no |
| fast-check | 3.23.2 | 4.11.0 | yes |
| jsdom | 31.0.1 | 31.0.1 | no |
| @testing-library/react | 16.3.3 | 16.3.3 | no |
| @testing-library/dom | 10.4.2 | 10.4.2 | no |
| @types/react | 19.1.6 | 19.3.0 | no |
| @types/react-dom | 19.1.6 | 19.3.0 | no |
| @types/dom-speech-recognition | 0.0.12 | 0.0.12 | no |

Results:
- **Typecheck**: 0 errors.
- **Tests**: 62 files, 1373 tests, all pass.
- **Build**: passes. Main chunk `index-*.js` 412.38 kB (122.73 kB gzip); CSS 24.51 kB (5.27 kB gzip);
  answer keys 47.99 kB (2008) and 72.15 kB (2025); 15 locale chunks from 15.35 to 60.96 kB. All JS
  and CSS gzipped together: 273,092 bytes. `dist/` in total (with audio and pictures): 26,864 KB.
- **Function bundle**: passes, 51,102 bytes.
- **Layout check** (production, English, normal, 390px): 25 screens, all pass, no CSP violation.
- **`npm audit`**: 0 vulnerabilities.
- **Hook tests**: pass.

## Group 1 — TypeScript 5.8.3 → 7.0.2

Sources read: "Announcing TypeScript 7.0"
(https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), which sends readers to the
TypeScript 6.0 notes for the deprecations. 7.0 is the Go port, with 6.0's type checking, and it turns
6.0's deprecations into errors.

Breaking changes checked against this repository:
- **New defaults** (`strict`, `module: esnext`, `noUncheckedSideEffectImports`, `types: []`,
  `rootDir: ./`): no effect. Both configs already set `strict`, `module`, `target` and
  `noUncheckedSideEffectImports`. The app config lists its only ambient types
  (`@types/dom-speech-recognition`), and the node config needs none. `noEmit` is set, so `rootDir`
  does not apply.
- **Removed options** (`es5`, `downlevelIteration`, `moduleResolution: node/node10/classic`,
  `baseUrl`, `amd/umd/systemjs`, `esModuleInterop: false`, `asserts` imports): none are used. The
  configs use `moduleResolution: bundler`, and JSON imports use `with`.
- **No programmatic API in 7.0**: nothing in the repository imports `typescript`. Vite and Vitest
  compile TypeScript with their own transformers, not with `tsc`.
- **Template literal types and JavaScript (JSDoc) checking changes**: not used (`.mjs` tools are not
  type-checked).

What changed: `package.json` and the lockfile only.

Checks:
- **Typecheck**: 0 errors. TS 7 sees 161 files under `src/`, and a planted type error was reported,
  so it is really checking.
- **Tests**: 1373 of 1373 pass (62 files).
- **Build**: passes; output byte-identical to the baseline (Vite does the compiling).
- **Function bundle**: passes, 51,102 bytes.
- **Layout check** (production, English, normal, 390px): 25 screens, all pass.
- **Hook tests**: pass.

## Group 2 — Vite 6.4.5 → 8.3.8, @vitejs/plugin-react 4.5.2 → 6.3.0

Sources read:
- "Migration from v6" (https://v7.vite.dev/guide/migration)
- "Migration from v7" (https://vite.dev/guide/migration)
- The plugin-react changelog
  (https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md, 5.0.0 to 6.3.0)

Breaking changes checked against this repository:
- **Node 20.19+ / 22.12+** (Vite 7, plugin-react 5): CI uses 22.18, the machine 26.13. No change.
- **Default browser target** raised (Chrome 111, Edge 111, Firefox 114, Safari 16.4). The app sets no
  `build.target`, so the default applies. That fits the audience's phones (Safari 16.4 is from
  2023), but it is a change for very old browsers.
- **Rolldown and Oxc replace Rollup and esbuild** (bundling, JS transform and minify); **Lightning CSS
  minifies CSS**. The app has no esbuild or Rollup options. The build output changed size (below), and
  the layout check confirms it runs.
- **`build.rollupOptions` renamed to `build.rolldownOptions`**: changed in `vite.speech-test.config.ts`
  (the only use). That config still builds.
- **esbuild is no longer a dependency of Vite.** The Pages Function bundle check uses esbuild, so
  `esbuild` 0.28.2 (inside Vite 8's peer range) is now an explicit dev dependency. The baseline check
  used 0.25.12, which came with Vite 6.
- **Consistent CommonJS interop, no format sniffing, `manualChunks` object form removed,
  `splitVendorChunkPlugin` removed, Sass legacy API removed**: not used.
- **plugin-react 6 removes the Babel features; 5 stops adding react to `resolve.dedupe`**: the config
  calls `react()` with no options, and there is one copy of react (19.1.0).
- Vitest 4.1.12 declares `vite ^6 || ^7 || ^8`, so it runs on Vite 8 unchanged.

What changed: `package.json`, the lockfile, `vite.speech-test.config.ts`, and the `esbuild` dev
dependency.

Checks:
- **Typecheck**: 0 errors.
- **Tests**: 1373 of 1373 pass.
- **Build**: passes.

  | Chunk | Baseline | Vite 8 |
  |---|---|---|
  | Main JS (`index-*.js`) | 412.38 kB / 122.73 kB gzip | 406.76 kB / 120.28 kB gzip |
  | CSS | 24.51 kB / 5.27 kB gzip | 24.31 kB / 5.31 kB gzip |
  | All JS and CSS, gzipped | 273,092 bytes | 268,803 bytes (−1.6%) |

- **Function bundle**: passes, 51,102 bytes (unchanged).
- **Layout check** (production, English, normal, 390px): 25 screens, all pass, no CSP violation.
- **Hook tests**: pass.

## Group 3 — Vitest 4.1.12 → 5.1.1 (with @fast-check/vitest, jsdom, @testing-library/react)

Source read: "Migrating to Vitest 5.0" (https://vitest.dev/guide/migration). The companion packages
were already at their latest versions, so they stay as they are: @fast-check/vitest 0.5.0 (declares
`vitest ^4.1.0 || ^5.0.0`), jsdom 31.0.1, @testing-library/react 16.3.3, @testing-library/dom 10.4.2.

Breaking changes checked against this repository:
- **Node 22.12+ and Vite 6.4+**: CI 22.18, Vite 8.3.8.
- **`clearMocks` is on by default**: no test counts calls across tests or records them in a setup file
  or `beforeAll`. Every spy is created inside its test or in `beforeEach`. All tests pass unchanged.
- **Unawaited `.resolves` / `.rejects` now fail; `vi.mock` / `vi.hoisted` must be top level;
  `toThrow("")` matches any message; `test.sequential` removed; benchmark API rewritten; deprecated
  entry points (`vitest/coverage`, `vitest/reporters`, ...) removed**: none of these are used (searched
  `src/` and `tools/`). The only Vitest import besides `vitest` is `vitest/config`, which stays.
- **Titles formatted with pretty-format**: no snapshot or title-dependent assertion.
- **Global assignments propagate to the jsdom window**: the interaction tests use `vi.stubGlobal`, and
  they pass.

What changed: `package.json` and the lockfile only. No test expectation changed.

Checks:
- **Typecheck**: 0 errors.
- **Tests**: 1373 of 1373 pass; none reported as skipped or todo.
- **Build**: passes; same output as group 2.
- **Function bundle**: passes, 51,102 bytes.
- **Layout check** (production, English, normal, 390px): 25 screens, all pass.
- **Hook tests**: pass.
