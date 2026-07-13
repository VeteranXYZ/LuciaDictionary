import { describe, expect, it, vi } from "vitest";
import { fetchWithPolicy } from "./network.js";

describe("fetchWithPolicy", () => {
  it("retries transient GET failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchWithPolicy(
      "https://example.com/data",
      {},
      { fetchImpl, retries: 1, retryDelayMs: 0 },
    );
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-idempotent requests", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 503 }));
    const response = await fetchWithPolicy(
      "https://example.com/data",
      { method: "POST" },
      { fetchImpl, retries: 3, retryDelayMs: 0 },
    );
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("aborts requests that exceed the timeout", async () => {
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          );
        }),
    );
    await expect(
      fetchWithPolicy(
        "https://example.com/slow",
        {},
        { fetchImpl, retries: 0, timeoutMs: 5 },
      ),
    ).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });
});
