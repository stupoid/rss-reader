# AGENTS.md

## Commands

- `npm run build` — tsc + copy static files to `dist/`
- `npm run test` — Playwright (42 tests, Chromium + Firefox)
- `npm run lint` — tsc --noEmit + biome check --write (lint + format)
- `npm run lint-md` — markdownlint on all docs

## Conventions

- **Docs → test → code.** Document behavior, write a Playwright test, then implement.
- **Imports use `.js` extensions.** Required by Chrome's ES module loader (`moduleResolution: "bundler"` in tsconfig). Exception: `import type` is erased at compile time — no `.js` needed.
- **No bundler, no framework.** `tsc` only. Source in `src/`, output in `dist/`. Never edit files in `dist/`.
- **DOM refs use `!`.** `document.getElementById("foo")!`. Biome allows this (`noNonNullAssertion: off` in biome.json).
- **State is module-scoped** in `popup.ts`: `feeds[]`, `items[]`, `selectedFeedIds` (Set), `showRead`. Rendering is imperative — no framework.
- **`loadAndRender()`** re-reads storage (use after mutations). **`render()`** re-renders from in-memory state (use for view/filter changes).
- **Storage is flat.** `feeds[]` and `items[]` as separate keys. Join on `feedId` at render time. Storage key constants live in `src/shared/types.ts` — never hardcode `"feeds"` or `"items"` strings.
- **Parser normalizes** RSS + Atom into shared `ParsedFeed` IR. Downstream code is format-agnostic. Don't add format-specific branches outside `parser.ts`.
- **Search gates feed selection.** Empty search = all items shown. Search with text = filtered by `selectedFeedIds` Set.
- **Tests live in `tests/extension.spec.ts`.** For test patterns (harness lifecycle, route interception, selectors, mock hooks), see `skill://testing`.

## Key files

| File | Role |
|---|---|
| `src/popup/popup.ts` | All UI: render, feed management, read/unread, OPML import |
| `src/shared/storage.ts` | chrome.storage.local CRUD wrappers |
| `src/shared/parser.ts` | RSS 2.0 + Atom → shared IR (DOMParser-based) |
| `src/background.ts` | Service worker: alarms, badge, message relay |
| `src/shared/types.ts` | Types + storage key constants |
| `tests/extension.spec.ts` | All feature tests |

## Pitfalls

- **Background worker (alarms, badge) is untestable** in the mock harness. Only testable by loading the real extension.
- **`noUnusedLocals: true`** and **`noUnusedParameters: true`** in tsconfig. Any unused variable or parameter is a compile error.
- **`console.warn` in `background.ts`** is intentional (service worker has no UI for errors). Suppressed via `// biome-ignore`.
- **Interval values are duplicated** in the interval dropdown markup (`popup.html`, `harness.html`) and `popup.ts`. Update all three if adding new options.
- **Biome only lints `src/` and `tests/`.** Config in `biome.json`. Other directories (scripts, docs) are not checked.
- **`chrome.storage.local` has no partial-array-update.** Mutators read full array, modify, write back. Single-threaded SW makes this safe. See `docs/design.md#known-limitations--non-fixes` for details.
- **`import type` is compile-time only.** No `.js` extension needed, no runtime import emitted. Don't flag missing `.js` on type-only imports.
