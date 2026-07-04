import { describe, expect, it } from "vitest";
import { onRequest } from "./_middleware.js";

describe("seo route middleware", () => {
  it("redirects page query variants to the canonical URL", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/?q=apple&utm_source=test"),
      next: () => Promise.resolve(new Response("ok"))
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dict.luciaandrayna.com/");
  });

  it("redirects static page query variants directly to the trailing-slash canonical", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/about?utm_source=test"),
      next: () => Promise.resolve(new Response("ok"))
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dict.luciaandrayna.com/about/");
  });

  it("redirects search route query variants directly to the homepage", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/search?q=apple"),
      next: () => Promise.resolve(new Response("ok"))
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dict.luciaandrayna.com/");
  });

  it("does not redirect asset cache-busting queries", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/favicon.png?v=2.5"),
      next: () => Promise.resolve(new Response("asset"))
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
  });

  it("adds a noindex header to API responses", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/api/ocr"),
      next: () => Promise.resolve(new Response("method_not_allowed", { status: 405 }))
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
