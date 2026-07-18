import { describe, expect, it } from "vitest";
import worker from "./index.js";

describe("dictionary Worker routes", () => {
  it("keeps API responses out of search indexes", async () => {
    const response = await worker.fetch(
      new Request("https://dict.luciaandrayna.com/api/ocr"),
      {},
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not turn retired paths into application fallbacks", async () => {
    const response = await worker.fetch(
      new Request("https://dict.luciaandrayna.com/retired-route/"),
      {},
    );

    expect(response.status).toBe(404);
  });
});
