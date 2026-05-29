import { readCache, writeCache, TRANSLATE_CACHE } from "./storage.js";

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
      en: String(entry[0] || ""),
      cn: String(entry[1] || ""),
      cat: fallbackCat,
      steps: [],
      keywords: []
    };
  }

  return {
    en: String(entry?.en || ""),
    cn: String(entry?.cn || ""),
    cat: String(entry?.cat || fallbackCat || ""),
    steps: Array.isArray(entry?.steps) ? entry.steps.map(String).filter(Boolean) : [],
    keywords: Array.isArray(entry?.keywords)
      ? entry.keywords
          .map(item => ({ word: String(item?.word || ""), cn: String(item?.cn || "") }))
          .filter(item => item.word || item.cn)
      : []
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
      if (!items.some(existing => normalizeText(existing.en) === normalizeText(normalized.en))) {
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
    const cnMatches = cn && (normalized === cn || (allowLooseMatch && (cn.includes(normalized) || normalized.includes(cn))));
    const enMatches = en && (normalized === en || (allowLooseMatch && (en.includes(normalized) || normalized.includes(en))));
    if (cnMatches || enMatches) return item;
  }

  return null;
}

export function findTemplateTranslation(text, phrasebook, templateGroups = []) {
  return matchPhrasebook(text, phrasebook, templateGroups)?.en || "";
}

export function buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning }) {
  const match = matchPhrasebook(raw, phrasebook, templateGroups) || matchPhrasebook(sentence, phrasebook, templateGroups);
  if (match) {
    return {
      sentenceMeaning: match.cn,
      taskSteps: match.steps,
      keywords: match.keywords,
      source: "phrasebook"
    };
  }

  return {
    sentenceMeaning: fallbackMeaning || "",
    taskSteps: [],
    keywords: [],
    source: fallbackMeaning ? "translation" : "none"
  };
}

export function createTranslationService({ dictService, phrasebook, templateGroups, enqueueNetwork }) {
  async function translateText(text, from, to) {
    const value = String(text || "").trim();
    if (!value) return "";

    const key = `${from}:${to}:${value}`;
    const cache = readCache(TRANSLATE_CACHE);
    if (cache[key]?.text) return cache[key].text;

    if ("Translator" in window && typeof window.Translator?.create === "function") {
      try {
        const translator = await window.Translator.create({ sourceLanguage: from, targetLanguage: to });
        const translated = String(await translator.translate(value)).trim();
        if (translated) {
          cache[key] = { text: translated, cachedAt: Date.now(), source: "browser" };
          writeCache(TRANSLATE_CACHE, cache);
          return translated;
        }
      } catch (e) {}
    }

    const url = "https://translate.googleapis.com/translate_a/single?client=gtx"
      + "&dt=t"
      + "&sl=" + encodeURIComponent(from)
      + "&tl=" + encodeURIComponent(to)
      + "&q=" + encodeURIComponent(value);
    const res = await enqueueNetwork(() => fetch(url));
    if (!res.ok) throw new Error("Translate request failed");
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map(part => part?.[0] || "").join("").trim()
      : "";
    if (!translated) throw new Error("Translate response was empty");

    cache[key] = { text: translated, cachedAt: Date.now(), source: "online-fallback" };
    writeCache(TRANSLATE_CACHE, cache);
    return translated;
  }

  async function resolveChineseInput(raw) {
    const localTemplate = findTemplateTranslation(raw, phrasebook, templateGroups);
    if (localTemplate) {
      return {
        sentence: localTemplate,
        source: "template",
        explanation: buildSentenceExplanation({ raw, sentence: localTemplate, phrasebook, templateGroups, fallbackMeaning: raw })
      };
    }

    const localWords = dictService.reverseLookupChineseWords(raw);
    try {
      const sentence = await translateText(raw, "zh-CN", "en");
      return {
        sentence,
        source: "online",
        explanation: buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning: raw })
      };
    } catch (e) {
      if (localWords) {
        return {
          sentence: localWords,
          source: "local-words",
          explanation: buildSentenceExplanation({ raw, sentence: localWords, phrasebook, templateGroups, fallbackMeaning: raw })
        };
      }
      throw e;
    }
  }

  async function explainEnglishSentence(raw, sentence) {
    const local = buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning: "" });
    if (local.source === "phrasebook") return local;

    try {
      const fallbackMeaning = await translateText(sentence, "en", "zh-CN");
      return buildSentenceExplanation({ raw, sentence, phrasebook, templateGroups, fallbackMeaning });
    } catch (e) {
      return local;
    }
  }

  return {
    translateText,
    resolveChineseInput,
    explainEnglishSentence,
    findTemplateTranslation: text => findTemplateTranslation(text, phrasebook, templateGroups),
    matchPhrasebook: text => matchPhrasebook(text, phrasebook, templateGroups)
  };
}
