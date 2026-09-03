import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { corePrecacheUrls, deferredPrecacheUrls } from "../src/config/site.js";

const DIST = "dist";
const SW_PATH = path.join(DIST, "sw.js");

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const buildAssetUrls = listFiles(path.join(DIST, "_a"))
  .map((file) => `/${path.relative(DIST, file).split(path.sep).join("/")}`)
  .sort();
const urls = [...new Set([...corePrecacheUrls, ...buildAssetUrls])];
const deferredUrls = [...new Set(deferredPrecacheUrls)].filter(
  (url) => !urls.includes(url),
);

for (const url of [...urls, ...deferredUrls]) {
  const file =
    url === "/" ? path.join(DIST, "index.html") : path.join(DIST, url.slice(1));
  if (!fs.existsSync(file))
    throw new Error(`Precache asset is missing: ${file}`);
}

const fingerprint = crypto.createHash("sha256");
for (const url of [...urls, ...deferredUrls]) {
  const file =
    url === "/" ? path.join(DIST, "index.html") : path.join(DIST, url.slice(1));
  fingerprint.update(url);
  fingerprint.update(fs.readFileSync(file));
}
const buildHash = fingerprint.digest("hex").slice(0, 12);

let serviceWorker = fs.readFileSync(SW_PATH, "utf8");
serviceWorker = serviceWorker.replace("__BUILD_HASH__", buildHash);
serviceWorker = serviceWorker.replace(
  /\/\* __PRECACHE_URLS__ \*\/[\s\S]*?;\nconst DEFERRED_PRECACHE_URLS/,
  `${JSON.stringify(urls, null, 2)};\nconst DEFERRED_PRECACHE_URLS`,
);
serviceWorker = serviceWorker.replace(
  /\/\* __DEFERRED_PRECACHE_URLS__ \*\/[\s\S]*?;\nconst PRECACHE_PATHS/,
  `${JSON.stringify(deferredUrls, null, 2)};\nconst PRECACHE_PATHS`,
);
fs.writeFileSync(SW_PATH, serviceWorker);

console.log(`service worker build: ${buildHash}`);
console.log(`precache entries: ${urls.length}`);
console.log(`deferred precache entries: ${deferredUrls.length}`);
