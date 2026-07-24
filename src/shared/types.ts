// ── Storage types (persisted to chrome.storage.local) ──

export interface Feed {
  id: string; // uuid
  url: string; // feed URL
  title: string; // from <title> in the feed
  link: string; // from <link> in the feed (site URL)
  addedAt: number; // Date.now()
}

export interface FeedItem {
  id: string; // <guid>/<id> from feed, or hash of link+title
  feedId: string; // parent feed
  title: string;
  link: string; // link to the article
  pubDate: number; // parsed date, epoch ms (0 if unparseable)
  isRead: boolean;
}

// ── Parser types (intermediate representation from parser) ──

export interface ParsedItem {
  id: string;
  title: string;
  link: string;
  pubDate: number;
}

export interface ParsedFeed {
  title: string;
  link: string;
  items: ParsedItem[];
}

// ── Storage key constants ──

export const STORAGE_KEY_FEEDS = "feeds";
export const STORAGE_KEY_INTERVAL = "refreshInterval";
export const DEFAULT_INTERVAL = 15; // minutes
export const STORAGE_KEY_ITEMS = "items";
