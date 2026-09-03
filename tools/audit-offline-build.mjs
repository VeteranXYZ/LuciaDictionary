import fs from "node:fs";

const sw = fs.readFileSync("dist/sw.js", "utf8");
const html = fs.readFileSync("dist/index.html", "utf8");
const errors = [];

if (sw.includes("__BUILD_HASH__"))
  errors.push("service worker build hash was not injected");
if (sw.includes("__PRECACHE_URLS__"))
  errors.push("service worker precache manifest was not injected");
if (!sw.includes('"/assets/lexicon/core-lexicon.json"'))
  errors.push("runtime lexicon head is not precached");
if (!sw.includes('"/assets/lexicon/core-lexicon-extended.json"'))
  errors.push("extended runtime lexicon is not in the deferred precache tier");
if (!sw.includes('"/assets/lexicon/phrase-lexicon.json"'))
  errors.push("runtime phrase lexicon is not precached");
if (!/const DEFERRED_PRECACHE_URLS = \[[\s\S]*?\];/.test(sw))
  errors.push("deferred precache manifest was not injected");

for (const match of html.matchAll(/(?:src|href)="(\/_a\/[^"?]+)[^"]*"/g)) {
  if (!sw.includes(JSON.stringify(match[1])))
    errors.push(`build asset is not precached: ${match[1]}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("offline build audit passed");
