import { handleOcrRequest } from "../../workers/ocr-handler.js";

export function onRequest(context) {
  return handleOcrRequest(context.request, context.env);
}
