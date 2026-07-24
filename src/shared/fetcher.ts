import { parseFeed } from "./parser.js";
import type { ParsedFeed } from "./types.js";

/**
 * Fetch and parse a feed from a URL.
 * Throws on network error, non-2xx response, or parse failure.
 */
export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });

    if (!response.ok) {
      throw new Error(`Feed fetch failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return parseFeed(text);
  } finally {
    clearTimeout(timer);
  }
}
