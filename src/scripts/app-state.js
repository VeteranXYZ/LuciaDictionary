import {
  DEFAULT_SETTINGS,
  WORDBOOK_KEY,
  getSetting,
  subscribeStorage,
} from "./storage.js";
import { getReviewSummary, getWordbook } from "./wordbook.js";

const SETTING_KEYS = new Set(
  Object.keys(DEFAULT_SETTINGS).map((key) => `lucia-${key}`),
);

export function getAppState() {
  const wordbook = getWordbook();
  return {
    wordbook,
    wordbookSummary: getReviewSummary(wordbook),
    settings: Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((key) => [key, getSetting(key)]),
    ),
  };
}

function scopeForStorageKey(key) {
  if (key === WORDBOOK_KEY) return "wordbook";
  if (SETTING_KEYS.has(key)) return "settings";
  return "other";
}

export function subscribeAppState(subscriber, options = {}) {
  if (options.immediate !== false) {
    subscriber(getAppState(), { scope: "all", key: "" });
  }
  return subscribeStorage(({ key }) => {
    const scope = scopeForStorageKey(key);
    if (scope === "other") return;
    subscriber(getAppState(), { scope, key });
  });
}
