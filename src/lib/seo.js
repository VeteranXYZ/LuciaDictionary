export {
  siteAlternateNames,
  siteLogo,
  siteName,
  siteOrigin,
} from "../config/site.js";

import {
  siteAlternateNames,
  siteLogo,
  siteName,
  siteOrigin,
} from "../config/site.js";

export function pageUrl(path = "/") {
  return new URL(path, siteOrigin).toString();
}

export function buildOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    alternateName: siteAlternateNames,
    url: siteOrigin,
    logo: siteLogo,
  };
}

export function buildWebPageStructuredData({
  path,
  title,
  description,
  pageType = "WebPage",
}) {
  return {
    "@context": "https://schema.org",
    "@type": pageType,
    name: title,
    description,
    url: pageUrl(path),
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: siteOrigin,
    },
    inLanguage: ["en", "zh-CN"],
  };
}

export function buildBreadcrumbStructuredData(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: pageUrl(item.path),
    })),
  };
}

export function buildInfoPageStructuredData({ path, title, description }) {
  return [
    buildWebPageStructuredData({ path, title, description }),
    buildBreadcrumbStructuredData([
      { name: siteName, path: "/" },
      { name: title, path },
    ]),
  ];
}
