import fs from "node:fs";

const SOURCE_PATH = "tools/lexicon-data/core-lexicon.source.json";
const OVERRIDES_PATH = "tools/translation-overrides.json";
const OUTPUT_PATH = "public/assets/lexicon/core-lexicon.json";
const EXTENDED_OUTPUT_PATH = "public/assets/lexicon/core-lexicon-extended.json";

// The head carries every word a classroom sentence is likely to contain and is
// what the first paint waits for; the long tail loads on demand so a phone does
// not download and parse a megabyte before the first word card appears.
const HEAD_BANDS = new Set(["foundation", "developing"]);

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));

function learningBand(entry) {
  const rank = Number(entry.rank || Number.MAX_SAFE_INTEGER);
  const tags = new Set(entry.tags || []);
  const schoolFocused = [
    "school",
    "classroom",
    "homework",
    "worksheet",
    "reading",
    "writing",
    "math",
    "science",
  ].some((tag) => tags.has(tag));
  if (rank <= 2000 || (schoolFocused && rank <= 8000)) return "foundation";
  if (rank <= 6000) return "developing";
  return "expanding";
}

const head = {};
const extended = {};
for (const [word, entry] of Object.entries(source)) {
  const override = Object.hasOwn(overrides, word) ? overrides[word] : "";
  const cn = String(override || entry.cn || "").trim();
  if (!cn) continue;
  const band = learningBand(entry);
  const record = [
    cn,
    String(entry.ph || ""),
    String(entry.pos || ""),
    entry.forms || [],
    band,
  ];
  if (HEAD_BANDS.has(band)) head[word] = record;
  else extended[word] = record;
}

if (!Object.keys(head).length || !Object.keys(extended).length) {
  throw new Error("Runtime lexicon split produced an empty shard");
}

fs.mkdirSync("public/assets/lexicon", { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(head) + "\n");
fs.writeFileSync(EXTENDED_OUTPUT_PATH, JSON.stringify(extended) + "\n");

console.log(
  `runtime lexicon head: ${Object.keys(head).length} entries, ${fs.statSync(OUTPUT_PATH).size} bytes`,
);
console.log(
  `runtime lexicon extended: ${Object.keys(extended).length} entries, ${fs.statSync(EXTENDED_OUTPUT_PATH).size} bytes`,
);
