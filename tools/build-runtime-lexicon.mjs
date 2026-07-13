import fs from "node:fs";

const SOURCE_PATH = "tools/lexicon-data/core-lexicon.source.json";
const OVERRIDES_PATH = "tools/translation-overrides.json";
const OUTPUT_PATH = "public/assets/lexicon/core-lexicon.json";

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

const runtime = {};
for (const [word, entry] of Object.entries(source)) {
  const override = Object.hasOwn(overrides, word) ? overrides[word] : "";
  const cn = String(override || entry.cn || "").trim();
  if (!cn) continue;
  runtime[word] = [
    cn,
    String(entry.ph || ""),
    String(entry.pos || ""),
    entry.forms || [],
    learningBand(entry),
  ];
}

fs.mkdirSync("public/assets/lexicon", { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(runtime) + "\n");

console.log(`runtime lexicon entries: ${Object.keys(runtime).length}`);
console.log(`runtime lexicon bytes: ${fs.statSync(OUTPUT_PATH).size}`);
