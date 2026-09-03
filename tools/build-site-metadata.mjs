import fs from "node:fs";
import {
  appDescription,
  appShortName,
  backgroundColor,
  faviconPngPath,
  logoPath,
  publicPagePaths,
  siteName,
  siteOrigin,
  themeColor,
} from "../src/config/site.js";

const sitemapItems = publicPagePaths
  .map((path) => `  <url>\n    <loc>${siteOrigin}${path}</loc>\n  </url>`)
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapItems}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /assets/*.json

Sitemap: ${siteOrigin}/sitemap.xml
`;

const manifest = {
  // A stable id keeps an installed app pointed at this entry across updates.
  id: "/",
  name: siteName,
  short_name: appShortName,
  description: appDescription,
  lang: "zh-CN",
  dir: "ltr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  categories: ["education", "books", "kids"],
  background_color: backgroundColor,
  theme_color: themeColor,
  icons: [
    { src: faviconPngPath, sizes: "192x192", type: "image/png" },
    { src: logoPath, sizes: "512x512", type: "image/png" },
    // Android crops "any" icons into its mask; without a maskable entry the
    // installed icon ends up as artwork on a white square.
    { src: logoPath, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

fs.writeFileSync("public/sitemap.xml", sitemap);
fs.writeFileSync("public/robots.txt", robots);
fs.writeFileSync(
  "public/manifest.webmanifest",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`site metadata generated for ${publicPagePaths.length} pages`);
