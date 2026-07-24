# RSS Reader — Agent Guide

## Project overview

npm install
npm run dev     # build + watch (recompile on change)
npm run session-info  # session metadata, cost, token usage
npm run build   # one-shot build
npm run lint    # tsc --noEmit && biome check
npm run test    # playwright test (34 tests, Chromium + Firefox)
npm run package # build + zip for distribution

Load extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Workflow conventions

- **Docs → test → code**: document behavior in `docs/state-model.md`, write a Playwright test, then implement.
- **Feature tests live in `tests/extension.spec.ts`** — mock harness loads real popup code with in-memory `chrome.*` shim.
- **Biome formats on `check --write`** — run `npx @biomejs/biome format --write src/` before committing.
- **Imports use `.js` extensions** (required by Chrome's ES module loader; TypeScript resolves to `.ts` during compilation).
- **No ESLint** — Biome handles linting, `tsc --noEmit` handles type-checking with `noUnusedLocals` + `noUnusedParameters`.

## Architecture

```text
src/
├── background.ts      # service worker: alarms, badge, refresh
├── popup/
│   ├── popup.html     # single-pane UI (380×600px)
│   ├── popup.css      # plain CSS, flexbox
│   └── popup.ts       # feed/item management, OPML
├── shared/
│   ├── types.ts       # Feed, FeedItem, ParsedFeed + storage keys
│   ├── parser.ts      # RSS 2.0 + Atom → ParsedFeed
│   ├── storage.ts     # chrome.storage.local wrappers
│   └── fetcher.ts     # fetch + parse pipeline
└── manifest.json      # MV3 manifest (copied to dist/ on build)
```

Tests: `tests/extension.spec.ts` + `tests/harness/` (mock HTML + chrome-mock.js).

Docs: `CONTEXT.md` (glossary), `docs/design.md` (architecture + decisions), `docs/state-model.md` (mermaid diagrams).

## Key patterns

- **DOM refs use `!` non-null assertions** — `document.getElementById("foo")!`. Biome allows this (configured in `biome.json`).
- **State is module-scoped variables** — `feeds[]`, `items[]`, `selectedFeedIds` (Set), `showRead`, `initialized`. No framework.
- **Rendering is imperative** — `render()` calls `renderFeeds()` + `renderItems()`. Triggers: search input, chip click, item action, add/remove/edit.
- **`loadAndRender()`** re-reads storage (used after mutations). `render()` re-renders from in-memory state (used for view changes).
- **Storage is flat** — `feeds[]` and `items[]` as separate keys in `chrome.storage.local`. Items join to feeds via `feedId`.
- **Parser normalizes** — `parseFeed()` detects `<rss>` vs `<feed>`, normalizes both into `ParsedFeed`. Downstream never sees format differences.
- **Search gates feed selection** — empty search = all items shown. Search has text = filtered by `selectedFeedIds` Set.
- **"All" chip** — highlighted when all feeds in Set. Click toggles all/none.

## Things to know before changing code

- Background worker (alarms, badge, manual refresh) is **untestable in the mock harness** — only testable by loading the real extension.
- The `console.warn` in `background.ts` is intentional (Biome suppressed via `// biome-ignore`).
- `biome.json` disables `noNonNullAssertion` (load-bearing pattern for DOM refs).
- `tsconfig.json` has `noUnusedLocals: true` and `noUnusedParameters: true` — any unused variable is a compile error.
- `INTERVAL_OPTIONS` was deliberately removed — interval values are hardcoded in the HTML `<select>`. If adding new intervals, update both the HTML and the dropdown.
