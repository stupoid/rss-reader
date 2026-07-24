import { fetchFeed } from "../shared/fetcher.js";
import { exportOpml, importOpml } from "../shared/opml.js";
import {
  addFeed,
  getFeeds,
  getItems,
  getRefreshInterval,
  markRead,
  markUnread,
  removeFeed,
  setRefreshInterval,
  updateFeed,
  upsertItems,
} from "../shared/storage.js";
import type { Feed, FeedItem } from "../shared/types.js";

// ── State ──

let feeds: Feed[] = [];
let items: FeedItem[] = [];
const selectedFeedIds = new Set<string>();
let initialized = false;
let showRead = false;

// ── DOM refs ──

const feedList = document.getElementById("feed-list")!;
const itemsList = document.getElementById("items-list")!;
const emptyState = document.getElementById("empty-state")!;
const loadingState = document.getElementById("loading-state")!;
const addForm = document.getElementById("add-feed-form")! as HTMLFormElement;
const urlInput = document.getElementById("feed-url-input")! as HTMLInputElement;
const refreshBtn = document.getElementById("refresh-btn")!;
const showReadCheckbox = document.getElementById("show-read-checkbox")! as HTMLInputElement;
const showReadLabel = document.getElementById("show-read-label")!;
const feedSearch = document.getElementById("feed-search")! as HTMLInputElement;
const menuBtn = document.getElementById("menu-btn")!;
const menuDropdown = document.getElementById("menu-dropdown")!;
const menuExport = document.getElementById("menu-export")!;
const menuImport = document.getElementById("menu-import")!;
const importFileInput = document.getElementById("import-file-input")! as HTMLInputElement;
const intervalBtn = document.getElementById("interval-btn")!;
const intervalLabel = document.getElementById("interval-label")!;
const intervalDropdown = document.getElementById("interval-dropdown")!;

// ── Init ──

addForm.addEventListener("submit", handleAddFeed);
refreshBtn.addEventListener("click", handleRefresh);
showReadCheckbox.addEventListener("change", () => {
  showRead = showReadCheckbox.checked;
  renderItems();
});
feedSearch.addEventListener("input", () => render());
// Interval dropdown toggle
intervalBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.classList.add("hidden");
  intervalDropdown.classList.toggle("hidden");
});

// Interval selection
intervalDropdown.addEventListener("click", async (e) => {
  const btn = (e.target as HTMLElement).closest("[data-interval]");
  if (!btn) return;
  const minutes = Number(btn.getAttribute("data-interval"));
  await setRefreshInterval(minutes);
  await chrome.runtime.sendMessage({ type: "SET_INTERVAL", interval: minutes });
  intervalDropdown.querySelectorAll("[data-interval]").forEach((b) => {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  intervalLabel.textContent = minutes === 0 ? "Off" : `${minutes}m`;
  intervalDropdown.classList.add("hidden");
});

// Menu toggle
menuBtn.addEventListener("click", () => {
  intervalDropdown.classList.add("hidden");
  menuDropdown.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target as Node) && !menuDropdown.contains(e.target as Node)) {
    menuDropdown.classList.add("hidden");
  }
  if (!intervalBtn.contains(e.target as Node) && !intervalDropdown.contains(e.target as Node)) {
    intervalDropdown.classList.add("hidden");
  }
});

// Export
menuExport.addEventListener("click", async () => {
  menuDropdown.classList.add("hidden");
  const opml = exportOpml(feeds);
  const blob = new Blob([opml], { type: "text/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "feeds.opml";
  a.click();
  URL.revokeObjectURL(url);
});

// Import
menuImport.addEventListener("click", () => {
  menuDropdown.classList.add("hidden");
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = importOpml(text);
  for (const { title, url } of imported) {
    const currentFeeds = await getFeeds();
    if (currentFeeds.some((f) => f.url === url)) continue; // skip duplicates
    const feed: Feed = { id: crypto.randomUUID(), url, title, link: "", addedAt: Date.now() };
    await addFeed(feed);
    selectedFeedIds.add(feed.id);
    try {
      const parsed = await fetchFeed(url);
      await upsertItems(feed.id, parsed.items);
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: expected for unreachable feeds
      console.warn(`Feed unreachable during import: ${url}`, err);
    }
  }
  importFileInput.value = "";
  await loadAndRender();
});
let renderId = 0;
loadAndRender();
async function loadAndRender(): Promise<void> {
  [feeds, items] = await Promise.all([getFeeds(), getItems()]);
  if (!initialized) {
    for (const f of feeds) selectedFeedIds.add(f.id);
    const interval = await getRefreshInterval();
    intervalLabel.textContent = interval === 0 ? "Off" : `${interval}m`;
    const activeBtn = intervalDropdown.querySelector(`[data-interval="${interval}"]`);
    if (activeBtn) activeBtn.classList.add("active");
    initialized = true;
  }
  render();
  document.body.dataset.renderId = String(++renderId);
}

// ── Render ──

function render(): void {
  renderFeeds();
  renderItems();
}

function renderFeeds(): void {
  feedList.innerHTML = "";

  const searchTerm = feedSearch.value.toLowerCase();
  const allUnread = items.filter((i) => !i.isRead).length;
  const allSelected = feeds.length > 0 && selectedFeedIds.size === feeds.length;

  // "All" chip
  feedList.appendChild(createChip("All", null, allUnread, allSelected));

  for (const feed of feeds) {
    const isActive = selectedFeedIds.has(feed.id);
    // Active chips always visible; inactive chips match search
    if (!isActive && searchTerm && !feed.title.toLowerCase().includes(searchTerm)) continue;
    const unread = items.filter((i) => i.feedId === feed.id && !i.isRead).length;
    feedList.appendChild(createChip(feed.title, feed.id, unread, isActive));
  }
}
function createChip(
  label: string,
  feedId: string | null,
  unread: number,
  selected: boolean,
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "feed-chip";
  if (selected) chip.classList.add("selected");

  const labelSpan = document.createElement("span");
  labelSpan.className = "chip-label";
  labelSpan.textContent = label;
  chip.appendChild(labelSpan);

  if (unread > 0) {
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(unread);
    chip.appendChild(count);
  }

  chip.addEventListener("click", () => {
    if (feedId === null) {
      // "All" — toggle all/none
      if (selectedFeedIds.size === feeds.length) {
        selectedFeedIds.clear();
      } else {
        for (const f of feeds) selectedFeedIds.add(f.id);
      }
    } else {
      // Toggle individual feed
      if (selectedFeedIds.has(feedId)) {
        selectedFeedIds.delete(feedId);
      } else {
        selectedFeedIds.add(feedId);
      }
    }
    render();
  });

  if (feedId !== null) {
    // Edit button
    const editBtn = document.createElement("span");
    editBtn.className = "edit-btn";
    editBtn.textContent = "\u270e";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startEditing(chip, labelSpan, feedId);
    });
    chip.appendChild(editBtn);

    // Remove button
    const removeBtn = document.createElement("span");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await removeFeed(feedId);
      selectedFeedIds.delete(feedId);
      await loadAndRender();
    });
    chip.appendChild(removeBtn);
  }

  return chip;
}

