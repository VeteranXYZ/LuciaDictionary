import { handleOcrRequest } from "./ocr-handler.js";

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/ocr") {
      return new Response("Not found", { status: 404 });
    }
    return handleOcrRequest(request, env);
  }
};
