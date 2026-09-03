import { handleOcrRequest } from "./lib/ocr-handler.js";
import { handleTranslateRequest } from "./lib/translate-handler.js";
import { withApiSecurityHeaders } from "./lib/security-headers.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ocr") {
      return withApiSecurityHeaders(await handleOcrRequest(request, env));
    }
    if (url.pathname === "/api/translate") {
      return withApiSecurityHeaders(await handleTranslateRequest(request, env));
    }
    return new Response("Not Found", { status: 404 });
  },
};
