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
