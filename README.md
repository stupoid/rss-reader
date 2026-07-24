# RSS Reader

A Chrome Extension (Manifest V3) RSS/Atom feed subscriber. No frameworks, no bundler — TypeScript + `tsc` + plain CSS.

> Built for $0.93 across 792 messages over 4h 1m — see [COST.md](COST.md) for breakdown

## Quick start

```sh
npm install
npm run build        # tsc + copy static files → dist/
```

Load extension: open `chrome://extensions`, enable Developer mode, click "Load unpacked," select the `dist/` directory.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Build once, then watch and recompile on changes |
| `npm run build` | Compile TypeScript + copy static files to `dist/` |
| `npm run lint` | Type-check (`tsc`) + lint (`biome`) |
| `npm run test` | Playwright tests (42 across Chromium + Firefox) |
| `npm run session-info` | Print session metadata (model, tokens, cost) |
| `npm run package` | Build + zip for Chrome Web Store / Firefox Add-ons |

## Architecture

```text
src/
├── background.ts      # service worker: alarms, badge, refresh
├── popup/
│   ├── popup.html     # single-pane UI (380×600px)
│   ├── popup.css      # plain CSS, flexbox layout
│   └── popup.ts       # render, multi-select, search, read/unread
├── shared/
│   ├── types.ts       # Feed, FeedItem, ParsedFeed, constants
│   ├── parser.ts      # RSS 2.0 + Atom → shared IR
│   ├── opml.ts        # OPML import/export
│   └── fetcher.ts     # fetch + parse
├── icons/             # PNG icons (16/48/128)
└── manifest.json      # MV3 manifest (copied to dist/ on build)
```

See [docs/design.md](docs/design.md) for the full architecture and design decisions.
See [docs/state-model.md](docs/state-model.md) for state diagrams and behavior.

## Features

- Add/remove feeds by URL (RSS 2.0 + Atom)
- Multi-select feeds with search
- Read/unread toggle via dot (● / ○)
- Show read toggle for archive
- Editable feed titles
- Configurable auto-refresh interval (5m / 15m / 30m / 1h / manual)
- OPML import/export (via "..." menu)
- Unread badge on toolbar icon
- Scrollable feed row and item list
- Native tooltip for truncated titles

## Linting

[Biome](https://biomejs.dev) handles linting and formatting (enforces sorted imports, unused imports/variables, no console in popup code). TypeScript strictness (`noUnusedLocals`, `noUnusedParameters`) catches dead code at compile time.

## Testing

Tests use a mock harness that loads the real popup code with an in-memory `chrome.*` shim. 21 features × 2 browsers (Chromium + Firefox) = 42 tests.

## Cost tracking

`npm run session-info` reads omp session files and writes `COST.md`. A shutdown hook (`.omp/hooks/shutdown/record-cost.mjs`) auto-runs this at session end.

Background worker features (alarms, badge, manual refresh) are untestable in the harness — see [docs/design.md#limitations-of-mock-harness](docs/design.md).
