# RSS Reader — Design & Architecture

## Overview

A Chrome Extension (Manifest V3) RSS/Atom feed subscriber. Built as a learning project to understand Chrome extension APIs, RSS/Atom parsing, and browser-native state management — no frameworks, no bundler, TypeScript compiled with `tsc` only.

Cross-browser: uses the `chrome.*` namespace, compatible with Firefox MV3 without a polyfill.

State model and behavior: see [state-model.md](./state-model.md).
## Architecture

```
┌──────────────────────────────────────────────┐
│  Popup (action)                              │
│  popup.html + popup.ts + popup.css           │
│  - Add/remove feeds, edit titles             │
│  - Multi-select feeds (toggle chips)         │
│  - Search feeds (fuzzy filter chips)         │
│  - Mark read/unread via dot toggle           │
│  - Show-read toggle                          │
│  - Scrollable feed row + item list           │
│  - Native title tooltip for overflow         │
├──────────────────────────────────────────────┤
│  Shared modules                              │
│  types.ts     — Feed, FeedItem, ParsedFeed   │
│  parser.ts    — RSS 2.0 + Atom → ParsedFeed  │
│  storage.ts   — chrome.storage.local wrappers│
│  fetcher.ts   — fetch + parse                │
├──────────────────────────────────────────────┤
│  Background (service worker)                 │
│  background.ts                               │
│  - chrome.alarms (15min refresh)             │
│  - Badge text (unread count)                 │
│  - Message bridge for manual refresh         │
└──────────────────────────────────────────────┘
```

### Data flow

1. User adds feed URL → popup calls `fetchFeed()` → `parseFeed()` → `addFeed()` + `upsertItems()`
2. Items stored flat in `chrome.storage.local` (keyed by `feeds` and `items`)
3. Popup reads from storage on open, re-renders on state change
4. Background worker reads feeds from storage, fetches each, upserts items, updates badge
5. Popup can trigger background refresh via `chrome.runtime.sendMessage({ type: 'REFRESH' })`

### State management

Plain variables in popup module scope: `feeds[]`, `items[]`, `selectedFeedIds` (Set), `showRead`, `initialized`. No reactive framework — after any mutation, `loadAndRender()` re-reads storage and re-renders the DOM. The background worker is stateless beyond what's in storage.

### Parser design

Single `parseFeed(xmlText)` entry point. Detects root element (`<rss>` vs `<feed>`), branches to format-specific extraction, normalizes into shared `ParsedFeed` → `ParsedItem[]`. Downstream code (storage, rendering) never sees format differences.

## Feature → Test Map

| Feature | Test | Selector |
|---|---|---|
| Empty state | `shows empty state initially` | `#empty-state` visible |
| Add feed + sort | `adds a feed and displays items sorted newest first` | 3 items, sorted desc, ● dots |
| Click row → open + dismiss | `clicking an item opens link and dismisses the item` | link opened, item count ↓ |
| Dot toggle (unread→read) | `clicking dot toggles read state` | ● click → vanishes, no link |
| Dot toggle (read→unread) | `clicking dot on read item marks it unread` | ○ click → back to ●, count ↑ |
| Remove feed | `removes a feed and its items` | × click → empty state |
| Edit feed title | `edits feed title via edit button` | ✎ → type → Enter → new title |
| Cancel edit (Escape) | `cancels feed title edit on Escape` | ✎ → type → Escape → unchanged |
| Reject empty title | `empty title edit is rejected` | clear → Enter → old title kept |
| Title tooltip | `item titles have native tooltip for overflow` | `title` attribute present |
| Feed selection (search-gated) | `feed selection filters items when search is active` | search → deselect feed → count ↓ |
| Feed chip search | `search filters feed chips by title` | type → chips filter, active chips stay |
| Show read toggle | `show read toggle reveals dimmed read items` | checkbox → ○ dots appear, uncheck → vanish |
| Refresh interval | `refresh interval dropdown defaults to 15m and can be changed` | dropdown → select "Manual only" → stored + message sent |
| OPML export | `export downloads an OPML file with all feeds` | menu → Export → `feeds.opml` download |
| OPML import | `import adds feeds from OPML file` | menu → Import → file picker → items appear |
| Read→unread hides label | `show read label hides when all read items are marked unread` | all ○→● → label hidden |

### Limitations of mock harness

These features exercise `chrome.*` APIs that aren't mocked with observable side effects:

- **Periodic refresh** (`chrome.alarms`) — background service worker
- **Unread badge** (`chrome.action.setBadgeText`) — toolbar icon
- **Manual refresh button** — bridges to background worker via `chrome.runtime.sendMessage`

All 21 tests run against both Chromium and Firefox (2 projects × 21 tests = 42 total). The mock harness uses Playwright's built-in `page` fixture with `projects: [{ browserName: 'chromium' }, { browserName: 'firefox' }]`. This validates the popup renders correctly in Gecko — the `chrome.*` namespace compatibility is inherent to the design.

## Design Decisions

### No bundler — TypeScript compiled with `tsc` only

Chrome extensions load JS files directly from disk. A bundler adds a build step, source map complexity, and an extra tool to understand before writing any extension code. `tsc` compiles `.ts` → `.js` with zero config beyond `tsconfig.json`. The cost: imports must include `.js` extensions in source (e.g. `from './storage.js'`), since Chrome's ES module loader requires explicit extensions. TypeScript resolves these to `.ts` during compilation and preserves them in output.

