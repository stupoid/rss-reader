# RSS Reader — State Model

## Selection state

The feed selection controls which feeds' items appear in the list, gated by the search input.

```mermaid
flowchart TD
    A[User types in search] --> B{Search empty?}
    B -->|yes| C[Show ALL items<br/>from all feeds]
    B -->|no| D[Filter by selectedFeedIds<br/>only items from selected feeds]
```

### selectedFeedIds (Set\<string\>)

| State | Meaning |
|---|---|
| Contains all feed IDs | "All" is selected — every feed active |
| Contains some feed IDs | Only those feeds are active |
| Empty | No feeds active — empty list (when search active) |

The Set is initialized with all feed IDs on first load. Adding a feed auto-selects it. Removing a feed removes it from the Set.

### "All" chip

```mermaid
stateDiagram-v2
    [*] --> AllSelected: init (all feeds in Set)
    AllSelected --> NoneSelected: click "All"
    NoneSelected --> AllSelected: click "All"
    AllSelected --> Partial: click individual feed
    Partial --> AllSelected: click "All"
    Partial --> NoneSelected: deselect last feed
    NoneSelected --> Partial: click individual feed
    Partial --> Partial: click another feed
```

- Always visible in the chip row
- **Highlighted** when `selectedFeedIds.size === feeds.length`
- **Click**: if all feeds selected → clear Set. Otherwise → fill Set with all feed IDs

### Feed chip visibility

```mermaid
flowchart TD
    F[Feed chip] --> A{Active?<br/>in selectedFeedIds?}
    A -->|yes| V[Always visible]
    A -->|no| M{Matches search?}
    M -->|yes| V
    M -->|no| H[Hidden]
```

## Refresh interval

Stored in `chrome.storage.local` under key `refreshInterval` (minutes). Default: 15.

| Value | Label |
|---|---|
| 5 | Every 5m |
| 15 | Every 15m |
| 30 | Every 30m |
| 60 | Every hour |
| 0 | Manual only |

The popup shows a dropdown next to the refresh button displaying the current interval. Changing it updates storage and sends a message to the background worker to reconfigure the alarm. The background worker reads the interval on startup and on every alarm fire, then re-creates the alarm with the new period (or clears it entirely for manual mode).

```mermaid
flowchart LR
    P[Popup dropdown change] --> S[chrome.storage.local]
    S --> M[chrome.runtime.sendMessage]
    M --> B[Background worker]
    B --> A[Recreate alarm]
```

## Import / Export (OPML)

OPML 2.0 is the standard interchange format for feed subscriptions. Every major RSS reader supports it.

**Export**: serialize all feeds to an OPML document → trigger download via Blob URL.

**Import**: file picker → parse OPML XML → extract `<outline>` elements with `xmlUrl` → bulk-add feeds (skip duplicates by URL). After import, all new feeds are selected and items are fetched.

```mermaid
flowchart LR
    E[Export click] --> S[Serialize feeds to OPML]
    S --> D[Download .opml file]
    I[Import click] --> F[File picker]
    F --> P[Parse OPML XML]
    P --> A[Add feeds, fetch items]
```

Menu: "..." button in header → dropdown with "Import feeds" + "Export feeds". Designed for future expansion (themes, settings, etc.).

## Read/unread state

```mermaid
stateDiagram-v2
    Unread --> Read: click dot ●
    Read --> Unread: click dot ○
    Unread --> Read: click row (opens link too)
```

| Toggle | Effect |
|---|---|
| Show read off (default) | Only unread items visible |
| Show read on | Read items appear dimmed below unread, with ○ dots |

## Render pipeline

```mermaid
flowchart TD
    L[loadAndRender] --> G[getFeeds + getItems]
    G --> I{first load?}
    I -->|yes| P[populate selectedFeedIds<br/>with all feed IDs]
    I -->|no| R
    P --> R[render]
    R --> RF[renderFeeds]
    R --> RI[renderItems]
```

Triggers:
- Search input → `render()` (both feeds + items)
- Feed chip click → `render()`
- Item dot/row click → `loadAndRender()` (re-reads storage)
- Add/remove/edit feed → `loadAndRender()`
- Show-read toggle → `renderItems()` only
