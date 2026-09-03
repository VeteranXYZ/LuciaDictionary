const MAX_TEXT_LENGTH = 600;
const MAX_BODY_BYTES = 4 * 1024;
const WORKERS_AI_MODEL = "@cf/meta/m2m100-1.2b";
const UPSTREAM_TIMEOUT_MS = 12000;
const SUPPORTED_LANGUAGES = new Set(["en", "zh-CN"]);

// Workers AI speaks plain ISO codes, not the BCP-47 tags the browser uses.
const AI_LANGUAGE_CODES = { en: "english", "zh-CN": "chinese" };

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

function isCrossSiteRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return true;
  return request.headers.get("sec-fetch-site") === "cross-site";
}

function getNetworkKey(request) {
  const address =
    request.headers.get("cf-connecting-ip")?.trim().toLowerCase() || "";
  if (address && address.length <= 64) return `network:${address}`;
  return "network:unknown";
}

function logTranslateEvent(logger, level, event, details = {}) {
  const method =
    level === "error" ? "error" : level === "warn" ? "warn" : "info";
  logger?.[method]?.(
    JSON.stringify({ service: "lucia-translate", event, ...details }),
  );
}

async function enforceRateLimits(request, env, logger, requestId) {
  const limits = [
    ["TRANSLATE_IP_RATE_LIMITER", getNetworkKey(request)],
    ["TRANSLATE_GLOBAL_RATE_LIMITER", "translate:global"],
  ];

  for (const [bindingName, key] of limits) {
    const limiter = env?.[bindingName];
    if (!limiter?.limit) {
      logTranslateEvent(logger, "error", "rate_limiter_missing", {
        requestId,
        binding: bindingName,
      });
      return { available: false, allowed: false };
    }
    try {
      const outcome = await limiter.limit({ key });
      if (!outcome.success) return { available: true, allowed: false };
    } catch {
      logTranslateEvent(logger, "error", "rate_limiter_failed", {
        requestId,
        binding: bindingName,
      });
      return { available: false, allowed: false };
    }
  }

  return { available: true, allowed: true };
}

async function readBoundedJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return null;
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function translateWithWorkersAi(env, { text, from, to }) {
  const ai = env?.AI;
  if (!ai?.run) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const result = await ai.run(
      WORKERS_AI_MODEL,
      {
        text,
        source_lang: AI_LANGUAGE_CODES[from] || from,
        target_lang: AI_LANGUAGE_CODES[to] || to,
      },
      { signal: controller.signal },
    );
    const translated = String(result?.translated_text || "").trim();
    return translated || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function handleTranslateRequest(request, env, options = {}) {
  const startedAt = Date.now();
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  const logger = options.logger || console;

  const respond = (body, status, headers = {}) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    logTranslateEvent(logger, level, "request_complete", {
      requestId,
      status,
      code: body?.error || "ok",
      durationMs: Date.now() - startedAt,
    });
    return json(body, status, { "x-request-id": requestId, ...headers });
  };

  if (request.method !== "POST")
    return respond({ error: "method_not_allowed" }, 405, { allow: "POST" });
  if (isCrossSiteRequest(request)) return respond({ error: "forbidden" }, 403);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    return respond({ error: "unsupported_media_type" }, 415);

  const rateLimit = await enforceRateLimits(request, env, logger, requestId);
  if (!rateLimit.available)
    return respond({ error: "service_unavailable" }, 503);
  if (!rateLimit.allowed)
    return respond({ error: "too_many_requests" }, 429, {
      "retry-after": "60",
    });

  const body = await readBoundedJson(request);
  if (!body) return respond({ error: "invalid_request" }, 400);

  const text = String(body.text || "").trim();
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!text || text.length > MAX_TEXT_LENGTH)
    return respond({ error: "invalid_request" }, 400);
  if (
    !SUPPORTED_LANGUAGES.has(from) ||
    !SUPPORTED_LANGUAGES.has(to) ||
    from === to
  )
    return respond({ error: "unsupported_language" }, 400);

  const translateImpl = options.translateImpl || translateWithWorkersAi;
  const translated = await translateImpl(env, { text, from, to });
  if (!translated) return respond({ error: "service_unavailable" }, 503);

  logTranslateEvent(logger, "info", "request_complete", {
    requestId,
    status: 200,
    code: "ok",
    durationMs: Date.now() - startedAt,
    // Deliberately records only sizes. The sentence itself is learning content
    // and must never reach the logs.
    inputLength: text.length,
    outputLength: translated.length,
  });
  return json({ text: translated, provider: "workers-ai" }, 200, {
    "x-request-id": requestId,
  });
}
