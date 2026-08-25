import { handleOcrRequest } from "../functions/_shared/ocr-handler.js";
import { withApiSecurityHeaders } from "../functions/_shared/security-headers.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ocr") {
      return withApiSecurityHeaders(await handleOcrRequest(request, env));
    }
    return new Response("Not Found", { status: 404 });
  },
};
