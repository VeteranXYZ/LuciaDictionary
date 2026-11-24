import { contractions } from "../data/contractions.js";
import { cleanDisplayTranslation } from "./meaningCleaner.js";
import {
  isNetworkAllowed,
  getNetworkSignal,
  assertNetworkAllowed,
} from "./storage.js";
import { fetchJsonWithPolicy } from "./network.js";
import { cleanPhonetic } from "./phonetic.js";
import { siteOwner } from "../config/site.js";

export const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
  "from",
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
]);

export const POS_CN = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
};

export const IRREGULAR_BASES = {
  went: "go",
  gone: "go",
  did: "do",
  done: "do",
  children: "child",
  mice: "mouse",
  better: "good",
  best: "good",
  ran: "run",
  running: "run",
  bought: "buy",
  brought: "bring",
  thought: "think",
  studied: "study",
  studying: "study",
  made: "make",
  took: "take",
  taken: "take",
  wrote: "write",
  written: "write",
  saw: "see",
  seen: "see",
};

export const OCR_NOISE_FRAGMENTS = new Set([
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "re",
  "ve",
  "ll",
]);

export const RESERVED_PROJECT_NAMES = {
  lucia: { cn: "Lucia，角色名", ph: "", pos: "name" },
  rayna: { cn: "Rayna，角色名", ph: "", pos: "name" },
  luciaandrayna: { cn: `${siteOwner}，品牌名`, ph: "", pos: "name" },
  "lucia&rayna": { cn: `${siteOwner}，品牌名`, ph: "", pos: "name" },
};

export function getMeaningValue(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry)) return entry[0] || null;
  return entry.cn || entry.meaning || null;
}

export function cleanMeaningForDisplay(meaning, word = "") {
  return cleanDisplayTranslation(meaning, word);
}

export function getPhoneticValue(entry) {
  if (!entry || typeof entry === "string") return "";
  if (Array.isArray(entry)) return cleanPhonetic(entry[1] || "");
  return cleanPhonetic(
    entry.ph || entry.phonetic || entry.us || entry.uk || "",
  );
}

export function getEntryForms(entry) {
  if (Array.isArray(entry)) return Array.isArray(entry[3]) ? entry[3] : [];
  return Array.isArray(entry?.forms) ? entry.forms : [];
}

export function getLearningBand(entry) {
  if (Array.isArray(entry)) return entry[4] || "";
  return entry?.level || "";
}

