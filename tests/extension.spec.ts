import { expect, test } from "@playwright/test";

const HARNESS = "/tests/harness/harness.html";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://testblog.example.com</link>
    <item>
      <title>Hello World</title>
      <link>https://testblog.example.com/hello</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <guid>post-hello</guid>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://testblog.example.com/second</link>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <guid>post-second</guid>
    </item>
    <item>
      <title>Breaking News</title>
      <link>https://testblog.example.com/breaking</link>
      <pubDate>Wed, 03 Jan 2024 12:00:00 GMT</pubDate>
      <guid>post-breaking</guid>
    </item>
  </channel>
</rss>`;

test.describe("RSS Reader", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept feed fetches
    await page.route("**/testblog.example.com/**", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/rss+xml",
        body: SAMPLE_RSS,
      });
    });

    // Auto-dismiss alerts
    page.on("dialog", (dialog) => dialog.dismiss());
    page.on("pageerror", (err) => console.error("[page error]", err.message));

    // Navigate to harness with fresh state
    await page.goto(HARNESS);
    await page.evaluate(() => window.__reset());
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.renderId !== undefined);
  });

  test("shows empty state initially", async ({ page }) => {
    await expect(page.locator("#empty-state")).toBeVisible();
    await expect(page.locator(".item")).toHaveCount(0);
  });

  test("adds a feed and displays items sorted newest first", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');

    await expect(page.locator(".item")).toHaveCount(3);
    await expect(page.locator(".feed-chip .count").last()).toHaveText("3");
    await expect(page.locator(".item .item-title").nth(0)).toHaveText("Breaking News");
    await expect(page.locator(".item .item-title").nth(1)).toHaveText("Second Post");
    await expect(page.locator(".item .item-title").nth(2)).toHaveText("Hello World");
    await expect(page.locator(".item .status-dot.unread")).toHaveCount(3);
  });

  test("clicking an item opens link and dismisses the item", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".item").first().click();

    await expect(page.locator(".item")).toHaveCount(2);
    await expect(page.locator(".feed-chip .count").last()).toHaveText("2");

    const tabs: string[] = await page.evaluate(() => window.__openedTabs || []);
    expect(tabs).toContain("https://testblog.example.com/breaking");
  });

  test("clicking dot toggles read state", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".item .status-dot.unread").first().click();
    await expect(page.locator(".item")).toHaveCount(2);

    const tabs: string[] = await page.evaluate(() => window.__openedTabs || []);
    expect(tabs).toHaveLength(0);
  });

  test("clicking dot on read item marks it unread", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".item .status-dot.unread").first().click();
    await expect(page.locator(".item")).toHaveCount(2);

    await page.locator("#show-read-checkbox").check();
    await expect(page.locator(".item.read")).toHaveCount(1);

    await page.locator(".item .status-dot.read").click();
    await expect(page.locator(".item.read")).toHaveCount(0);
    await expect(page.locator(".item")).toHaveCount(3);
  });

  test("removes a feed and its items", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".feed-chip .remove-btn").click();

    await expect(page.locator(".item")).toHaveCount(0);
    await expect(page.locator("#empty-state")).toBeVisible();
    await expect(page.locator(".feed-chip")).toHaveCount(1);
  });

  test("edits feed title via edit button", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);
    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Test Blog");

    await page.locator(".feed-chip .edit-btn").click();
    await expect(page.locator(".chip-edit-input")).toBeVisible();
    await page.fill(".chip-edit-input", "My Renamed Feed");
    await page.locator(".chip-edit-input").press("Enter");

    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("My Renamed Feed");
  });

  test("cancels feed title edit on Escape", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".feed-chip .edit-btn").click();
    await expect(page.locator(".chip-edit-input")).toBeVisible();
    await page.fill(".chip-edit-input", "Nope");
    await page.locator(".chip-edit-input").press("Escape");

    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Test Blog");
  });

  test("empty title edit is rejected", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".feed-chip .edit-btn").click();
    await page.fill(".chip-edit-input", "");
    await page.locator(".chip-edit-input").press("Enter");

    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Test Blog");
  });

  test("item titles have native tooltip for overflow", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    const title = await page.locator(".item .item-title").first().getAttribute("title");
    expect(title).toBe("Breaking News");
  });

  test("feed selection filters items when search is active", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.fill("#feed-url-input", "https://testblog.example.com/rss2");
    await page.click('#add-feed-form button[type="submit"]');
    // Search empty → show all 6
    await expect(page.locator(".item")).toHaveCount(6);

    // Type in search to activate feed filtering
    await page.fill("#feed-search", "blog");
    // All feeds selected → still 6
    await expect(page.locator(".item")).toHaveCount(6);

    // Deselect first feed → only second feed's 3 items
    await page.locator(".feed-chip").nth(1).click();
    await expect(page.locator(".item")).toHaveCount(3);

    // Clear search → back to all 6
    await page.fill("#feed-search", "");
    await expect(page.locator(".item")).toHaveCount(6);
  });

  test("search filters feed chips by title", async ({ page }) => {
    // Add two feeds (both get same mock data, title "Test Blog")
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    // Rename the first feed so we have distinct titles
    await page.locator(".feed-chip .edit-btn").last().click();
    await page.fill(".chip-edit-input", "Alpha Blog");
    await page.locator(".chip-edit-input").press("Enter");
    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Alpha Blog");

    // Add second feed (title "Test Blog")
    await page.fill("#feed-url-input", "https://testblog.example.com/rss2");
    await page.click('#add-feed-form button[type="submit"]');
    // Click All to show both
    await page.locator(".feed-chip").first().click();

    // Both chips visible (All + Alpha Blog + Test Blog)
    await expect(page.locator(".feed-chip")).toHaveCount(3);

    // Search for "alpha" — only Alpha Blog chip should show
    await page.fill("#feed-search", "alpha");
    await expect(page.locator(".feed-chip")).toHaveCount(2); // All + Alpha Blog

    // Clear search — all back
    await page.fill("#feed-search", "");
    await expect(page.locator(".feed-chip")).toHaveCount(3);
  });

  test("show read label hides when all read items are marked unread", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      await page.locator(".item .status-dot.unread").first().click();
    }

    await expect(page.locator("#show-read-label")).toBeVisible();
    await page.locator("#show-read-checkbox").check();
    await expect(page.locator(".item.read")).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      await page.locator(".item .status-dot.read").first().click();
    }

    await expect(page.locator("#show-read-label")).toBeHidden();
    await expect(page.locator(".item")).toHaveCount(3);
  });

  test("show read toggle reveals dimmed read items", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    await page.locator(".item .status-dot.unread").first().click();
    await expect(page.locator(".item")).toHaveCount(2);

    await expect(page.locator("#show-read-label")).toBeVisible();
    await page.locator("#show-read-checkbox").check();

    await expect(page.locator(".item.read")).toHaveCount(1);
    await expect(page.locator(".item .status-dot.read")).toHaveCount(1);
    await expect(page.locator(".item .status-dot.unread")).toHaveCount(2);

    await page.locator("#show-read-checkbox").uncheck();
    await expect(page.locator(".item.read")).toHaveCount(0);
  });

  test("refresh interval defaults to 15m and can be changed via split button", async ({ page }) => {
    // Label shows default
    await expect(page.locator("#interval-label")).toHaveText("15m");

    // Open interval dropdown
    await page.locator("#interval-btn").click();

    // 15m should be active
    await expect(page.locator('#interval-dropdown [data-interval="15"]')).toHaveClass(/active/);

    // Click "Manual only"
    await page.locator('#interval-dropdown [data-interval="0"]').click();

    // Label updates
    await expect(page.locator("#interval-label")).toHaveText("Off");

    // Verify stored value
    const stored = await page.evaluate(() => window.__storedInterval);
    expect(stored).toBe(0);

    // Verify message sent to background
    const messages: unknown[] = await page.evaluate(() => window.__sentMessages || []);
    expect(messages).toContainEqual({ type: "SET_INTERVAL", interval: 0 });
  });
  test("export downloads an OPML file with all feeds", async ({ page }) => {
    await page.fill("#feed-url-input", "https://testblog.example.com/rss");
    await page.click('#add-feed-form button[type="submit"]');
    await expect(page.locator(".item")).toHaveCount(3);

    // Open menu and click Export
    await page.locator("#menu-btn").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#menu-export").click(),
    ]);

    expect(download.suggestedFilename()).toBe("feeds.opml");
  });

  test("import adds feeds from OPML file", async ({ page }) => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Imported Blog" title="Imported Blog" type="rss" xmlUrl="https://testblog.example.com/rss"/>
  </body>
</opml>`;

    // Open menu and trigger import
    await page.locator("#menu-btn").click();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#menu-import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "feeds.opml",
      mimeType: "text/xml",
      buffer: Buffer.from(opml),
    });

    // Items from imported feed should appear
    await expect(page.locator(".item")).toHaveCount(3);
    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Imported Blog");
  });

  test("renders no dangling middot for items without pubDate", async ({ page }) => {
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

    await page.locator("#feed-url-input").fill("https://nodate.example.com/rss");
    await page.locator("#feed-url-input").press("Enter");
    await page.waitForSelector(".item");

    // The middot should not appear when pubDate is absent
    const metaText = await page.locator(".item-meta").first().textContent();
    expect(metaText).not.toContain("\u00b7");
  });

  test("imports OPML with case-insensitive xmlUrl attribute", async ({ page }) => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Lowercase Blog" title="Lowercase Blog" type="rss" xmlurl="https://testblog.example.com/rss"/>
  </body>
</opml>`;

    await page.locator("#menu-btn").click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#menu-import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "feeds.opml",
      mimeType: "text/xml",
      buffer: Buffer.from(opml),
    });

    await expect(page.locator(".item")).toHaveCount(3);
    await expect(page.locator(".feed-chip .chip-label").last()).toHaveText("Lowercase Blog");
  });

  test("import skips duplicate feed URLs in batch", async ({ page }) => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="First" title="First" type="rss" xmlUrl="https://testblog.example.com/rss"/>
    <outline text="Duplicate" title="Duplicate" type="rss" xmlUrl="https://testblog.example.com/rss"/>
  </body>
</opml>`;

    await page.locator("#menu-btn").click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#menu-import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "feeds.opml",
      mimeType: "text/xml",
      buffer: Buffer.from(opml),
    });

    // Only one feed chip should appear (duplicate skipped) + All chip
    await expect(page.locator(".feed-chip")).toHaveCount(2);
    await expect(page.locator(".feed-chip .chip-label").nth(1)).toHaveText("First");
  });

  test("edited feed title updates after persistence", async ({ page }) => {
    await page.locator("#feed-url-input").fill("https://testblog.example.com/rss");
    await page.locator("#feed-url-input").press("Enter");
    await page.waitForSelector(".item");

    // Edit the feed title
    await page.locator(".edit-btn").click();
    const input = page.locator(".chip-edit-input");
    await input.fill("Renamed Blog");
    await input.press("Enter");
    await page.waitForFunction(() => document.body.dataset.renderId !== undefined);

    // Title updated in UI
    await expect(page.locator(".feed-chip .chip-label").nth(1)).toHaveText("Renamed Blog");
  });
});
