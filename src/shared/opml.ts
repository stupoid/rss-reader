import type { Feed } from "./types";

/**
 * Serialize feeds to an OPML 2.0 document string.
 */
export function exportOpml(feeds: Feed[]): string {
  const outlines = feeds
    .map(
      (f) =>
        `    <outline text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" type="rss" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.link)}"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Reader Feeds</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * Parse an OPML document and extract feed URLs + titles from <outline> elements.
 * Only extracts outlines with type="rss" and a valid xmlUrl.
 */
export function importOpml(xmlText: string): { title: string; url: string }[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const error = doc.querySelector("parsererror");
  if (error) throw new Error(`OPML parse error: ${error.textContent}`);

  const feeds: { title: string; url: string }[] = [];
  for (const el of doc.querySelectorAll("outline")) {
    const xmlUrl = (el.getAttribute("xmlUrl") || el.getAttribute("xmlurl"))?.trim();
    if (!xmlUrl) continue;
    const title = el.getAttribute("title") || el.getAttribute("text") || xmlUrl;
    feeds.push({ title: title.trim(), url: xmlUrl });
  }

  return feeds;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
