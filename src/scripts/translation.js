import { readCache, writeCache, TRANSLATE_CACHE } from "./storage.js";
import { fetchWithPolicy } from "./network.js";

export const CHINESE_RE = /[\u3400-\u9fff]/;

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

export function flattenPhrasebook(phrasebook, templateGroups = []) {
  const items = [];

  for (const entry of phrasebook || []) {
    const normalized = normalizePhrasebookEntry(entry);
    if (normalized.en || normalized.cn) items.push(normalized);
  }

  for (const group of templateGroups || []) {
    for (const item of group.items || []) {
      const normalized = normalizePhrasebookEntry(item, group.cat);
      if (
        !items.some(
          (existing) =>
            normalizeText(existing.en) === normalizeText(normalized.en),
        )
      ) {
        items.push(normalized);
      }
    }
  }

  return items;
}

export function matchPhrasebook(text, phrasebook, templateGroups = []) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const allowLooseMatch = normalized.length >= 4;

  for (const item of flattenPhrasebook(phrasebook, templateGroups)) {
    const cn = normalizeText(item.cn);
    const en = normalizeText(item.en);
    const cnMatches =
      cn &&
      (normalized === cn ||
        (allowLooseMatch &&
          (cn.includes(normalized) || normalized.includes(cn))));
    const enMatches =
      en &&
      (normalized === en ||
        (allowLooseMatch &&
          (en.includes(normalized) || normalized.includes(en))));
    if (cnMatches || enMatches) return item;
  }

  return null;
}

export function findTemplateTranslation(text, phrasebook, templateGroups = []) {
  return matchPhrasebook(text, phrasebook, templateGroups)?.en || "";
}

export function createTranslationService({
  dictService,
  phrasebook,
  templateGroups,
  enqueueNetwork,
}) {
  async function translateText(text, from, to) {
    const value = String(text || "").trim();
    if (!value) return "";

    const key = `${from}:${to}:${value}`;
    const cache = readCache(TRANSLATE_CACHE);
    if (cache[key]?.text) return cache[key].text;

    if (
      "Translator" in window &&
      typeof window.Translator?.create === "function"
    ) {
      try {
        const translator = await window.Translator.create({
          sourceLanguage: from,
          targetLanguage: to,
        });
        const translated = String(await translator.translate(value)).trim();
        if (translated) {
          cache[key] = {
            text: translated,
            cachedAt: Date.now(),
            source: "browser",
          };
          writeCache(TRANSLATE_CACHE, cache);
          return translated;
        }
      } catch (e) {}
    }

    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx" +
      "&dt=t" +
      "&sl=" +
      encodeURIComponent(from) +
      "&tl=" +
      encodeURIComponent(to) +
      "&q=" +
      encodeURIComponent(value);
    const res = await enqueueNetwork(() =>
      fetchWithPolicy(url, {}, { timeoutMs: 10000, retries: 1 }),
    );
    if (!res.ok) throw new Error("Translate request failed");
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0]
          .map((part) => part?.[0] || "")
          .join("")
          .trim()
      : "";
    if (!translated) throw new Error("Translate response was empty");

    cache[key] = {
      text: translated,
      cachedAt: Date.now(),
      source: "online-fallback",
    };
    writeCache(TRANSLATE_CACHE, cache);
    return translated;
  }

  async function resolveChineseInput(raw) {
    const localTemplate = findTemplateTranslation(
      raw,
      phrasebook,
      templateGroups,
    );
    if (localTemplate) {
      return {
        sentence: localTemplate,
        source: "template",
      };
    }

    const localWords = dictService.reverseLookupChineseWords(raw);
    try {
      const sentence = await translateText(raw, "zh-CN", "en");
      return {
        sentence,
        source: "online",
      };
    } catch (e) {
      if (localWords) {
        return {
          sentence: localWords,
          source: "local-words",
        };
      }
      throw e;
    }
  }

  return {
    translateText,
    resolveChineseInput,
    findTemplateTranslation: (text) =>
      findTemplateTranslation(text, phrasebook, templateGroups),
    matchPhrasebook: (text) =>
      matchPhrasebook(text, phrasebook, templateGroups),
  };
}
