import fs from "node:fs";
import path from "node:path";
import {
  buildCoreFormIndex,
  findPhraseMatches,
  lookupBaseWord,
  lookupCoreBase,
  normalizeLookupTerm
} from "../src/scripts/dictionary.js";

const samplePath = "tools/ocr-samples/lucia-webpage.txt";
const phraseLexiconPath = "public/assets/phrase-lexicon.json";
const coreLexiconPath = "public/assets/core-lexicon.json";
const oldDictPath = "public/assets/dict.json";

const requiredLocalWords = [
  "address",
  "activity",
  "privacy",
  "policy",
  "thoughtful",
  "supportive",
  "fun",
  "lab",
  "inbox"
];

const ignoredTokens = new Set([
  "lucia",
  "rayna",
  "apr",
  "c",
  "cm"
]);

const contractionFragments = new Set([
  "d",
  "ll",
  "m",
  "re",
  "s",
  "t",
  "ve"
]);

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function overlaps(a, b) {
  return Math.max(a[0], b[0]) < Math.min(a[1], b[1]);
}

function detectPhrases(phraseLexicon, source) {
  const accepted = [];
  const occupied = [];
  for (const match of findPhraseMatches(phraseLexicon, source)) {
    const range = [match.index, match.end];
    if (occupied.some(item => overlaps(item, range))) continue;
    occupied.push(range);
    accepted.push(match);
  }
  return accepted;
}

function tokenInPhrase(token, phraseMatches) {
  return phraseMatches.some(match => token.index >= match.index && token.end <= match.end);
}

function tokenize(source) {
  const tokens = [];
  const re = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
  let match;
  while ((match = re.exec(source))) {
    const raw = match[0];
    for (const part of raw.split("'")) {
      const normalized = normalizeLookupTerm(part);
      if (!normalized || contractionFragments.has(normalized)) continue;
      tokens.push({
        raw: part,
        word: normalized,
        index: match.index,
        end: match.index + raw.length
      });
    }
  }
  return tokens;
}

function countMapAdd(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit = 20) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => `${word}:${count}`);
}

function resolveWord(word, coreLexicon, formIndex, oldDict) {
  const coreResolved = lookupCoreBase(coreLexicon, formIndex, word);
  if (coreResolved) return { layer: "core", base: coreResolved.base };
  const oldResolved = lookupBaseWord(oldDict, word);
  if (oldResolved) return { layer: "old", base: oldResolved.base };
  return { layer: "fallback", base: word };
}

function assertPass(condition, message, failures) {
  if (!condition) failures.push(message);
}

const source = fs.readFileSync(samplePath, "utf8");
const phraseLexicon = loadJson(phraseLexiconPath);
const coreLexicon = loadJson(coreLexiconPath);
const oldDict = loadJson(oldDictPath);
const formIndex = buildCoreFormIndex(coreLexicon);

const phraseMatches = detectPhrases(phraseLexicon, source);
const tokens = tokenize(source).filter(token => !ignoredTokens.has(token.word));
const uniqueWords = new Set(tokens.map(token => token.word));

let phraseHits = 0;
let coreHits = 0;
let oldDictHits = 0;
let fallbackNeeded = 0;

const missingWords = new Map();
const fallbackWords = new Map();
const coreWords = new Map();
const oldWords = new Map();
const phraseTerms = new Map();

for (const match of phraseMatches) {
  countMapAdd(phraseTerms, match.term);
}

for (const token of tokens) {
  if (tokenInPhrase(token, phraseMatches)) {
    phraseHits += 1;
    continue;
  }

  const resolved = resolveWord(token.word, coreLexicon, formIndex, oldDict);
  if (resolved.layer === "core") {
    coreHits += 1;
    countMapAdd(coreWords, `${token.word}->${resolved.base}`);
  } else if (resolved.layer === "old") {
    oldDictHits += 1;
    countMapAdd(oldWords, `${token.word}->${resolved.base}`);
  } else {
    fallbackNeeded += 1;
    countMapAdd(missingWords, token.word);
    countMapAdd(fallbackWords, token.word);
  }
}

const covered = phraseHits + coreHits + oldDictHits;
const coverage = tokens.length ? covered / tokens.length : 0;
const fallbackRate = tokens.length ? fallbackNeeded / tokens.length : 0;
const requiredFallback = requiredLocalWords.filter(word => resolveWord(word, coreLexicon, formIndex, oldDict).layer === "fallback");
const failures = [];

assertPass(coverage >= 0.85, `Coverage ${formatPercent(coverage)} is below 85%`, failures);
assertPass(fallbackRate < 0.1, `Online fallback rate ${formatPercent(fallbackRate)} is not below 10%`, failures);
assertPass(!requiredFallback.length, `Required local words fell back online: ${requiredFallback.join(", ")}`, failures);

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

const report = {
  sample: path.normalize(samplePath),
  totalTokens: tokens.length,
  uniqueWords: uniqueWords.size,
  phraseHits,
  phraseMatches: phraseMatches.length,
  coreLexiconHits: coreHits,
  oldDictHits,
  onlineFallbackNeeded: fallbackNeeded,
  coverage: formatPercent(coverage),
  onlineFallbackRate: formatPercent(fallbackRate),
  missingWordsCount: missingWords.size,
  topMissingWords: topEntries(missingWords),
  wordsThatStillRelyOnOnlineFallback: topEntries(fallbackWords, 50),
  phraseTerms: topEntries(phraseTerms, 30),
  requiredFallback
};

console.log(`OCR sample: ${report.sample}`);
console.log(`total tokens: ${report.totalTokens}`);
console.log(`unique words: ${report.uniqueWords}`);
console.log(`phrase hits: ${report.phraseHits}`);
console.log(`phrase matches: ${report.phraseMatches}`);
console.log(`core lexicon hits: ${report.coreLexiconHits}`);
console.log(`old dict hits: ${report.oldDictHits}`);
console.log(`online fallback needed: ${report.onlineFallbackNeeded}`);
console.log(`coverage: ${report.coverage}`);
console.log(`online fallback rate: ${report.onlineFallbackRate}`);
console.log(`missing words count: ${report.missingWordsCount}`);
console.log(`top missing words: ${report.topMissingWords.join(", ") || "none"}`);
console.log(`words that still rely on online fallback: ${report.wordsThatStillRelyOnOnlineFallback.join(", ") || "none"}`);
console.log(`phrase terms: ${report.phraseTerms.join(", ") || "none"}`);

if (failures.length) {
  console.error(`audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("OCR sample coverage audit passed.");
