import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const origin = "https://dict.luciaandrayna.com";
const googleAnalyticsId = "G-1N76G8G0S5";
const sitemapPaths = ["/", "/about/", "/how-to/", "/sources/", "/privacy/"];
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
]);

const infoPageFiles = new Set([
  "about/index.html",
  "how-to/index.html",
  "sources/index.html",
  "privacy/index.html",
]);

for (const [path, file] of routeFiles) {
  const html = readDist(file);
  const canonical = `<link rel="canonical" href="${origin}${path}">`;
  if (!html.includes(canonical))
    fail(`${file} missing canonical ${origin}${path}`);
  if (
    !html.includes(
      `rel="alternate" hreflang="x-default" href="${origin}${path}"`,
    )
  )
    fail(`${file} missing x-default hreflang`);
  if (
    !html.includes(`rel="alternate" hreflang="zh-CN" href="${origin}${path}"`)
  )
    fail(`${file} missing zh-CN hreflang`);
  if (!html.includes(`rel="alternate" hreflang="en" href="${origin}${path}"`))
    fail(`${file} missing en hreflang`);
  if (!html.includes('<meta name="description"'))
    fail(`${file} missing meta description`);
  if (!html.includes('<meta property="og:locale" content="zh_CN"'))
    fail(`${file} missing Open Graph locale`);
  if (!html.includes('<meta name="twitter:title"'))
    fail(`${file} missing Twitter title`);
  if (!html.includes('<meta name="twitter:description"'))
    fail(`${file} missing Twitter description`);
  if (!html.includes('<meta name="twitter:image"'))
    fail(`${file} missing Twitter image`);
  if (!html.includes("<h1")) fail(`${file} missing h1`);
  if (!html.includes('"@type":"Organization"'))
    fail(`${file} missing Organization structured data`);
  if (!html.includes(`gtag/js?id=${googleAnalyticsId}`))
    fail(`${file} missing Google Analytics tag`);
  if (!html.includes(`gtag("config", "${googleAnalyticsId}"`))
    fail(`${file} missing Google Analytics config`);
  if (!html.includes("allow_google_signals: false"))
    fail(`${file} missing disabled Google signals config`);
  if (!html.includes("allow_ad_personalization_signals: false"))
    fail(`${file} missing disabled ad personalization config`);
  if (infoPageFiles.has(file)) {
    if (!html.includes('"@type":"WebPage"'))
      fail(`${file} missing WebPage structured data`);
    if (!html.includes('"@type":"BreadcrumbList"'))
      fail(`${file} missing BreadcrumbList structured data`);
  }
}

const home = readDist("index.html");
if (!home.includes('"@type":"WebApplication"'))
  fail("Home page missing WebApplication structured data");
if (home.includes('"@type":"SearchAction"'))
  fail("Home page should not declare SearchAction without a public search URL");

const howTo = readDist("how-to/index.html");
if (!howTo.includes('"@type":"HowTo"'))
  fail("How-to page missing HowTo structured data");

const notFound = readDist("404.html");
if (!notFound.includes("noindex,follow"))
  fail("404 page missing noindex,follow meta robots");

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`SEO validation passed for ${sitemapPaths.length} sitemap URLs.`);
