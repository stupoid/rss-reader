---
name: testing
description: Patterns for writing Playwright tests in the RSS Reader mock harness. Use when adding or modifying tests in tests/extension.spec.ts.
---

# Testing the RSS Reader

Tests run against a mock harness (`tests/harness/harness.html`) that loads the real popup code with an in-memory `chrome.*` shim (`tests/harness/chrome-mock.js`). No real extension, no service worker. 21 features × 2 browsers = 42 tests.

## Harness lifecycle

Each test resets state completely:

```ts
test.beforeEach(async ({ page }) => {
  await page.route("**/example.com/**", route => route.fulfill(…));
  await page.goto("/tests/harness/harness.html");
  await page.evaluate(() => window.__reset());   // clear storage + tracking arrays
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.renderId !== undefined);
});
```

## Feed interception

Use Playwright's `page.route` to serve RSS fixtures. The sample feed at the top of the test file (`SAMPLE_RSS`) has 3 items with `pubDate` and `guid`. For custom feeds, define a new RSS string and add a route for its domain:

```ts
const NO_DATE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>No Date Blog</title>
    <link>https://nodate.example.com</link>
    <item>
      <title>Undated Post</title>
      <link>https://nodate.example.com/1</link>
      <guid>post-1</guid>
    </item>
  </channel>
</rss>`;

await page.route("**/nodate.example.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/rss+xml", body: NO_DATE_RSS }),
);
```

Route patterns use Playwright globs (`**` matches any path). The route must be set BEFORE calling `page.goto`.

## Adding a feed

```ts
await page.locator("#feed-url-input").fill("https://testblog.example.com/rss");
await page.locator("#feed-url-input").press("Enter");
await page.waitForSelector(".item");  // or page.waitForFunction(…renderId…)
```

## Waiting for render

The popup sets `document.body.dataset.renderId` after each render cycle. Use this instead of arbitrary timeouts:

```ts
await page.waitForFunction(() => document.body.dataset.renderId !== undefined);
```

For tests that trigger a re-render (edit, delete, toggle), call this AFTER the mutation to wait for the DOM update.

## Selector reference

| Target | Selector | Notes |
|---|---|---|
| Feed chips | `.feed-chip` | "All" chip is always `.feed-chip:first-child` |
| Feed chip label | `.feed-chip .chip-label` | Use `.nth(1)` to skip "All" |
| Feed chip edit button | `.edit-btn` | Triggers inline title edit |
| Title edit input | `.chip-edit-input` | Appears after clicking `.edit-btn` |
| Items | `.item` | Each feed item row |
| Item title | `.item-title` | Has `title` attribute for overflow tooltip |
| Item meta line | `.item-meta` | Contains feed label + middot + date |
| Read/unread dot | `.status-dot` | `.read` / `.unread` class |
| Show-read checkbox | `#show-read-checkbox` | Hidden when no read items exist |
| Feed search | `#feed-search` | Gates feed selection filtering |
| Add feed input | `#feed-url-input` | Submit with Enter |
| Empty state | `#empty-state` | Visible when no unread items |
| Refresh button | `#refresh-btn` | Has `.refresh-icon` span for spin |
| Interval button | `#interval-btn` | Opens `#interval-dropdown` |
| Interval label | `#interval-label` | Shows current interval text |
| Menu button | `#menu-btn` | Opens `#menu-dropdown` |
| Import button | `#menu-import` | Triggers file chooser |
| Export button | `#menu-export` | Triggers download |

## Mock hooks

The mock exposes these on `window` for test assertions:

```ts
// Verify storage state
const stored = await page.evaluate(() => window.__storedInterval);
expect(stored).toBe(0);

// Verify messages sent to background
const messages: unknown[] = await page.evaluate(() => window.__sentMessages || []);
expect(messages).toContainEqual({ type: "SET_INTERVAL", interval: 0 });

// Verify tabs opened
const tabs: string[] = await page.evaluate(() => window.__openedTabs || []);
expect(tabs).toContain("https://testblog.example.com/hello");
```

## OPML import

```ts
await page.locator("#menu-btn").click();
const fileChooserPromise = page.waitForEvent("filechooser");
await page.locator("#menu-import").click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles({
  name: "feeds.opml",
  mimeType: "text/xml",
  buffer: Buffer.from(opmlXmlString),
});
```

The OPML XML string must include `<outline>` elements with `xmlUrl` (or `xmlurl`) attributes.

## OPML export

```ts
const downloadPromise = page.waitForEvent("download");
await page.locator("#menu-btn").click();
await page.locator("#menu-export").click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toBe("feeds.opml");
```

## Refresh interval

```ts
// Default label
await expect(page.locator("#interval-label")).toHaveText("15m");

// Open dropdown
await page.locator("#interval-btn").click();

// Select option
await page.locator('#interval-dropdown [data-interval="0"]').click();

// Verify label updated
await expect(page.locator("#interval-label")).toHaveText("Off");
```

## Edit feed title

```ts
await page.locator(".edit-btn").click();
const input = page.locator(".chip-edit-input");
await input.fill("New Title");
await input.press("Enter");
await page.waitForFunction(() => document.body.dataset.renderId !== undefined);
```

## Limitations

- **Background worker is untestable.** Alarms, badge updates, and `refreshAllFeeds()` run in the SW — the mock's `chrome.runtime.sendMessage` always returns `{ ok: true }` synchronously.
- **Storage doesn't survive `page.reload()`.** The mock store is a plain object, recreated on page load. Test persistence by reading `window.__storedInterval` or storage state in the same page session.
- **No real fetch.** All network requests must be intercepted with `page.route`.
