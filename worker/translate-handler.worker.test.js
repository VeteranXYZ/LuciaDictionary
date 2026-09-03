import { describe, expect, it, vi } from "vitest";
import { handleTranslateRequest } from "./lib/translate-handler.js";

function makeEnvironment(overrides = {}) {
  return {
    TRANSLATE_IP_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    TRANSLATE_GLOBAL_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ...overrides,
  };
}

function makeRequest(body, init = {}) {
  return new Request("https://dict.luciaandrayna.com/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

function options(translateImpl) {
  return { logger: silentLogger, translateImpl };
}

describe("translate handler", () => {
  it("translates a supported pair through the injected provider", async () => {
    const response = await handleTranslateRequest(
      makeRequest({ text: "完成练习单", from: "zh-CN", to: "en" }),
      makeEnvironment(),
      options(async () => "Complete the worksheet."),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      text: "Complete the worksheet.",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects anything but POST", async () => {
    const response = await handleTranslateRequest(
      new Request("https://dict.luciaandrayna.com/api/translate"),
      makeEnvironment(),
      options(async () => "x"),
    );
    expect(response.status).toBe(405);
  });

  it("rejects cross-site callers so the endpoint is not a free proxy", async () => {
    const response = await handleTranslateRequest(
      makeRequest(
        { text: "hi", from: "en", to: "zh-CN" },
        { headers: { origin: "https://example.com" } },
      ),
      makeEnvironment(),
      options(async () => "x"),
    );
    expect(response.status).toBe(403);
  });

  it("rejects unsupported and identical language pairs", async () => {
    for (const pair of [
      { from: "en", to: "fr" },
      { from: "en", to: "en" },
    ]) {
      const response = await handleTranslateRequest(
        makeRequest({ text: "hi", ...pair }),
        makeEnvironment(),
        options(async () => "x"),
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects oversized input instead of forwarding it", async () => {
    const response = await handleTranslateRequest(
      makeRequest({ text: "a".repeat(601), from: "en", to: "zh-CN" }),
      makeEnvironment(),
      options(async () => "x"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 429 when the rate limiter says no", async () => {
    const response = await handleTranslateRequest(
      makeRequest({ text: "hi", from: "en", to: "zh-CN" }),
      makeEnvironment({
        TRANSLATE_IP_RATE_LIMITER: {
          limit: async () => ({ success: false }),
        },
      }),
      options(async () => "x"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("fails closed when a rate limiter binding is missing", async () => {
    const response = await handleTranslateRequest(
      makeRequest({ text: "hi", from: "en", to: "zh-CN" }),
      makeEnvironment({ TRANSLATE_GLOBAL_RATE_LIMITER: undefined }),
      options(async () => "x"),
    );
    expect(response.status).toBe(503);
  });

  it("reports service_unavailable when the provider returns nothing", async () => {
    const response = await handleTranslateRequest(
      makeRequest({ text: "hi", from: "en", to: "zh-CN" }),
      makeEnvironment(),
      options(async () => null),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "service_unavailable",
    });
  });

  it("never writes the sentence into the logs", async () => {
    const lines = [];
    const logger = {
      info: (line) => lines.push(line),
      warn: (line) => lines.push(line),
      error: (line) => lines.push(line),
    };
    await handleTranslateRequest(
      makeRequest({ text: "秘密的课堂句子", from: "zh-CN", to: "en" }),
      makeEnvironment(),
      { logger, translateImpl: async () => "a secret classroom sentence" },
    );

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain("秘密的课堂句子");
      expect(line).not.toContain("a secret classroom sentence");
    }
  });
});
