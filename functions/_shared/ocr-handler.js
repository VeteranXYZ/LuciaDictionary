const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 128 * 1024;
const MAX_UPSTREAM_RESPONSE_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 15000;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function normalizeOcrSpaceError(data, status) {
  const raw = [
    data?.ErrorMessage,
    data?.ErrorDetails,
    data?.OCRExitCode,
    status,
  ]
    .flat()
    .join(" ")
    .toLowerCase();

  if (status === 429 || raw.includes("rate") || raw.includes("too many"))
    return "too_many_requests";
  if (status >= 500 || raw.includes("unavailable") || raw.includes("timeout"))
    return "service_unavailable";
  if (raw.includes("size") || raw.includes("large")) return "file_too_large";
  if (
    raw.includes("format") ||
    raw.includes("type") ||
    raw.includes("unsupported")
  )
    return "unsupported_file_type";
  if (
    raw.includes("blank") ||
    raw.includes("no text") ||
    raw.includes("not detect")
  )
    return "no_text_detected";
  if (raw.includes("blur") || raw.includes("low quality"))
    return "image_too_blurry";
  return "service_unavailable";
}

function isCrossSiteRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin && origin !== url.origin) return true;
  return fetchSite === "cross-site";
}

function getClientKey(request) {
  const provided =
    request.headers.get("x-lucia-client")?.trim().toLowerCase() || "";
  if (/^[a-z0-9-]{8,64}$/.test(provided)) return `client:${provided}`;
  return "client:anonymous";
}

async function hasValidImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (file.type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (file.type === "image/webp") {
    const ascii = String.fromCharCode(...bytes);
    return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  }
  return false;
}

function logOcrEvent(logger, level, event, details = {}) {
  const method =
    level === "error" ? "error" : level === "warn" ? "warn" : "info";
  logger?.[method]?.(
    JSON.stringify({
      service: "lucia-ocr",
      event,
      ...details,
    }),
  );
}

function requestIdFor(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

export async function handleOcrRequest(request, env, options = {}) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  const logger = options.logger || console;
  const fetchImpl = options.fetchImpl || fetch;

  const respond = (error, status, headers = {}) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    logOcrEvent(logger, level, "request_complete", {
      requestId,
      status,
      code: error,
      durationMs: Date.now() - startedAt,
    });
    return json(error ? { error } : {}, status, {
      "x-request-id": requestId,
      ...headers,
    });
  };

  if (request.method !== "POST")
    return respond("method_not_allowed", 405, { allow: "POST" });
  if (isCrossSiteRequest(request)) return respond("forbidden", 403);
  if (!env?.OCR_SPACE_API_KEY) return respond("service_unavailable", 503);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return respond("unsupported_file_type", 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return respond("file_too_large", 413);
  }

  if (env.OCR_RATE_LIMITER?.limit) {
    const outcome = await env.OCR_RATE_LIMITER.limit({
      key: getClientKey(request),
    });
    if (!outcome.success)
      return respond("too_many_requests", 429, { "retry-after": "60" });
  } else {
    logOcrEvent(logger, "warn", "rate_limiter_missing", { requestId });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return respond("unsupported_file_type", 415);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return respond("unsupported_file_type", 415);
  if (!SUPPORTED_TYPES.has(file.type))
    return respond("unsupported_file_type", 415);
  if (file.size > MAX_UPLOAD_BYTES) return respond("file_too_large", 413);
  if (!(await hasValidImageSignature(file)))
    return respond("unsupported_file_type", 415);

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, file.name || "lucia-ocr.jpg");
  upstreamForm.append("apikey", env.OCR_SPACE_API_KEY);
  upstreamForm.append("language", "eng");
  upstreamForm.append("isOverlayRequired", "false");
  upstreamForm.append("detectOrientation", "true");
  upstreamForm.append("scale", "true");
  upstreamForm.append("OCREngine", "2");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("upstream_timeout"),
    UPSTREAM_TIMEOUT_MS,
  );
  let upstream;
  let data = {};
  try {
    upstream = await fetchImpl(OCR_SPACE_ENDPOINT, {
      method: "POST",
      body: upstreamForm,
      signal: controller.signal,
    });
    const upstreamLength = Number(upstream.headers.get("content-length") || 0);
    if (
      Number.isFinite(upstreamLength) &&
      upstreamLength > MAX_UPSTREAM_RESPONSE_BYTES
    ) {
      return respond("service_unavailable", 502);
    }
    data = await upstream.json();
  } catch (error) {
    const timedOut = controller.signal.aborted || error?.name === "AbortError";
    return respond(
      timedOut ? "service_unavailable" : "network_error",
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || data?.IsErroredOnProcessing) {
    const code = normalizeOcrSpaceError(data, upstream.status);
    return respond(
      code,
      code === "too_many_requests" ? 429 : 502,
      code === "too_many_requests" ? { "retry-after": "60" } : {},
    );
  }

  const text = String(data?.ParsedResults?.[0]?.ParsedText || "").trim();
  if (!text) return respond("no_text_detected", 422);

  logOcrEvent(logger, "info", "request_complete", {
    requestId,
    status: 200,
    code: "ok",
    durationMs: Date.now() - startedAt,
    uploadBytes: file.size,
    textLength: text.length,
  });
  return json({ text }, 200, { "x-request-id": requestId });
}
