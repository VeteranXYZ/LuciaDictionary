import {
  readCache,
  writeCache,
  isNetworkAllowed,
  TRANSLATE_CACHE,
} from "./storage.js";
import { fetchWithPolicy } from "./network.js";

export const CHINESE_RE = /[\u3400-\u9fff]/;
export const TRANSLATE_ENDPOINT = "/api/translate";
export const OFFLINE_ONLY_ERROR = "offline_only";

export function createOfflineOnlyError() {
  const error = new Error("Offline-only mode blocks network translation");
  error.code = OFFLINE_ONLY_ERROR;
  return error;
}

export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’()（）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizePhrasebookEntry(entry, fallbackCat = "") {
  if (Array.isArray(entry)) {
    return {
      id: "",
      en: String(entry[0] || ""),
      cn: String(entry[1] || ""),
      cat: fallbackCat,
      scene: "",
      speaker: "",
      intent: "",
      steps: [],
      stepsZh: [],
      keywords: [],
      childReply: [],
      difficulty: "easy",
    };
  }

  return {
    id: String(entry?.id || ""),
    en: String(entry?.en || ""),
    cn: String(entry?.cn || ""),
    cat: String(entry?.cat || fallbackCat || ""),
    scene: String(entry?.scene || ""),
    speaker: String(entry?.speaker || ""),
    intent: String(entry?.intent || ""),
    steps: Array.isArray(entry?.steps)
      ? entry.steps.map(String).filter(Boolean)
      : [],
    stepsZh: Array.isArray(entry?.stepsZh)
      ? entry.stepsZh.map(String).filter(Boolean)
      : [],
    keywords: Array.isArray(entry?.keywords)
      ? entry.keywords
          .map((item) => ({
            word: String(item?.word || ""),
            cn: String(item?.cn || ""),
          }))
          .filter((item) => item.word || item.cn)
      : [],
    childReply: Array.isArray(entry?.childReply)
      ? entry.childReply
          .map((item) => ({
            en: String(item?.en || ""),
            cn: String(item?.cn || ""),
          }))
          .filter((item) => item.en || item.cn)
      : [],
    difficulty: entry?.difficulty === "medium" ? "medium" : "easy",
  };
}

export function flattenPhrasebook(phrasebook) {
  return (phrasebook || [])
    .map((entry) => normalizePhrasebookEntry(entry))
    .filter((entry) => entry.en || entry.cn);
}

// A template may only stand in for the user's own sentence when it covers
// almost all of it. Substring matching alone silently replaced a long
// classroom sentence with a short template and dropped the rest of the input.
export const PHRASEBOOK_MIN_COVERAGE = 0.8;

export function phraseMatchCoverage(query, candidate) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  const [short, long] =
    query.length <= candidate.length ? [query, candidate] : [candidate, query];
  if (!long.includes(short)) return 0;
  return short.length / long.length;
}

export function findPhrasebookMatch(text, phrasebook, options = {}) {
  const minCoverage = options.minCoverage ?? PHRASEBOOK_MIN_COVERAGE;
  const normalized = normalizeText(text);
  if (!normalized) return null;

  let best = null;
  for (const item of flattenPhrasebook(phrasebook)) {
    for (const field of ["cn", "en"]) {
      const coverage = phraseMatchCoverage(
        normalized,
        normalizeText(item[field]),
      );
      if (coverage < minCoverage) continue;
      if (!best || coverage > best.coverage) {
        best = { entry: item, coverage, field };
      }
    }
  }
  return best;
}

export function matchPhrasebook(text, phrasebook, options = {}) {
  return findPhrasebookMatch(text, phrasebook, options)?.entry || null;
}

export function findTemplateTranslation(text, phrasebook) {
  return matchPhrasebook(text, phrasebook)?.en || "";
}

export const ON_DEVICE_TRANSLATE_TIMEOUT_MS = 4000;

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs),
    ),
  ]);
}

// Chrome's built-in Translator can sit forever downloading a model the first
// time it is asked. Without a bound, that hung the whole analysis with no
// fallback and no error, so treat a slow answer as "not available".
export async function translateOnDevice(
  value,
  from,
  to,
  {
    timeoutMs = ON_DEVICE_TRANSLATE_TIMEOUT_MS,
    api = globalThis.Translator,
  } = {},
) {
  if (typeof api?.create !== "function") return "";
  try {
    return await withTimeout(
      (async () => {
        if (typeof api.availability === "function") {
          const availability = await api.availability({
            sourceLanguage: from,
            targetLanguage: to,
          });
          // "downloadable" means a multi-megabyte fetch the child is not
          // waiting for; let the server answer this one.
          if (availability !== "available") return "";
        }
        const translator = await api.create({
          sourceLanguage: from,
          targetLanguage: to,
        });
        return String(await translator.translate(value)).trim();
      })(),
      timeoutMs,
    );
  } catch {
    return "";
  }
}

export function createTranslationService({
  dictService,
  phrasebook,
  enqueueNetwork,
}) {
  async function translateText(text, from, to) {
    const value = String(text || "").trim();
    if (!value) return "";

    const key = `${from}:${to}:${value}`;
    const cache = readCache(TRANSLATE_CACHE);
    if (cache[key]?.text) return cache[key].text;

    const onDevice = await translateOnDevice(value, from, to);
    if (onDevice) {
      cache[key] = { text: onDevice, cachedAt: Date.now(), source: "browser" };
      writeCache(TRANSLATE_CACHE, cache);
      return onDevice;
    }

    if (!isNetworkAllowed()) throw createOfflineOnlyError();

    // Same-origin only: the sentence never goes to a third party from the
    // child's browser, and the upstream provider stays a server-side detail.
    const res = await enqueueNetwork(() =>
      fetchWithPolicy(
        TRANSLATE_ENDPOINT,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: value, from, to }),
        },
        { timeoutMs: 12000, retries: 0 },
      ),
    );
    if (!res.ok) throw new Error("Translate request failed");
    const data = await res.json();
    const translated = String(data?.text || "").trim();
    if (!translated) throw new Error("Translate response was empty");

    cache[key] = {
      text: translated,
      cachedAt: Date.now(),
      source: data?.provider ? `server:${data.provider}` : "server",
    };
    writeCache(TRANSLATE_CACHE, cache);
    return translated;
  }

  async function resolveChineseInput(raw) {
    const template = findPhrasebookMatch(raw, phrasebook);
    if (template?.entry.en) {
      return {
        sentence: template.entry.en,
        source: "template",
        coverage: template.coverage,
      };
    }

    try {
      return {
        sentence: await translateText(raw, "zh-CN", "en"),
        source: "online",
        coverage: 1,
      };
    } catch (e) {
      // Only worth the full-dictionary reverse scan once translation failed.
      const localWords = dictService.reverseLookupChineseWords(raw);
      if (localWords) {
        return { sentence: localWords, source: "local-words", coverage: 0 };
      }
      throw e;
    }
  }

  return {
    translateText,
    resolveChineseInput,
    findTemplateTranslation: (text) =>
      findTemplateTranslation(text, phrasebook),
    matchPhrasebook: (text) => matchPhrasebook(text, phrasebook),
  };
}
