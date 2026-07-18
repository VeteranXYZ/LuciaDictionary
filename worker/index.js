import { handleOcrRequest } from "../functions/_shared/ocr-handler.js";

function withApiRobotsHeader(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ocr") {
      return withApiRobotsHeader(await handleOcrRequest(request, env));
    }
    return new Response("Not Found", { status: 404 });
  },
};
