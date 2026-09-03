import fs from "node:fs";
import path from "node:path";

const SOURCE = "tools/lexicon-data/phrase-lexicon.json";
const OUTPUT = "public/assets/lexicon/phrase-lexicon.json";

// Only true multi-word lexical phrases belong in the runtime layer. The source
// file also holds whole classroom sentences; those are the phrasebook's job and
// would swallow an entire input if they were matched as a single word card.
const LEXICAL_PHRASE_RE = /^[a-z]+(?: [a-z]+)+$/;

// The source still carries auto-generated stubs like "activity page（常用短语）".
// Publishing those would show the English back to the child as if it were the
// meaning, which is worse than letting the words split normally.
const PLACEHOLDER_MEANING_RE = /（常用短语）|\(常用短语\)/;

const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const runtime = {};
const untranslated = [];

for (const [phrase, entry] of Object.entries(source)) {
  if (!LEXICAL_PHRASE_RE.test(phrase)) continue;
  const cn = String(entry?.cn || "").trim();
  if (!cn) continue;
  if (PLACEHOLDER_MEANING_RE.test(cn) || !/[㐀-鿿]/.test(cn)) {
    untranslated.push(phrase);
    continue;
  }
  runtime[phrase] = { cn };
}

const phrases = Object.keys(runtime).sort();
if (phrases.length < 20) {
  throw new Error(
    `Runtime phrase lexicon looks truncated: ${phrases.length} entries`,
  );
}

const ordered = Object.fromEntries(phrases.map((key) => [key, runtime[key]]));
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(ordered) + "\n");

console.log(
  `phrase lexicon build: ${phrases.length} entries, ${fs.statSync(OUTPUT).size} bytes`,
);
if (untranslated.length) {
  console.log(
    `phrase lexicon: ${untranslated.length} source phrases still lack a Chinese meaning and were skipped`,
  );
  console.log(
    `  ${untranslated.slice(0, 10).join(", ")}${untranslated.length > 10 ? ", …" : ""}`,
  );
}
