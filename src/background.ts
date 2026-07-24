import { fetchFeed } from "./shared/fetcher.js";
import { getFeeds, getRefreshInterval, getUnreadCount, upsertItems } from "./shared/storage.js";

const ALARM_NAME = "refresh-feeds";
let refreshing = false;
// ── Alarm lifecycle ──

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleAlarm();
  await refreshAllFeeds();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshAllFeeds();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await scheduleAlarm();
    await refreshAllFeeds();
  }
});

// ── Message handling ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REFRESH") {
    refreshAllFeeds().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "SET_INTERVAL") {
    scheduleAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Alarm scheduling ──

async function scheduleAlarm(): Promise<void> {
  await chrome.alarms.clear(ALARM_NAME);
  const interval = await getRefreshInterval();
  if (interval > 0) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: interval });
  }
}

// ── Core refresh ──

async function refreshAllFeeds(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const feeds = await getFeeds();
    for (const feed of feeds) {
      try {
        const parsed = await fetchFeed(feed.url);
        await upsertItems(feed.id, parsed.items);
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: service worker error logging
        console.warn(`Failed to refresh feed "${feed.title}":`, err);
      }
    }
    await updateBadge();
  } finally {
    refreshing = false;
  }
}

async function updateBadge(): Promise<void> {
  const count = await getUnreadCount();
  if (count > 0) {
    await chrome.action.setBadgeText({ text: count > 999 ? "999+" : String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: "#F97C00" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}
