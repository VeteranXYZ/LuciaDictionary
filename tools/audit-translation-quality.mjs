import fs from "node:fs";

const CORE_PATH = "tools/lexicon-data/core-lexicon.source.json";
const CJK_RE = /[\u3400-\u9fff]/;
const core = JSON.parse(fs.readFileSync(CORE_PATH, "utf8"));
const overrides = JSON.parse(
  fs.readFileSync("tools/translation-overrides.json", "utf8"),
);
const allowlist = JSON.parse(
  fs.readFileSync("tools/translation-quality-allowlist.json", "utf8"),
);
const shortCnAllowlist = new Set(allowlist.short_cn || []);
const suspicious = [];

for (const [word, entry] of Object.entries(core)) {
  const override = Object.hasOwn(overrides, word) ? overrides[word] : "";
  const cn = String(override || entry.cn || "").trim();
  const reasons = [];
  if (cn.length < 2 && !shortCnAllowlist.has(word))
    reasons.push("cn too short");
  if (!CJK_RE.test(cn)) reasons.push("cn has no Chinese characters");
  if (/[�◆■□�]|\.{4,}|,,|;;|；；/.test(cn))
    reasons.push("cn contains obvious malformed symbols");
  if (cn.length > 220) reasons.push("cn is extremely long");
  if (cn.includes("???")) reasons.push("cn contains ???");
  if (/^[a-zA-Z0-9\s,.;:()/'"-]+$/.test(cn))
    reasons.push("cn appears to be only English");
  if (reasons.length) suspicious.push({ word, reasons, cn });
}

console.log(`suspicious translation count: ${suspicious.length}`);
for (const item of suspicious.slice(0, 100)) {
  console.log(`- ${item.word}: ${item.reasons.join(", ")} :: ${item.cn}`);
}

if (suspicious.length) process.exit(1);
