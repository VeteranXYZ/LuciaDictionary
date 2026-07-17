export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const response = await next();
  if (!url.pathname.startsWith("/api/")) return response;

  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
