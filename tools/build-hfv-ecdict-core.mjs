import fs from "node:fs";

const HFV_PATH = "tools/lexicon-sources/high-frequency-vocabulary/30k.txt";
const ECDICT_PATH = "tools/lexicon-sources/ecdict/ecdict.csv";
const OUT_PATH = "public/assets/lexicon/core-lexicon.json";
const TOP_CANDIDATES = 15000;

const REQUIRED_WORDS = [
  "address", "activity", "thing", "fun", "lab", "inbox", "privacy", "policy",
  "support", "supportive", "thoughtful", "adventurous", "energetic", "exciting",
  "resource", "journey", "creature", "challenge", "clue", "treasure", "forest",
  "woods", "guide", "tip", "favorite", "subscribe", "contact", "email", "parent",
  "birthday", "height", "centimeter", "page", "worksheet", "assignment", "passage",
  "evidence", "compare", "contrast", "estimate", "observe", "record", "conclusion",
  "permission", "signature", "field", "trip", "chaperone", "dismissal", "folder",
  "backpack", "supplies", "main", "idea", "character", "setting", "problem",
  "solution", "paragraph", "sentence", "punctuation", "revise", "edit", "draft",
  "explain", "describe", "summarize", "predict", "analyze", "identify", "complete",
  "answer", "question", "circle", "underline", "label", "match", "solve"
];

const REQUIRED_SET = new Set(REQUIRED_WORDS);

const TAG_RULES = [
  { tag: "school", words: ["school", "teacher", "student", "class", "parent", "backpack", "folder", "supplies", "page"] },
  { tag: "classroom", words: ["circle", "underline", "label", "match", "complete", "answer", "question"] },
  { tag: "homework", words: ["homework", "assignment", "worksheet", "draft", "revise", "edit"] },
  { tag: "worksheet", words: ["worksheet", "page", "answer", "question", "complete", "passage"] },
  { tag: "reading", words: ["passage", "evidence", "main", "idea", "character", "setting", "summarize", "predict"] },
  { tag: "writing", words: ["paragraph", "sentence", "punctuation", "revise", "edit", "draft", "describe", "explain"] },
  { tag: "math", words: ["estimate", "solve", "compare", "contrast", "centimeter", "height"] },
  { tag: "science", words: ["lab", "observe", "record", "conclusion", "creature", "forest", "woods"] },
  { tag: "notice", words: ["permission", "signature", "field", "trip", "dismissal", "chaperone"] },
  { tag: "form", words: ["address", "birthday", "height", "signature", "permission", "contact", "email"] },
  { tag: "website", words: ["privacy", "policy", "inbox", "subscribe", "email", "contact", "resource"] },
  { tag: "ocr", words: ["address", "activity", "privacy", "policy", "inbox", "page", "worksheet"] },
  { tag: "social", words: ["support", "supportive", "thoughtful", "favorite", "fun"] },
  { tag: "emotion", words: ["supportive", "thoughtful", "adventurous", "energetic", "exciting"] },
  { tag: "story", words: ["journey", "creature", "challenge", "clue", "treasure", "forest", "woods"] }
];

const ACADEMIC_TAGS = /\b(cet6|ky|toefl|ielts|gre|sat|gmat|考研)\b/i;
const SCHOOL_TAGS = /\b(zk|gk|cet4|小学|初中|高中)\b/i;
const CJK_RE = /[\u3400-\u9fff]/;

