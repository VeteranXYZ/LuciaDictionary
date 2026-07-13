export const DEFAULT_TIMEOUT_MS = 10000;
export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function linkAbortSignal(source, controller) {
  if (!source) return () => {};
  if (source.aborted) {
    controller.abort(source.reason);
    return () => {};
  }
  const abort = () => controller.abort(source.reason);
  source.addEventListener("abort", abort, { once: true });
  return () => source.removeEventListener("abort", abort);
}

export async function fetchWithPolicy(input, init = {}, policy = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const timeoutMs = Math.max(1, Number(policy.timeoutMs || DEFAULT_TIMEOUT_MS));
  const retries =
    method === "GET" ? Math.max(0, Number(policy.retries ?? 1)) : 0;
  const retryDelayMs = Math.max(0, Number(policy.retryDelayMs ?? 250));
  const fetchImpl = policy.fetchImpl || fetch;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const unlink = linkAbortSignal(init.signal, controller);
    const timer = setTimeout(
      () =>
        controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs,
    );

    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
      if (attempt < retries && RETRYABLE_STATUS.has(response.status)) {
        await delay(retryDelayMs * (attempt + 1), init.signal);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (init.signal?.aborted || attempt >= retries) throw error;
      await delay(retryDelayMs * (attempt + 1), init.signal);
    } finally {
      clearTimeout(timer);
      unlink();
    }
  }

  throw lastError || new Error("Network request failed");
}
