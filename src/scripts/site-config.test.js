import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  corePrecacheUrls,
  deferredPrecacheUrls,
  extendedLexiconPath,
  publicPagePaths,
  siteName,
  siteOrigin,
  themeColor,
} from "../config/site.js";

describe("generated site metadata", () => {
  it("matches the shared site configuration", () => {
    const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
    const robots = fs.readFileSync("public/robots.txt", "utf8");
    const manifest = JSON.parse(
      fs.readFileSync("public/manifest.webmanifest", "utf8"),
    );

    for (const path of publicPagePaths) {
      expect(sitemap).toContain(`<loc>${siteOrigin}${path}</loc>`);
    }
    expect(robots).toContain(`Sitemap: ${siteOrigin}/sitemap.xml`);
    expect(manifest.name).toBe(siteName);
    expect(manifest.theme_color).toBe(themeColor);
  });

  it("keeps the service worker template free of a second precache list", () => {
    const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
    expect(serviceWorker).toContain(
      "const PRECACHE_URLS = /* __PRECACHE_URLS__ */ [];",
    );
    for (const url of corePrecacheUrls) {
      if (url === "/") continue;
      expect(serviceWorker).not.toContain(JSON.stringify(url));
    }
  });
});

describe("precache tiers", () => {
  it("keeps the eager tier free of the long-tail lexicon", () => {
    expect(corePrecacheUrls).toContain("/assets/lexicon/core-lexicon.json");
    expect(corePrecacheUrls).toContain("/assets/lexicon/phrase-lexicon.json");
    expect(corePrecacheUrls).not.toContain(extendedLexiconPath);
  });

  it("still caches the long tail, just after activation", () => {
    expect(deferredPrecacheUrls).toContain(extendedLexiconPath);
  });

  it("does not list any asset in both tiers", () => {
    const overlap = deferredPrecacheUrls.filter((url) =>
      corePrecacheUrls.includes(url),
    );
    expect(overlap).toEqual([]);
  });
});