### Mock harness over extension loading

Playwright's bundled Chromium does not reliably support `--load-extension` for MV3 service workers. Rather than fighting browser quirks, the test harness loads the real popup code in a plain HTML page with a thin `chrome.*` mock (in-memory storage, no-op tabs/badge). This gives fast, deterministic tests of all popup behavior. The trade-off: background worker features (alarms, badge) are untestable in this harness.

### Flat storage in chrome.storage.local

Feeds and items are stored as two flat arrays (`feeds[]`, `items[]`) rather than nested (`feed.items[]`). This lets the popup read items without loading feeds, and the badge update touches only items. The cost is a join on `feedId` at render time, which is trivial for the data volumes of an RSS reader.

### Parser normalizes RSS + Atom into shared IR

Rather than two separate parsing paths throughout the codebase, `parseFeed()` detects the root element (`<rss>` vs `<feed>`) and normalizes both into `ParsedFeed` → `ParsedItem[]`. Downstream code (storage, rendering) never sees format differences. This is ~30 extra lines in the parser but eliminates format-awareness from the entire rest of the app.

### Search gates feed selection

When the search input is empty, all items from all feeds are shown — feed selection is ignored. This is the "browsing" mode. When the user types in the search, the item list switches to filtering by selected feeds only. This avoids the confusion of "why are no items showing?" when search is empty and no feeds are selected.

### Dot (●/○) as toggle indicator

The filled/unfilled dot serves as both a read-state indicator and a toggle control. Initially the dismiss action used ×, but × implies "delete," not "mark as read." The dot convention is universal: ● = new, ○ = seen. It also works symmetrically — clicking ○ on a read item marks it unread, which a dismiss × couldn't express.

### "All" chip as master toggle

The "All" chip selects or deselects all feeds at once. It's highlighted when every feed is in the selection set, and clicking it toggles between "all selected" and "none selected." This is distinct from a "reset" button — it's a proper toggle that integrates with multi-select. Individual feed selections can override it in either direction.

### CSS-only — no framework

The popup UI uses plain CSS with flexbox. No Tailwind, no component library. The popup is ~380px wide with a max height of 600px. The feed chip row scrolls horizontally (`overflow-x: auto`), and the item list fills remaining height and scrolls vertically (`flex: 1; overflow-y: auto`). This keeps the dependency count at zero for styles.

## Build & Test

```sh
bash build.sh       # tsc + copy static files to dist/
npx playwright test # 42 tests across Chromium + Firefox via mock harness
Load extension: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Known Limitations & Non-Fixes

These are intentional decisions documented so they don't resurface in future reviews. Each would add complexity disproportionate to its benefit for a learning-project RSS reader.

### Read-modify-write storage (C2)

All storage mutators (`addFeed`, `updateFeed`, `removeFeed`, `upsertItems`, `markRead`, `markUnread`) read the full array, mutate in memory, then write back. MV3 service workers are single-threaded and `chrome.storage.local` operations are sequential per key — data corruption is not possible in practice. The theoretical risk is double-work (two concurrent refreshes writing the same data), which is harmless. A proper transactional layer would require mutexes or compare-and-swap against `chrome.storage` — overkill for a single-user extension with < 1000 items.

### `upsertItems` drops items not in the current feed (H3)

When a feed is refreshed, items no longer present in the fetched XML are removed from storage. This is standard RSS reader behavior — feeds represent the publisher's current state. Some servers return only the last N items, which means older items "vanish." Keeping a full archive would require a separate history table and a configurable retention policy. The code comment at `storage.ts:52` documents this behavior.

### Entire items array rewritten on markRead/markUnread (M5)

`markRead`/`markUnread` read all items, mutate one, and write all back. `chrome.storage.local` has no partial-array-update primitive — you must read the whole value to change one element. Switching to per-item keys (e.g. `item_<id>`) would eliminate this but complicates the read path (N `get` calls to list items). For < 1000 items, the current approach is well within `chrome.storage.local`'s throughput limits.

### No explicit CSP in manifest (M7)

MV3 defaults to `script-src 'self'; object-src 'self'` for extension pages. The popup uses no inline scripts, no `eval`, and no external script sources — the default CSP is sufficient. An explicit CSP would be redundant.

### Type-only imports lack `.js` extension (H1)

`import type { Feed } from "./types"` is fully erased by `tsc` — no JS is emitted, so no runtime module resolution occurs. Adding `.js` to a type-only import is harmless but unnecessary.

### FNV-1a hash collision risk for item IDs (L3)

The hash fallback in `itemId()` is only used when both `<guid>` and `<id>` are absent — vanishingly rare in real feeds. A cryptographic hash would add a dependency or significant code for no practical benefit.

### Global click listener on `document` for dropdowns (L4)

One `document` click listener handles outside-click dismissal for both dropdowns (menu + interval). For a two-dropdown popup, this is simpler than per-element listeners and carries no measurable performance cost.

### Repeated intervalDropdown DOM queries (L5)

`intervalDropdown` is a module-level `const` cached at init. The "repeated queries" are `querySelectorAll`/`querySelector` calls on this cached element, not fresh `document.getElementById` calls. Each is a different selector (active class removal, initial active button lookup) — could be combined but the current code is clearer.
