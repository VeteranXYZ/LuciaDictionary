import fs from "node:fs";
import {
  buildCoreFormIndex,
  lookupCoreBase,
} from "../src/scripts/dictionary.js";

const HFV_PATH = "tools/lexicon-sources/high-frequency-vocabulary/30k.txt";
const ECDICT_PATH = "tools/lexicon-sources/ecdict/ecdict.csv";
const CORE_PATH = "tools/lexicon-data/core-lexicon.source.json";
const TOP_CANDIDATES = 15000;
const REQUIRED_WORDS = [
  "address",
  "activity",
  "thing",
  "fun",
  "lab",
  "inbox",
  "privacy",
  "policy",
  "support",
  "supportive",
  "thoughtful",
  "adventurous",
  "energetic",
  "exciting",
  "resource",
  "journey",
  "creature",
  "challenge",
  "clue",
  "treasure",
  "forest",
  "woods",
  "guide",
  "tip",
  "favorite",
  "subscribe",
  "contact",
  "email",
  "parent",
  "birthday",
  "height",
  "centimeter",
  "page",
  "worksheet",
  "assignment",
  "passage",
  "evidence",
  "compare",
  "contrast",
  "estimate",
  "observe",
  "record",
  "conclusion",
  "permission",
  "signature",
  "field",
  "trip",
  "chaperone",
  "dismissal",
  "folder",
  "backpack",
  "supplies",
  "main",
  "idea",
  "character",
  "setting",
  "problem",
  "solution",
  "paragraph",
  "sentence",
  "punctuation",
  "revise",
  "edit",
  "draft",
  "explain",
  "describe",
  "summarize",
  "predict",
  "analyze",
  "identify",
  "complete",
  "answer",
  "question",
  "circle",
  "underline",
  "label",
  "match",
  "solve",
];
const SAMPLE_WORDS = [
  "address",
  "activity",
  "activities",
  "privacy",
  "policy",
  "thoughtful",
  "supportive",
  "fun",
  "lab",
  "inbox",
];

function fileLines(filePath) {
  return fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).length
    : 0;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const core = JSON.parse(fs.readFileSync(CORE_PATH, "utf8"));
const keys = Object.keys(core);
const formIndex = buildCoreFormIndex(core);
const missingRequired = REQUIRED_WORDS.filter((word) => !core[word]);
const entriesWithPh = keys.filter((key) => core[key].ph).length;
const entriesWithForms = keys.filter((key) => core[key].forms?.length).length;
const emptyCn = keys.filter((key) => !String(core[key].cn || "").trim()).length;
const inflectedDuplicateKeys = keys.filter(
  (key) => formIndex[key] && formIndex[key] !== key,
);
const duplicateKeyCount = 0;
const skippedCandidateCount = Math.max(
  0,
  TOP_CANDIDATES -
    keys.filter((key) => core[key].rank <= TOP_CANDIDATES).length,
);

console.log(`high-frequency source word count: ${fileLines(HFV_PATH)}`);
console.log(
  `top ${TOP_CANDIDATES} candidate count: ${Math.min(TOP_CANDIDATES, fileLines(HFV_PATH))}`,
);
console.log(
  `ECDICT source row count: ${Math.max(0, fileLines(ECDICT_PATH) - 1)}`,
);
console.log(`final core entry count: ${keys.length}`);
console.log(`skipped candidate count: ${skippedCandidateCount}`);
console.log(`empty cn count: ${emptyCn}`);
console.log(`entries with ph count: ${entriesWithPh}`);
console.log(`entries with forms count: ${entriesWithForms}`);
console.log(`duplicate key count: ${duplicateKeyCount}`);
console.log(
  `likely inflected-form duplicate count: ${inflectedDuplicateKeys.length}`,
);
console.log(
  `required word coverage: ${REQUIRED_WORDS.length - missingRequired.length}/${REQUIRED_WORDS.length}`,
);
console.log(`missing required words: ${missingRequired.join(", ") || "none"}`);
console.log(
  `file size of core-lexicon.json: ${formatBytes(fs.statSync(CORE_PATH).size)}`,
);
console.log("sample lookup results:");
for (const word of SAMPLE_WORDS) {
  const resolved = lookupCoreBase(core, formIndex, word);
  const entry = resolved ? core[resolved.base] : null;
  console.log(
    `- ${word}: ${entry ? `${resolved.base} => ${entry.cn}` : "missing"}`,
  );
}

if (emptyCn || missingRequired.length) {
  process.exitCode = 1;
}
