---
inclusion: always
---

# Language Lab — Structure Steering

## Folder Layout

```
language-lab/
├── src/
│   ├── contracts/      # Shared TypeScript types and interfaces (session, scoring, report)
│   ├── engine/         # Pure logic: scoring, session flow, answer matching
│   ├── ui/             # React components, hooks, pages
│   └── main.tsx        # App entry point
├── worker/             # Cloudflare Worker source (edge API handlers)
├── data/               # Static civics data: test-rules.json, answer files
├── mock/               # Fictional session fixtures for development and testing
├── docs/               # Architecture decisions (kiro-log.md), guides
├── public/             # Static assets served by Vite
├── .kiro/
│   ├── steering/       # These files
│   └── hooks/          # Agent automation hooks
└── ...config files
```

## Responsibilities by Folder

### `src/contracts/`
- Single source of truth for all shared types.
- No runtime logic. Types and interfaces only.
- Everything exported from an `index.ts` barrel.

### `src/engine/`
- Pure functions: no React, no DOM, no fetch.
- Scoring, session state transitions, answer normalization.
- Fully testable with Vitest + fast-check.

### `src/ui/`
- React components and hooks.
- Imports types from `src/contracts/`, logic from `src/engine/`.
- No civics scoring logic lives here.

### `worker/`
- Cloudflare Worker handlers.
- Thin API layer: validates input, calls engine logic, returns responses.
- No secrets in source; reads from environment bindings.

### `data/`
- `test-rules.json` — official test parameters (question count, passing score).
- `civics-answers/` — answer key files, human-reviewed only.
- `translations/` — human-reviewed non-English UI text.

### `mock/`
- Fictional session JSON files used during development and in tests.
- Every mock file must include `"isFictional": true` and a `"Fictional practice profile"` note.

### `docs/`
- `kiro-log.md` — running log of architecture and product decisions.
- Other guides as needed.

## Naming Conventions

- Files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Types/interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Test files: `*.test.ts` or `*.test.tsx`