function assertSource(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} source file not found: ${filePath}`);
  }
}

function normalizeWord(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isCleanWord(word) {
  if (!word || word.length > 40) return false;
  if (word.length === 1 && word !== "a" && word !== "i") return false;
  if (!/^[a-z]+(?:-[a-z]+)?$/.test(word)) return false;
  if (/\d|_/.test(word)) return false;
  return true;
}

function readHfvWords() {
  const seen = new Set();
  const words = [];
  const lines = fs.readFileSync(HFV_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const word = normalizeWord(line.split(/\s+/)[0]);
    if (!isCleanWord(word) || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

function* parseCsv(text) {
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      yield row;
      field = "";
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

function parseEcdict() {
  const text = fs.readFileSync(ECDICT_PATH, "utf8");
  const rows = parseCsv(text);
  const header = rows.next().value || [];
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const entries = new Map();
  let rowCount = 0;

  for (const row of rows) {
    rowCount++;
    const word = normalizeWord(row[index.word]);
    if (!isCleanWord(word)) continue;
    const translation = row[index.translation] || "";
    const cn = cleanTranslation(translation);
    if (!cn) continue;
    entries.set(word, {
      word,
      cn,
      ph: formatPhonetic(row[index.phonetic] || ""),
      pos: normalizePos(row[index.pos] || "", translation),
      exchange: row[index.exchange] || "",
      rawTag: row[index.tag] || ""
    });
  }

  return { entries, rowCount };
}

function cleanTranslation(value) {
  const lines = String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  const parts = [];
  const seen = new Set();
  for (const line of lines) {
    if (!CJK_RE.test(line)) continue;
    const cleaned = line
      .replace(/^(?:abbr|adj|adv|art|aux|conj|int|n|num|pl|prep|pron|v|vi|vt|a|s)\.\s*/i, "")
      .replace(/\[[^\]]+\]\s*/g, "")
      .replace(/\s+/g, " ")
      .replace(/[;,]\s*/g, "；")
      .replace(/；+/g, "；")
      .replace(/^[-:：；\s]+|[-:：；\s]+$/g, "")
      .trim();
    if (!cleaned || !CJK_RE.test(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    parts.push(cleaned);
  }
  return parts.join("；").replace(/；+/g, "；").slice(0, 220);
}

function formatPhonetic(value) {
  const ph = String(value || "").trim();
  if (!ph) return "";
  if (ph.startsWith("/") && ph.endsWith("/")) return ph;
  return `/${ph.replace(/^\/|\/$/g, "")}/`;
}

function normalizePos(pos, translation) {
  const found = new Set();
  for (const item of String(pos || "").split(/[\/\s,;]+/)) {
    const key = normalizePosToken(item);
    if (key) found.add(key);
  }
  for (const line of String(translation || "").replace(/\\n/g, "\n").split(/\n+/)) {
    const match = line.trim().match(/^(abbr|adj|adv|art|aux|conj|int|n|num|pl|prep|pron|v|vi|vt|a|s)\./i);
    const key = normalizePosToken(match?.[1]);
    if (key) found.add(key);
  }
  return Array.from(found).slice(0, 4).join(" / ");
}

function normalizePosToken(token) {
  const key = String(token || "").toLowerCase().replace(/\.$/, "");
  const map = {
    a: "adj.",
    adj: "adj.",
    s: "adj.",
    adv: "adv.",
    art: "art.",
    aux: "aux.",
    conj: "conj.",
    int: "int.",
    n: "n.",
    num: "num.",
    pl: "pl.",
    prep: "prep.",
    pron: "pron.",
    v: "v.",
    vi: "vi.",
    vt: "vt.",
    abbr: "abbr."
  };
  return map[key] || "";
}

function parseExchange(exchange) {
  const forms = new Set();
  const bases = new Set();
  for (const part of String(exchange || "").split("/")) {
    const [type, value] = part.split(":");
    const word = normalizeWord(value);
    if (!word || !isCleanWord(word)) continue;
    if (type === "0") bases.add(word);
    else forms.add(word);
  }
  return { forms: Array.from(forms), bases: Array.from(bases) };
}

function isCoveredInflectedForm(word, entry, ecdict) {
  const { bases } = parseExchange(entry.exchange);
  return bases.some(base => base !== word && ecdict.has(base) && parseExchange(ecdict.get(base).exchange).forms.includes(word));
}

function inferTags(word, entry, rank) {
  const tags = new Set(["core"]);
  if (rank <= 5000) tags.add("daily");
  for (const rule of TAG_RULES) {
    if (rule.words.includes(word)) tags.add(rule.tag);
  }
  if (ACADEMIC_TAGS.test(entry.rawTag)) tags.add("academic");
  if (SCHOOL_TAGS.test(entry.rawTag)) tags.add("school");
  return Array.from(tags).filter(tag => [
    "core", "daily", "school", "classroom", "homework", "worksheet", "reading", "writing",
    "math", "science", "notice", "form", "website", "ocr", "social", "emotion", "story", "academic"
  ].includes(tag));
}

function toOutputEntry(word, entry, rank) {
  const forms = parseExchange(entry.exchange).forms.filter(form => form !== word);
  return {
    cn: entry.cn,
    ph: entry.ph,
    pos: entry.pos,
    forms,
    rank,
    tags: inferTags(word, entry, rank)
  };
}

assertSource(HFV_PATH, "high-frequency-vocabulary");
assertSource(ECDICT_PATH, "ECDICT");

const hfvWords = readHfvWords();
const targetWords = hfvWords.slice(0, TOP_CANDIDATES);
const hfvRank = new Map(hfvWords.map((word, index) => [word, index + 1]));
const { entries: ecdict, rowCount } = parseEcdict();
const out = {};

let skippedCandidates = 0;
let emptyCnCandidates = 0;
let inflectedSkipped = 0;

for (const word of targetWords) {
  const entry = ecdict.get(word);
  if (!entry) {
    skippedCandidates++;
    continue;
  }
  if (!entry.cn) {
    emptyCnCandidates++;
    continue;
  }
  if (!REQUIRED_SET.has(word) && isCoveredInflectedForm(word, entry, ecdict)) {
    inflectedSkipped++;
    continue;
  }
  out[word] = toOutputEntry(word, entry, hfvRank.get(word));
}

let forcedRequired = 0;
const missingRequired = [];
for (const word of REQUIRED_WORDS) {
  if (out[word]) continue;
  const entry = ecdict.get(word);
  if (!entry?.cn) {
    missingRequired.push(word);
    continue;
  }
  out[word] = toOutputEntry(word, entry, hfvRank.get(word) || TOP_CANDIDATES + forcedRequired + 1);
  forcedRequired++;
}

fs.mkdirSync("public/assets/lexicon", { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

console.log(`high-frequency source word count: ${hfvWords.length}`);
console.log(`top ${TOP_CANDIDATES} candidate count: ${targetWords.length}`);
console.log(`ECDICT source row count: ${rowCount}`);
console.log(`final core entry count: ${Object.keys(out).length}`);
console.log(`skipped candidate count: ${skippedCandidates}`);
console.log(`empty cn count: ${emptyCnCandidates}`);
console.log(`likely inflected-form duplicate skipped: ${inflectedSkipped}`);
console.log(`required force-added count: ${forcedRequired}`);
console.log(`missing required words: ${missingRequired.join(", ") || "none"}`);
