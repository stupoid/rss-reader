# RSS Reader — Domain Glossary

## Feed

A subscription to an RSS 2.0 or Atom XML document at a URL. Each feed has a unique ID, a URL, a display title (editable), a link to the source website, and a timestamp of when it was added.

## Feed Item

A single entry within a feed — an article, post, or update. Each item belongs to exactly one feed, has a stable ID (derived from the feed's `<guid>`/`<id>`, or a hash of title+link as fallback), a title, a link to the full article, a publication date, and a read/unread flag.

## Unread / Read

An item starts as **unread** when first fetched. It becomes **read** when dismissed (via dot toggle or row click). Read items are hidden from the default view but can be revealed via the "Show read" toggle. Marking a read item as unread returns it to the active list. Visual indicators: ● (filled, unread), ○ (unfilled, read).

## Dismiss

The action of marking an unread item as read — removes it from the default (unread-only) view. Two ways: click the row (opens the article link + marks read), or click the dot (toggles read state, no navigation).

## Selection (multi-select)

A set of feed IDs (`selectedFeedIds`) controlling which feeds' items appear. Clicking a feed chip toggles it in/out of the set. Unlike single-select filtering, multiple feeds can be active simultaneously. The "All" chip selects or deselects all feeds at once.

## "All" chip

A master toggle in the feed chip row. Highlighted when every feed is in the selection set. Click toggles between "all feeds selected" and "no feeds selected." Individual feed selections can override it.

## Search

A text input above the feed chip row. When empty, all items from all feeds are shown (selection is ignored). When the search has text, the item list is filtered to only selected feeds' items, and the feed chip row shows active chips plus any chips matching the search term.

## Feed chip visibility

Active chips (feeds in the selection set) are always visible in the chip row. When the search input has text, inactive chips only appear if their title matches the search term. When the search is empty, all chips are shown regardless of selection state.

## Show read toggle

A checkbox that appears once at least one item has been dismissed. When checked, read items appear below unread items, dimmed, with unfilled ○ dots. Unchecking hides them again.
