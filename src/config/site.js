export const siteOrigin = "https://dict.luciaandrayna.com";
export const siteName = "Lucia's Dictionary";
export const siteAlternateNames = [
  "Lucia Dictionary",
  "Lucia's English Dictionary",
  "Lucia 的英语词典",
  "Lucia 课堂英语词典",
];

export const homeTitle = "Lucia's Dictionary｜课堂英语句子学习词典";
export const homeDescription =
  "输入、粘贴或拍下课堂英语句子，查看中文释义、音标和发音，并把生词保存在本地随时复习。";
export const brandSubtitle = "Lucia 的小学英语学习伙伴";
export const appShortName = "Lucia 词典";
export const appDescription = "把课堂英语句子变成能读、能懂、能复习的单词卡。";
export const siteOwner = "Lucia & Rayna";
export const sitePublisher = "HIEI";
export const contactEmail = "hello@luciaandrayna.com";
export const copyrightYear = new Date().getUTCFullYear();

export const logoPath = "/assets/logo.png";
export const luciaMascotPath = "/assets/lucia.png";
export const emptyMascotPath = "/assets/monkey.png";
export const faviconPngPath = "/favicon.png";
export const faviconIcoPath = "/favicon.ico";
export const manifestPath = "/manifest.webmanifest";
export const serviceWorkerPath = "/sw.js";
export const siteLogo = `${siteOrigin}${logoPath}`;

export const googleAnalyticsId = "G-1N76G8G0S5";
export const themeColor = "#6B8E5A";
export const backgroundColor = "#FFF8E6";

export const infoPages = [
  {
    id: "about",
    path: "/about/",
    label: "关于",
    labelEn: "About",
    settingsIcon: "L",
  },
  {
    id: "guide",
    path: "/guide/",
    label: "使用指南",
    labelEn: "Guide",
    settingsIcon: "?",
  },
  {
    id: "sources",
    path: "/sources/",
    label: "数据来源",
    labelEn: "Sources",
    settingsIcon: "⌁",
  },
  {
    id: "privacy",
    path: "/privacy/",
    label: "隐私与数据",
    labelEn: "Privacy",
    settingsIcon: "✓",
  },
];

export const publicPagePaths = ["/", ...infoPages.map((page) => page.path)];
export const infoPageById = Object.fromEntries(
  infoPages.map((page) => [page.id, page]),
);

export const corePrecacheUrls = [
  "/",
  manifestPath,
  "/assets/dict.json",
  "/assets/lexicon/core-lexicon.json",
  "/assets/phonetics.json",
  "/assets/phrasebook.json",
  logoPath,
  luciaMascotPath,
  emptyMascotPath,
  faviconPngPath,
  faviconIcoPath,
];
