function isPageRequest(url) {
  if (url.pathname.startsWith("/api/")) return false;
  return !/\.[A-Za-z0-9]+$/.test(url.pathname);
}

const TRAILING_SLASH_PATHS = new Set([
  "/about",
  "/how-to",
  "/sources",
  "/privacy",
  "/accessibility"
]);

function canonicalPageUrl(url) {
  const canonical = new URL(url);
  canonical.search = "";
  if (canonical.pathname === "/search" || canonical.pathname.startsWith("/search/")) {
    canonical.pathname = "/";
  } else if (TRAILING_SLASH_PATHS.has(canonical.pathname)) {
    canonical.pathname += "/";
  }
  return canonical;
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if ((request.method === "GET" || request.method === "HEAD") && url.search && isPageRequest(url)) {
    return Response.redirect(canonicalPageUrl(url).toString(), 301);
  }

  const response = await next();
  if (!url.pathname.startsWith("/api/")) return response;

  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
