import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const origin = "https://dict.luciaandrayna.com";
const sitemapPaths = [
  "/",
  "/about/",
  "/how-to/",
  "/sources/",
  "/privacy/",
  "/accessibility/",
];
const failures = [];

function fail(message) {
  failures.push(message);
}

function readDist(path) {
  const file = join(dist, path);
  if (!existsSync(file)) {
    fail(`Missing dist/${path}`);
    return "";
  }
  return readFileSync(file, "utf8");
}

const sitemap = readDist("sitemap.xml");
if (!sitemap.includes("<urlset")) fail("Sitemap is not XML urlset");
for (const path of sitemapPaths) {
  const loc = `<loc>${origin}${path}</loc>`;
  if (!sitemap.includes(loc)) fail(`Sitemap missing ${loc}`);
}
const locUrls = Array.from(
  sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
  (match) => match[1],
);
if (
  locUrls.some(
    (url) =>
      url.includes("?") || url.includes("/word/") || url.includes("/search"),
  )
) {
  fail("Sitemap includes a query, search route, or word-entry route");
}

const robots = readDist("robots.txt");
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`))
  fail("robots.txt does not declare production sitemap");
if (!robots.includes("Disallow: /api/"))
  fail("robots.txt does not disallow API routes");

const redirects = readDist("_redirects");
if (!redirects.includes("/search / 301"))
  fail("_redirects does not canonicalize /search");

const headers = readDist("_headers");
if (!headers.includes("X-Robots-Tag: noindex, nofollow"))
  fail("_headers missing API noindex rule");

const routes = readDist("_routes.json");
if (!routes.includes('"include"') || !routes.includes('"exclude"')) {
  fail("_routes.json missing include/exclude rules");
}

const routeFiles = new Map([
  ["/", "index.html"],
  ["/about/", "about/index.html"],
  ["/how-to/", "how-to/index.html"],
  ["/sources/", "sources/index.html"],
  ["/privacy/", "privacy/index.html"],
  ["/accessibility/", "accessibility/index.html"],
]);

for (const [path, file] of routeFiles) {
  const html = readDist(file);
  const canonical = `<link rel="canonical" href="${origin}${path}">`;
  if (!html.includes(canonical))
    fail(`${file} missing canonical ${origin}${path}`);
  if (!html.includes('<meta name="description"'))
    fail(`${file} missing meta description`);
  if (!html.includes("<h1")) fail(`${file} missing h1`);
}

const notFound = readDist("404.html");
if (!notFound.includes("noindex,follow"))
  fail("404 page missing noindex,follow meta robots");

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`SEO validation passed for ${sitemapPaths.length} sitemap URLs.`);
