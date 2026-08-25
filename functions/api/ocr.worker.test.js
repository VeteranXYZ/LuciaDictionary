import { describe, expect, it, vi } from "vitest";
import { handleOcrRequest } from "../_shared/ocr-handler.js";

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

function makeEnvironment(overrides = {}) {
  return {
    OCR_SPACE_API_KEY: "test-secret",
    OCR_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    OCR_IP_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    OCR_GLOBAL_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ...overrides,
  };
}

function makeUploadRequest(options = {}) {
  const form = new FormData();
  form.append(
    "file",
    new File([options.bytes || PNG_SIGNATURE], "homework.png", {
      type: options.type || "image/png",
    }),
  );
  return new Request("https://dict.luciaandrayna.com/api/ocr", {
    method: "POST",
    headers: {
      origin: "https://dict.luciaandrayna.com",
      "sec-fetch-site": "same-origin",
      "cf-connecting-ip": "203.0.113.10",
      "x-lucia-client": "12345678-test-client",
    },
    body: form,
  });
}

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("OCR Worker handler", () => {
  it("rejects non-POST and cross-site requests", async () => {
    const getResponse = await handleOcrRequest(
      new Request("https://dict.luciaandrayna.com/api/ocr"),
      makeEnvironment(),
      {
        logger: silentLogger,
      },
    );
    expect(getResponse.status).toBe(405);

    const crossSite = makeUploadRequest();
    crossSite.headers.set("origin", "https://example.com");
    crossSite.headers.set("sec-fetch-site", "cross-site");
    const crossResponse = await handleOcrRequest(crossSite, makeEnvironment(), {
      logger: silentLogger,
    });
    expect(crossResponse.status).toBe(403);
  });

  it("rejects oversized bodies before multipart parsing", async () => {
    const request = new Request("https://dict.luciaandrayna.com/api/ocr", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        "content-length": String(3 * 1024 * 1024),
      },
      body: "--test--",
    });
    const response = await handleOcrRequest(request, makeEnvironment(), {
      logger: silentLogger,
    });
    expect(response.status).toBe(413);
  });

  it("enforces the Cloudflare rate limiter", async () => {
    const environment = makeEnvironment({
      OCR_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
    });
    const response = await handleOcrRequest(makeUploadRequest(), environment, {
      logger: silentLogger,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("enforces a stable network limit before caller-controlled client IDs", async () => {
    const ipLimit = vi.fn(async () => ({ success: false }));
    const clientLimit = vi.fn(async () => ({ success: true }));
    const environment = makeEnvironment({
      OCR_IP_RATE_LIMITER: { limit: ipLimit },
      OCR_RATE_LIMITER: { limit: clientLimit },
    });
    const first = makeUploadRequest();
    first.headers.set("x-lucia-client", "aaaaaaaa-client");
    const second = makeUploadRequest();
    second.headers.set("x-lucia-client", "bbbbbbbb-client");

    expect(
      (await handleOcrRequest(first, environment, { logger: silentLogger }))
        .status,
    ).toBe(429);
    expect(
      (await handleOcrRequest(second, environment, { logger: silentLogger }))
        .status,
    ).toBe(429);
    expect(ipLimit).toHaveBeenNthCalledWith(1, {
      key: "network:203.0.113.10",
    });
    expect(ipLimit).toHaveBeenNthCalledWith(2, {
      key: "network:203.0.113.10",
    });
    expect(clientLimit).not.toHaveBeenCalled();
  });

  it("fails closed when a stable rate limiter binding is unavailable", async () => {
    const environment = makeEnvironment({ OCR_IP_RATE_LIMITER: undefined });
    const response = await handleOcrRequest(makeUploadRequest(), environment, {
      logger: silentLogger,
    });
    expect(response.status).toBe(503);
  });

  it("checks file signatures instead of trusting the MIME type", async () => {
    const response = await handleOcrRequest(
      makeUploadRequest({ bytes: new Uint8Array([1, 2, 3, 4]) }),
      makeEnvironment(),
      {
        logger: silentLogger,
      },
    );
    expect(response.status).toBe(415);
  });

  it("returns only normalized OCR text on success", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        ParsedResults: [{ ParsedText: "Read the passage.\n" }],
        IsErroredOnProcessing: false,
      }),
    );
    const response = await handleOcrRequest(
      makeUploadRequest(),
      makeEnvironment(),
      { fetchImpl, logger: silentLogger },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Read the passage." });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("returns a stable failure when the upstream request fails", async () => {
    const response = await handleOcrRequest(
      makeUploadRequest(),
      makeEnvironment(),
      {
        fetchImpl: vi.fn(async () => {
          throw new Error("network down");
        }),
        logger: silentLogger,
      },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "network_error" });
  });

  it("stops reading oversized upstream bodies without a content-length header", async () => {
    const oversizedBody = JSON.stringify({
      ParsedResults: [{ ParsedText: "x".repeat(300 * 1024) }],
      IsErroredOnProcessing: false,
    });
    const response = await handleOcrRequest(
      makeUploadRequest(),
      makeEnvironment(),
      {
        fetchImpl: vi.fn(
          async () =>
            new Response(oversizedBody, {
              headers: { "content-type": "application/json" },
            }),
        ),
        logger: silentLogger,
      },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "service_unavailable" });
  });
});