export function normalizeLookupTerm(term) {
  return String(term || "")
    .toLowerCase()
    .replace(/[“”‘’"'.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReservedNameTerm(term) {
  return String(term || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z&]/g, "");
}

export function getReservedProjectName(term) {
  return RESERVED_PROJECT_NAMES[normalizeReservedNameTerm(term)] || null;
}

export function getPhraseMeaning(phraseLexicon, term) {
  const key = normalizeLookupTerm(term);
  if (!key || !key.includes(" ")) return null;
  return phraseLexicon?.[key]?.cn || null;
}

export function addCoreFormsToIndex(forms, base, entry) {
  for (const form of getEntryForms(entry)) {
    if (!form) continue;
    const key = String(form).toLowerCase();
    // The lookup side always reads lowercase keys, so the guard has to test the
    // same key it writes.
    if (!forms[key]) forms[key] = base;
  }
  return forms;
}

export function buildCoreFormIndex(coreLexicon = {}) {
  const forms = {};
  for (const [base, entry] of Object.entries(coreLexicon || {})) {
    addCoreFormsToIndex(forms, base, entry);
  }
  return forms;
}

export function lookupCoreBase(coreLexicon, formIndex, word) {
  const w = normalizeLookupTerm(word);
  if (!w || w.includes(" ")) return null;
  if (getReservedProjectName(w))
    return { base: w, modifier: "", reserved: true };
  if (coreLexicon?.[w]) return { base: w, modifier: "" };
  const base = formIndex?.[w];
  if (base && coreLexicon?.[base]) return { base, modifier: "" };
  return null;
}

export function lookupBaseWord(dict, word) {
  const w = normalizeLookupTerm(word);
  if (!w) return null;
  if (dict[w]) return { base: w, modifier: "" };

  const irregularBase = IRREGULAR_BASES[w];
  if (irregularBase && dict[irregularBase]) {
    return {
      base: irregularBase,
      modifier: irregularModifier(w, irregularBase),
    };
  }

  const candidates = [];
  if (w.length > 2 && w.endsWith("ly"))
    candidates.push({ base: w.slice(0, -2), modifier: "地" });
  if (w.length > 3 && w.endsWith("ies"))
    candidates.push({ base: w.slice(0, -3) + "y", modifier: "" });
  if (w.length > 2 && w.endsWith("es"))
    candidates.push({ base: w.slice(0, -2), modifier: "" });
  if (w.length > 1 && w.endsWith("s"))
    candidates.push({ base: w.slice(0, -1), modifier: "" });
  if (w.length > 2 && w.endsWith("ed")) {
    candidates.push({ base: w.slice(0, -2), modifier: "(过去式)" });
    candidates.push({ base: w.slice(0, -1), modifier: "(过去式)" });
  }
  if (w.length > 2 && w.endsWith("er"))
    candidates.push({ base: w.slice(0, -2), modifier: "更" });
  if (w.length > 3 && w.endsWith("est"))
    candidates.push({ base: w.slice(0, -3), modifier: "最" });
  if (w.length > 3 && w.endsWith("ing")) {
    candidates.push({ base: w.slice(0, -3), modifier: "正在" });
    candidates.push({ base: w.slice(0, -3) + "e", modifier: "正在" });
  }

  return candidates.find((item) => dict[item.base]) || null;
}

export function lookup(dict, word) {
  const resolved = lookupBaseWord(dict, word);
  if (!resolved) return null;
  const meaning = getMeaningValue(dict[resolved.base]);
  if (!meaning) return null;
  if (!resolved.modifier) return meaning;
  if (resolved.modifier === "地") return meaning + resolved.modifier;
  if (
    resolved.modifier === "更" ||
    resolved.modifier === "最" ||
    resolved.modifier === "正在"
  ) {
    return resolved.modifier + meaning;
  }
  return meaning + resolved.modifier;
}

export function lookupLayered(
  { phraseLexicon = {}, coreLexicon = {}, formIndex = {}, dict = {} },
  term,
) {
  const contraction = contractions.get(
    String(term).toLowerCase().replaceAll("’", "'"),
  );
  if (contraction) return contraction;
  const reserved = getReservedProjectName(term);
  if (reserved) return reserved.cn;

  const phraseMeaning = getPhraseMeaning(phraseLexicon, term);
  if (phraseMeaning) return phraseMeaning;

  const coreResolved = lookupCoreBase(coreLexicon, formIndex, term);
  if (coreResolved) {
    if (coreResolved.reserved)
      return getReservedProjectName(coreResolved.base)?.cn || null;
    return cleanMeaningForDisplay(
      getMeaningValue(coreLexicon[coreResolved.base]),
      coreResolved.base,
    );
  }

  return cleanMeaningForDisplay(lookup(dict, term), term);
}

export function lookupLocalPhonetic(dict, phonetics, word, coreLexicon = {}) {
  const w = String(word || "")
    .trim()
    .toLowerCase()
    .replaceAll("’", "'");
  const reserved = getReservedProjectName(word);
  if (reserved) return reserved.ph || "";
  if (!w || w.includes(" ")) return "";
  return (
    getPhoneticValue(coreLexicon[w]) ||
    getPhoneticValue(dict[w]) ||
    cleanPhonetic(phonetics[w])
  );
}

export function reverseLookupChineseWords(dict, text) {
  const hits = [];
  const seen = new Set();
  const source = String(text).replace(/\s+/g, "");

  for (const [word, entry] of Object.entries(dict || {})) {
    if (STOP_WORDS.has(word)) continue;
    const meaning = getMeaningValue(entry);
    if (!meaning || meaning.length < 2) continue;
    const candidates = meaning
      .split(/[;；,，、/]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (candidates.some((item) => source.includes(item)) && !seen.has(word)) {
      seen.add(word);
      hits.push(word);
      if (hits.length >= 12) break;
    }
  }

  return hits.join(" ");
}

export function findPhraseMatches(phraseLexicon, text) {
  const source = String(text || "").toLowerCase();
  const matches = [];
  for (const phrase of Object.keys(phraseLexicon || {})) {
    const escaped = phrase
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    for (const match of source.matchAll(re)) {
      matches.push({
        term: phrase,
        index: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return matches.sort(
    (a, b) => a.index - b.index || b.term.length - a.term.length,
  );
}

export function extractLookupTerms(text, phraseLexicon = {}) {
  const source = String(text || "");
  const occupied = [];
  const terms = [];
  const seen = new Set();

  // Longest phrase wins its span, so "show your work" is never also split into
  // "show" + "work" cards.
  const matches = findPhraseMatches(phraseLexicon, source).sort(
    (a, b) => b.term.length - a.term.length || a.index - b.index,
  );
  for (const match of matches) {
    const overlaps = occupied.some(
      (range) =>
        Math.max(range[0], match.index) < Math.min(range[1], match.end),
    );
    if (overlaps) continue;
    occupied.push([match.index, match.end]);
    if (seen.has(match.term)) continue;
    seen.add(match.term);
    terms.push({ term: match.term, index: match.index });
  }

  const chars = source.split("");
  for (const [start, end] of occupied) {
    for (let i = start; i < end; i++) chars[i] = " ";
  }

  for (const token of wordTokens(chars.join(""))) {
    if (seen.has(token.term.toLowerCase())) continue;
    seen.add(token.term.toLowerCase());
    terms.push(token);
  }
  return terms.sort((a, b) => a.index - b.index).map((item) => item.term);
}

function* wordTokens(text) {
  const pattern = /[a-z]+(?:&[a-z]+)?(?:['’][a-z]+)?/gi;
  for (const match of String(text || "").matchAll(pattern)) {
    const word = match[0].toLowerCase().replaceAll("’", "'");
    if (contractions.has(word)) {
      yield { term: word, index: match.index };
      continue;
    }
    const base = word.split("'")[0];
    if (getReservedProjectName(base) || isVisibleWordToken(base)) {
      yield { term: base === "i" ? "I" : base, index: match.index };
    }
  }
}

export function extractWordTerms(text) {
  return [...new Set(Array.from(wordTokens(text), (token) => token.term))];
}

export function isVisibleWordToken(token) {
  const key = normalizeLookupTerm(token);
  if (!key || key.includes(" ")) return false;
  if (!/^[a-z]+$/.test(key)) return false;
  if (key.length === 1) return key === "a" || key === "i";
  if (OCR_NOISE_FRAGMENTS.has(key)) return false;
  return true;
}

export function pickPhonetic(entry) {
  const candidates = [];
  if (entry?.phonetic) candidates.push(entry.phonetic);
  for (const item of entry?.phonetics || []) {
    if (item?.text) candidates.push(item.text);
  }
  return cleanPhonetic(candidates.find(Boolean) || "");
}

export function createDictionaryService({
  dict,
  coreLexicon = {},
  phraseLexicon = {},
  phonetics,
  translateText,
  enqueueNetwork,
  getCachedOnlineWord,
  setCachedOnlineWord,
}) {
  const formIndex = buildCoreFormIndex(coreLexicon);
  const lookupLayers = { phraseLexicon, coreLexicon, formIndex, dict };

  // The long-tail shard arrives after first paint; merging in place keeps every
  // already-captured reference to these layers valid.
  function extendCoreLexicon(entries) {
    let added = 0;
    for (const [word, entry] of Object.entries(entries || {})) {
      if (coreLexicon[word]) continue;
      coreLexicon[word] = entry;
      addCoreFormsToIndex(formIndex, word, entry);
      added++;
    }
    return added;
  }

  async function lookupOnlineData(word) {
    const w = normalizeLookupTerm(word);
    if (!w || w.includes(" ")) return null;
    if (lookupLayered(lookupLayers, w)) return null;

    const cached = getCachedOnlineWord(w);
    if (cached) return cached;
    if (!isNetworkAllowed()) return null;

    const signal = getNetworkSignal();
    const res = await enqueueNetwork(
      () =>
        fetchJsonWithPolicy(
          "https://api.dictionaryapi.dev/api/v2/entries/en/" +
            encodeURIComponent(w),
          { signal },
          { timeoutMs: 8000, retries: 1, checkAccess: assertNetworkAllowed },
        ),
      signal,
    );
    const data = res.data;
    if (!res.ok || !Array.isArray(data) || data.title) return null;

    const entry = data[0];
    const phonetic = pickPhonetic(entry);
    const definitions = [];
    for (const meaning of entry.meanings || []) {
      if (definitions.length >= 2) break;
      const definition = meaning.definitions?.[0]?.definition;
      if (definition) {
        definitions.push({
          pos: POS_CN[meaning.partOfSpeech] || meaning.partOfSpeech || "释义",
          en: definition,
        });
      }
    }

    const translated = [];
    for (const item of definitions) {
      const cn = await translateText(item.en, "en", "zh-CN", signal);
      if (cn?.trim()) translated.push({ pos: item.pos, cn });
    }
    if (!translated.length) return null;

    const result = {
      phonetic,
      definitions: translated,
      meaning: translated.map((item) => `${item.pos}：${item.cn}`).join("；"),
    };
    setCachedOnlineWord(w, result);
    return result;
  }

  return {
    extendCoreLexicon,
    countLoadedWords: () =>
      new Set([...Object.keys(dict), ...Object.keys(coreLexicon)]).size,
    lookup: (word) => lookupLayered(lookupLayers, word),
    lookupLearningBand: (word) => {
      const resolved = lookupCoreBase(coreLexicon, formIndex, word);
      return resolved && !resolved.reserved
        ? getLearningBand(coreLexicon[resolved.base])
        : "";
    },
    lookupLocalPhonetic: (word) =>
      lookupLocalPhonetic(dict, phonetics, word, coreLexicon),
    reverseLookupChineseWords: (text) =>
      reverseLookupChineseWords({ ...dict, ...coreLexicon }, text),
    extractLookupTerms: (text) => extractLookupTerms(text, phraseLexicon),
    lookupOnlineData,
  };
}

function irregularModifier(word, base) {
  if (
    [
      "went",
      "gone",
      "did",
      "done",
      "ran",
      "bought",
      "brought",
      "thought",
      "made",
      "took",
      "taken",
      "wrote",
      "written",
      "saw",
      "seen",
    ].includes(word)
  ) {
    return "(变化形式)";
  }
  if ((word === "better" || word === "best") && base === "good")
    return word === "better" ? "更" : "最";
  return "";
}
