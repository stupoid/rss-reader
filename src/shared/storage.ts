import type { Feed, FeedItem, ParsedItem } from "./types.js";
import {
  DEFAULT_INTERVAL,
  STORAGE_KEY_FEEDS,
  STORAGE_KEY_INTERVAL,
  STORAGE_KEY_ITEMS,
} from "./types.js";

// ── Feeds ──

export async function getFeeds(): Promise<Feed[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_FEEDS);
  return (result[STORAGE_KEY_FEEDS] as Feed[] | undefined) ?? [];
}

export async function addFeed(feed: Feed): Promise<void> {
  const feeds = await getFeeds();
  feeds.push(feed);
  await chrome.storage.local.set({ [STORAGE_KEY_FEEDS]: feeds });
}

export async function updateFeed(id: string, title: string): Promise<void> {
  const feeds = await getFeeds();
  const idx = feeds.findIndex((f) => f.id === id);
  if (idx === -1) return;
  feeds[idx] = { ...feeds[idx], title };
  await chrome.storage.local.set({ [STORAGE_KEY_FEEDS]: feeds });
}

export async function removeFeed(id: string): Promise<void> {
  const feeds = await getFeeds();
  const filtered = feeds.filter((f) => f.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY_FEEDS]: filtered });

  // Also remove orphaned items
  const items = await getItems();
  const kept = items.filter((i) => i.feedId !== id);
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: kept });
}

// ── Items ──

export async function getItems(): Promise<FeedItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ITEMS);
  return (result[STORAGE_KEY_ITEMS] as FeedItem[] | undefined) ?? [];
}

/**
 * Merge freshly parsed items into storage.
 * - New items (by id) are appended as unread.
 * - Existing items keep their `isRead` state.
 * - Items no longer in the feed are dropped.
 * Returns the updated items for this feed.
 */
export async function upsertItems(feedId: string, incoming: ParsedItem[]): Promise<FeedItem[]> {
  const allItems = await getItems();
  const otherItems = allItems.filter((i) => i.feedId !== feedId);

  const existingByFeed = new Map<string, FeedItem>();
  for (const item of allItems) {
    if (item.feedId === feedId) existingByFeed.set(item.id, item);
  }

  const merged: FeedItem[] = incoming.map((parsed) => {
    const existing = existingByFeed.get(parsed.id);
    return {
      id: parsed.id,
      feedId,
      title: parsed.title,
      link: parsed.link,
      pubDate: parsed.pubDate,
      isRead: existing ? existing.isRead : false,
    };
  });

  const updated = [...otherItems, ...merged];
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: updated });
  return merged;
}

export async function markRead(itemId: string): Promise<void> {
  const items = await getItems();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  items[idx] = { ...items[idx], isRead: true };
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: items });
}

export async function markUnread(itemId: string): Promise<void> {
  const items = await getItems();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  items[idx] = { ...items[idx], isRead: false };
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: items });
}

export async function getUnreadCount(): Promise<number> {
  const items = await getItems();
  return items.filter((i) => !i.isRead).length;
}

// ── Refresh interval ──

export async function getRefreshInterval(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEY_INTERVAL);
  const value = result[STORAGE_KEY_INTERVAL];
  return typeof value === "number" ? value : DEFAULT_INTERVAL;
}

export async function setRefreshInterval(minutes: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_INTERVAL]: minutes });
}
