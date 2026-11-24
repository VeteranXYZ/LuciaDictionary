export const DEFAULT_TIMEOUT_MS = 10000;
export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function fetchJsonWithPolicy(input, init = {}, policy = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const timeoutMs = Math.max(1, Number(policy.timeoutMs || DEFAULT_TIMEOUT_MS));
  const retries =
    method === "GET" ? Math.max(0, Number(policy.retries ?? 1)) : 0;
  const retryDelayMs = Math.max(0, Number(policy.retryDelayMs ?? 250));
  const fetchImpl = policy.fetchImpl || fetch;

  for (let attempt = 0; ; attempt++) {
    init.signal?.throwIfAborted();
    policy.checkAccess?.();
    const controller = new AbortController();
    const abort = () => controller.abort(init.signal.reason);
    init.signal?.addEventListener("abort", abort, { once: true });
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
        await response.body?.cancel();
      } else {
        const text = await response.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (error) {
          if (response.ok) throw error;
        }
        return { ok: response.ok, status: response.status, data };
      }
    } catch (error) {
      if (init.signal?.aborted || attempt >= retries) throw error;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
    await delay(retryDelayMs * (attempt + 1), init.signal);
  }
}
