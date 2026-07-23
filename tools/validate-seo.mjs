import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const origin = "https://dict.luciaandrayna.com";
const googleAnalyticsId = "G-1N76G8G0S5";
const sitemapPaths = ["/", "/about/", "/guide/", "/sources/", "/privacy/"];
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
const expectedSitemapUrls = sitemapPaths.map((path) => `${origin}${path}`);
if (
  locUrls.length !== expectedSitemapUrls.length ||
  locUrls.some((url) => !expectedSitemapUrls.includes(url))
) {
  fail("Sitemap must contain exactly the five canonical public URLs");
}
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

if (existsSync(join(dist, "_redirects"))) {
  fail("Redirect rules must not be emitted");
}
if (existsSync(join(dist, "accessibility/index.html"))) {
  fail("Retired accessibility page must not be emitted as standalone HTML");
}
if (existsSync(join(dist, "how-to/index.html"))) {
  fail("Retired how-to page must not be emitted as standalone HTML");
}

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
  ["/guide/", "guide/index.html"],
  ["/sources/", "sources/index.html"],
  ["/privacy/", "privacy/index.html"],
]);

const infoPageFiles = new Set([
  "about/index.html",
  "guide/index.html",
  "sources/index.html",
  "privacy/index.html",
]);

for (const [path, file] of routeFiles) {
  const html = readDist(file);
  const canonical = `<link rel="canonical" href="${origin}${path}">`;
  if (!html.includes(canonical))
    fail(`${file} missing canonical ${origin}${path}`);
  if (html.includes("hreflang="))
    fail(
      `${file} must not claim locale alternates without locale-specific URLs`,
    );
  if (/[—―]/u.test(html))
    fail(`${file} contains an avoidable long dash in user-facing copy`);
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
  const consentIndex = html.indexOf('gtag("consent", "default", {');
  const loaderIndex = html.indexOf(`gtag/js?id=${googleAnalyticsId}`);
  const configIndex = html.indexOf(`gtag("config", "${googleAnalyticsId}"`);
  if (
    consentIndex === -1 ||
    consentIndex > loaderIndex ||
    consentIndex > configIndex
  )
    fail(`${file} must set consent defaults before loading or configuring GA4`);
  if (!html.includes('analytics_storage: "granted"'))
    fail(`${file} missing granted first-party analytics storage`);
  for (const deniedAdConsent of [
    'ad_storage: "denied"',
    'ad_user_data: "denied"',
    'ad_personalization: "denied"',
  ]) {
    if (!html.includes(deniedAdConsent))
      fail(`${file} missing denied advertising consent: ${deniedAdConsent}`);
  }
  if (!html.includes('gtag("set", "ads_data_redaction", true)'))
    fail(`${file} missing Google Ads data redaction`);
  if (!html.includes("send_page_view: true"))
    fail(`${file} missing basic GA4 page-view config`);
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

const guide = readDist("guide/index.html");
if (!guide.includes("使用指南")) fail("Guide page missing its visible title");
if (guide.includes('"@type":"HowTo"'))
  fail("Guide page should use plain page semantics, not HowTo structured data");

const privacy = readDist("privacy/index.html");
for (const disclosure of [
  "Google Analytics 4",
  "第一方",
  "_ga",
  "访问和会话",
  "粗略地区",
  "所有广告和个性化功能",
  "自定义学习事件",
  "浏览器设置",
]) {
  if (!privacy.includes(disclosure))
    fail(`Privacy page missing GA4 disclosure: ${disclosure}`);
}

const notFound = readDist("404.html");
if (!notFound.includes("noindex,follow"))
  fail("404 page missing noindex,follow meta robots");

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`SEO validation passed for ${sitemapPaths.length} sitemap URLs.`);
