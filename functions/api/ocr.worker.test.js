import { describe, expect, it, vi } from "vitest";
import { handleOcrRequest } from "../_shared/ocr-handler.js";

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

function makeEnvironment(overrides = {}) {
  return {
    OCR_SPACE_API_KEY: "test-secret",
    OCR_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
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
      "x-lucia-client": "12345678-test-client",
    },
    body: form,
  });
}

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("OCR Pages Function in the Workers runtime", () => {
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
});
