import fs from "node:fs";

const required = JSON.parse(
  fs.readFileSync("tools/required-core-words.json", "utf8"),
);
const oldDict = JSON.parse(fs.readFileSync("public/assets/dict.json", "utf8"));

function readJson(path) {
  if (!fs.existsSync(path)) throw new Error(`${path} does not exist`);
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const core = readJson("tools/lexicon-data/core-lexicon.source.json");
const phrases = readJson("tools/lexicon-data/phrase-lexicon.json");
const runtime = readJson("public/assets/lexicon/core-lexicon.json");
const errors = [];

function resolveCore(word) {
  const key = word.toLowerCase();
  if (core[key]) return key;
  for (const [base, entry] of Object.entries(core)) {
    if (Array.isArray(entry.forms) && entry.forms.includes(key)) return base;
  }
  return "";
}

for (const [key, entry] of Object.entries(core)) {
  if (key !== key.toLowerCase())
    errors.push(`core key is not lowercase: ${key}`);
  if (!entry?.cn) errors.push(`core entry missing cn: ${key}`);
  for (const form of entry.forms || []) {
    if (!core[key]) errors.push(`form ${form} points to missing base ${key}`);
  }
}

for (const [key, entry] of Object.entries(phrases)) {
  if (key !== key.toLowerCase())
    errors.push(`phrase key is not lowercase: ${key}`);
  if (!entry?.phrase || !entry?.cn)
    errors.push(`phrase entry missing phrase/cn: ${key}`);
}

const missingRequiredWords = required.words.filter(
  (word) => !resolveCore(word),
);
const missingRequiredPhrases = required.phrases.filter(
  (phrase) => !phrases[phrase.toLowerCase()],
);
if (missingRequiredWords.length)
  errors.push(`missing required words: ${missingRequiredWords.join(", ")}`);
if (missingRequiredPhrases.length)
  errors.push(`missing required phrases: ${missingRequiredPhrases.join(", ")}`);
if (Object.keys(runtime).length !== Object.keys(core).length)
  errors.push("runtime lexicon entry count does not match source");
for (const [word, entry] of Object.entries(runtime)) {
  if (!Array.isArray(entry) || entry.length < 5)
    errors.push(`invalid compact runtime entry: ${word}`);
  if (!entry?.[0]) errors.push(`runtime entry missing cn: ${word}`);
  if (!["foundation", "developing", "expanding"].includes(entry?.[4]))
    errors.push(`runtime entry missing learning band: ${word}`);
}

const levelCounts = {};
const learningBandCounts = {};
const tagCounts = {};
for (const entry of Object.values(core)) {
  levelCounts[entry.level || "unleveled"] =
    (levelCounts[entry.level || "unleveled"] || 0) + 1;
  for (const tag of entry.tags || ["untagged"]) {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
}
for (const entry of Object.values(runtime)) {
  const band = entry?.[4] || "unbanded";
  learningBandCounts[band] = (learningBandCounts[band] || 0) + 1;
}

const missingBefore = required.words.filter(
  (word) => !oldDict[word.toLowerCase()],
);
const coveredNow = required.words.filter((word) => resolveCore(word));

console.log(`core entries: ${Object.keys(core).length}`);
console.log(`runtime entries: ${Object.keys(runtime).length}`);
console.log(`phrase entries: ${Object.keys(phrases).length}`);
console.log(`required words missing in old dict: ${missingBefore.length}`);
console.log(
  `required words covered now: ${coveredNow.length}/${required.words.length}`,
);
console.log(
  `required phrases covered now: ${required.phrases.filter((phrase) => phrases[phrase.toLowerCase()]).length}/${required.phrases.length}`,
);
console.log(`levels: ${JSON.stringify(levelCounts)}`);
console.log(`runtime learning bands: ${JSON.stringify(learningBandCounts)}`);
console.log(
  `top tags: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
    ),
  )}`,
);

if (Object.keys(core).length < 3000)
  errors.push("core lexicon has fewer than 3000 entries");
if (Object.keys(phrases).length < 300)
  errors.push("phrase lexicon has fewer than 300 entries");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
