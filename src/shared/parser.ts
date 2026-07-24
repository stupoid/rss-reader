import type { ParsedFeed, ParsedItem } from "./types.js";

/**
 * Parse an RSS 2.0 or Atom feed document into a shared intermediate representation.
 * Throws if the document is not a recognized feed format.
 */
export function parseFeed(xmlText: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const error = doc.querySelector("parsererror");
  if (error) throw new Error(`XML parse error: ${error.textContent}`);

  const root = doc.documentElement;
  const rootName = root.tagName.toLowerCase();

  if (rootName === "rss") return parseRSS(root);
  if (rootName === "feed") return parseAtom(root);

  throw new Error(`Unrecognized feed root element: <${root.tagName}>`);
}

// ── RSS 2.0 ──

function parseRSS(root: Element): ParsedFeed {
  const channel = root.querySelector("channel");
  if (!channel) throw new Error("RSS feed missing <channel>");

  // In RSS, <title> and <link> are required children of <channel>
  const title = textOf(channel, "title") || "Untitled Feed";
  const link = textOf(channel, "link") || "";

  const items: ParsedItem[] = [];
  for (const el of channel.querySelectorAll(":scope > item")) {
    const id = itemId(el);
    if (!id) continue; // skip items we can't deduplicate

    items.push({
      id,
      title: textOf(el, "title") || "Untitled",
      link: textOf(el, "link") || "",
      pubDate: parseDate(textOf(el, "pubDate")),
    });
  }

  return { title, link: link.trim(), items };
}

// ── Atom ──

function parseAtom(root: Element): ParsedFeed {
  const title = textOf(root, "title") || "Untitled Feed";

  // Atom <link> is <link rel="alternate" href="..."/> — grab the first alternate, or first link
  const linkEl =
    root.querySelector('link[rel="alternate"][href]') || root.querySelector("link[href]");
  const link = linkEl?.getAttribute("href") || "";

  const items: ParsedItem[] = [];
  for (const el of root.querySelectorAll(":scope > entry")) {
    const id = itemId(el);
    if (!id) continue;

    // Atom <link> in entry
    const entryLinkEl =
      el.querySelector('link[rel="alternate"][href]') || el.querySelector("link[href]");
    const entryLink = entryLinkEl?.getAttribute("href") || "";

    items.push({
      id,
      title: textOf(el, "title") || "Untitled",
      link: entryLink,
      pubDate: parseDate(textOf(el, "updated") || textOf(el, "published")),
    });
  }

  return { title, link: link.trim(), items };
}

// ── Helpers ──

/** Get the text content of the first child element with the given tag name. */
function textOf(parent: Element, tagName: string): string | null {
  const el = parent.querySelector(`:scope > ${tagName}`);
  if (!el) return null;
  return el.textContent?.trim() ?? null;
}

/**
 * Build a stable item ID. Uses <guid> (RSS) or <id> (Atom).
 * Falls back to a simple hash of link+title if neither is present.
 */
function itemId(el: Element): string | null {
  const guid = textOf(el, "guid") || textOf(el, "id");
  if (guid) return guid;

  const title = textOf(el, "title");
  const link = textOf(el, "link");
  // Atom: link may be an element with href attribute
  const atomLink = el.querySelector("link[href]")?.getAttribute("href");
  const effectiveLink = link || atomLink;

  if (!title && !effectiveLink) return null;

  // Simple hash: not cryptographic, just stable dedup
  const src = `${title ?? ""}|${effectiveLink ?? ""}`;
  return hashString(src);
}

/**
 * Parse a feed date string (RFC 822 for RSS, RFC 3339 for Atom).
 * Returns epoch milliseconds, or 0 on failure.
 */
function parseDate(raw: string | null): number {
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Simple FNV-1a-like hash for stable ID generation. */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `h${(h >>> 0).toString(36)}`;
}
