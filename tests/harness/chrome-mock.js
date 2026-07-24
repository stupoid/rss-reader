// Minimal chrome.* API mock for testing the popup in isolation.
// Injected before the popup script loads so all chrome.* calls are intercepted.

const store = {};

window.chrome = {
  storage: {
    local: {
      async get(keys) {
        if (keys === null) return { ...store };
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const k of keyList) {
          if (k in store) result[k] = store[k];
        }
        return result;
      },
      async set(items) {
        Object.assign(store, items);
        if ('refreshInterval' in items) window.__storedInterval = items.refreshInterval;
      },
      async clear() {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  },
  tabs: {
    async create(opts) {
      window.__openedTabs = window.__openedTabs || [];
      window.__openedTabs.push(opts.url);
    },
  },
  runtime: {
    async sendMessage(msg) {
      window.__sentMessages = window.__sentMessages || [];
      window.__sentMessages.push(msg);
      return { ok: true };
    },
  },
  action: {
    async setBadgeText(_opts) {},
    async setBadgeBackgroundColor(_opts) {},
  },
};
