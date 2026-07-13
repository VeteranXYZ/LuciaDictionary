import { handleOcrRequest } from "../_shared/ocr-handler.js";

export function onRequest(context) {
  return handleOcrRequest(context.request, context.env);
}
