import { describe, expect, it } from "vitest";
import { onRequest } from "./_middleware.js";

describe("seo route middleware", () => {
  it("passes page query variants through without redirecting", async () => {
    const response = await onRequest({
      request: new Request(
        "https://dict.luciaandrayna.com/?q=apple&utm_source=test",
      ),
      next: () => Promise.resolve(new Response("ok")),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("ok");
  });

  it.each(["/how-to/", "/accessibility/", "/search"])(
    "leaves retired route %s as a 404",
    async (path) => {
      const response = await onRequest({
        request: new Request(`https://dict.luciaandrayna.com${path}`),
        next: () => Promise.resolve(new Response("not_found", { status: 404 })),
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("adds a noindex header to API responses", async () => {
    const response = await onRequest({
      request: new Request("https://dict.luciaandrayna.com/api/ocr"),
      next: () =>
        Promise.resolve(new Response("method_not_allowed", { status: 405 })),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
