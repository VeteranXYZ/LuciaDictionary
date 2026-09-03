import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIST = "dist";
const HEADERS_PATH = path.join(DIST, "_headers");
const PLACEHOLDER = "{{SCRIPT_HASHES}}";

// Matches inline <script> blocks only: anything with a src attribute is already
// covered by 'self'.
const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function listHtmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(fullPath);
    return entry.name.endsWith(".html") ? [fullPath] : [];
  });
}

const hashes = new Set();
for (const file of listHtmlFiles(DIST)) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(INLINE_SCRIPT_RE)) {
    const digest = crypto
      .createHash("sha256")
      .update(match[1], "utf8")
      .digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

const template = fs.readFileSync(HEADERS_PATH, "utf8");
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`_headers is missing the ${PLACEHOLDER} placeholder`);
}
if (template.includes("'unsafe-inline'")) {
  throw new Error("_headers still allows 'unsafe-inline'");
}

const headers = template.replace(
  PLACEHOLDER,
  [...hashes].sort().join(" ") || "'none'",
);
fs.writeFileSync(HEADERS_PATH, headers);

console.log(`security headers build: ${hashes.size} inline script hash(es)`);
