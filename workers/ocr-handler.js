const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeOcrSpaceError(data, status) {
  const raw = [
    data?.ErrorMessage,
    data?.ErrorDetails,
    data?.OCRExitCode,
    status
  ].flat().join(" ").toLowerCase();

  if (status === 429 || raw.includes("rate") || raw.includes("too many")) return "too_many_requests";
  if (status >= 500 || raw.includes("unavailable") || raw.includes("timeout")) return "service_unavailable";
  if (raw.includes("size") || raw.includes("large")) return "file_too_large";
  if (raw.includes("format") || raw.includes("type") || raw.includes("unsupported")) return "unsupported_file_type";
  if (raw.includes("blank") || raw.includes("no text") || raw.includes("not detect")) return "no_text_detected";
  if (raw.includes("blur") || raw.includes("low quality")) return "image_too_blurry";
  return "service_unavailable";
}

export async function handleOcrRequest(request, env) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!env?.OCR_SPACE_API_KEY) return json({ error: "service_unavailable" }, 503);

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return json({ error: "unsupported_file_type" }, 415);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return json({ error: "unsupported_file_type" }, 415);
  if (!SUPPORTED_TYPES.has(file.type)) return json({ error: "unsupported_file_type" }, 415);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 413);

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, file.name || "lucia-ocr.jpg");
  upstreamForm.append("apikey", env.OCR_SPACE_API_KEY);
  upstreamForm.append("language", "eng");
  upstreamForm.append("isOverlayRequired", "false");
  upstreamForm.append("detectOrientation", "true");
  upstreamForm.append("scale", "true");
  upstreamForm.append("OCREngine", "2");

  let upstream;
  let data = {};
  try {
    upstream = await fetch(OCR_SPACE_ENDPOINT, { method: "POST", body: upstreamForm });
    data = await upstream.json();
  } catch (e) {
    return json({ error: "network_error" }, 502);
  }

  if (!upstream.ok || data?.IsErroredOnProcessing) {
    const code = normalizeOcrSpaceError(data, upstream.status);
    return json({ error: code }, code === "too_many_requests" ? 429 : 502);
  }

  const text = String(data?.ParsedResults?.[0]?.ParsedText || "").trim();
  if (!text) return json({ error: "no_text_detected" }, 422);
  return json({ text });
}