function startEditing(_chip: HTMLElement, labelSpan: HTMLElement, feedId: string): void {
  const input = document.createElement("input");
  input.type = "text";
  input.value = labelSpan.textContent ?? "";
  input.className = "chip-edit-input";

  labelSpan.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = async (save: boolean) => {
    if (finished) return;
    finished = true;
    const newTitle = save ? input.value.trim() : null;
    input.replaceWith(labelSpan);
    if (save && newTitle && newTitle !== labelSpan.textContent) {
      await updateFeed(feedId, newTitle);
      labelSpan.textContent = newTitle;
      await loadAndRender();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });

  input.addEventListener("blur", () => finish(true));
}

function renderItems(): void {
  itemsList.innerHTML = "";

  // Search empty → show all; search has input → filter by selected feeds
  const feedItems =
    feedSearch.value.trim() === "" ? items : items.filter((i) => selectedFeedIds.has(i.feedId));

  const unread = feedItems.filter((i) => !i.isRead);
  const read = feedItems.filter((i) => i.isRead);

  // Show/hide the toggle label
  if (read.length > 0) {
    showReadLabel.classList.remove("hidden");
  } else {
    showReadLabel.classList.add("hidden");
    showReadCheckbox.checked = false;
    showRead = false;
  }

  const sortedUnread = [...unread].sort((a, b) => b.pubDate - a.pubDate);
  for (const item of sortedUnread) {
    itemsList.appendChild(createItemRow(item));
  }

  if (showRead) {
    const sortedRead = [...read].sort((a, b) => b.pubDate - a.pubDate);
    for (const item of sortedRead) {
      itemsList.appendChild(createItemRow(item));
    }
  }

  if (sortedUnread.length === 0 && (!showRead || read.length === 0)) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }
}

function createItemRow(item: FeedItem): HTMLElement {
  const feed = feeds.find((f) => f.id === item.feedId);
  const feedLabel = feed?.title ?? "Unknown feed";

  const row = document.createElement("div");
  row.className = `item${item.isRead ? " read" : ""}`;

  const dotClass = item.isRead ? "read" : "unread";

  row.innerHTML = `
    <div class="item-content">
      <div class="item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
      <div class="item-meta">
        <span class="feed-label">${escapeHtml(feedLabel)}</span>
        ${item.pubDate ? `&middot; ${formatDate(item.pubDate)}` : ""}
      </div>
    </div>
    <span class="status-dot ${dotClass}" title="${item.isRead ? "Mark unread" : "Mark read"}"></span>
  `;

  // Click dot → toggle read/unread
  const dot = row.querySelector(".status-dot")!;
  dot.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (item.isRead) {
      await markUnread(item.id);
    } else {
      await markRead(item.id);
    }
    await loadAndRender();
  });

  // Click row → open link + mark read
  row.addEventListener("click", async () => {
    if (item.link) {
      await chrome.tabs.create({ url: item.link });
    }
    if (!item.isRead) {
      await markRead(item.id);
      await loadAndRender();
    }
  });

  return row;
}

// ── Actions ──

async function handleAddFeed(e: Event): Promise<void> {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  urlInput.value = "";
  loadingState.classList.remove("hidden");
  itemsList.innerHTML = "";
  emptyState.classList.add("hidden");

  try {
    const parsed = await fetchFeed(url);

    const feed: Feed = {
      id: crypto.randomUUID(),
      url,
      title: parsed.title,
      link: parsed.link,
      addedAt: Date.now(),
    };

    await addFeed(feed);
    await upsertItems(feed.id, parsed.items);
    selectedFeedIds.add(feed.id);
    await loadAndRender();
  } catch (err) {
    alert(`Failed to add feed: ${err instanceof Error ? err.message : "Unknown error"}`);
  } finally {
    loadingState.classList.add("hidden");
  }
}

async function handleRefresh(): Promise<void> {
  refreshBtn.classList.add("spinning");
  try {
    // Tell the background worker to refresh (which also updates the badge)
    await chrome.runtime.sendMessage({ type: "REFRESH" });
    await loadAndRender();
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

// ── Helpers ──

function formatDate(ms: number): string {
  if (!ms) return "";
  const now = Date.now();
  const diff = now - ms;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;

  return new Date(ms).toLocaleDateString();
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
