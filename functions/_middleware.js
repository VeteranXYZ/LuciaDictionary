import { withApiSecurityHeaders } from "./_shared/security-headers.js";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const response = await next();
  if (!url.pathname.startsWith("/api/")) return response;

  return withApiSecurityHeaders(response);
}
