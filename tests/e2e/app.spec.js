import { expect, test } from "@playwright/test";

test("creates local word cards and completes the review loop", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("输入中文或英文课堂句子")
    .fill("Read write draw and solve.");
  await page.getByRole("button", { name: "翻译并学习" }).click();

  const cards = page.locator("#word-list .word-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.first().locator(".word-level")).toBeVisible();

  for (const star of await cards.locator(".btn-star").all()) await star.click();
  await page.getByRole("tab", { name: "生词本" }).click();
  await expect(page.locator("#wb-list .word-card")).toHaveCount(5);
  await expect(page.locator("#wb-stats")).toContainText("今日复习");

  await page.locator("#wb-list .review-btn.know").first().click();
  await expect(page.locator("#wb-list .review-meta").first()).toContainText(
    /学习中|新词/,
  );

  await page.getByRole("tab", { name: "测验" }).click();
  await expect(page.locator(".quiz-opt")).toHaveCount(4);
});

test("exposes accessible navigation and announces dynamic results", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main#main-content")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "主要功能" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "首页" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByLabel("输入中文或英文课堂句子").fill("Circle the answer.");
  await page.getByRole("button", { name: "翻译并学习" }).click();
  await expect(page.locator("#app-status")).toContainText("已生成 3 张单词卡");

  await page.getByRole("tab", { name: "设置" }).click();
  await expect(page.getByRole("tab", { name: "设置" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#pg-home")).toBeHidden();
});

test("handles OCR through the same-origin endpoint", async ({ page }) => {
  await page.route("**/api/ocr", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Read the passage." }),
    }),
  );
  await page.goto("/");
  await page.locator("#image-input").setInputFiles("public/favicon.png");
  await expect(page.getByLabel("输入中文或英文课堂句子")).toHaveValue(
    "Read the passage.",
  );
  await expect(page.locator("#word-list .word-card")).toHaveCount(3);
});

test("starts and analyzes a local sentence while offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const cache = keys.find((key) => key.startsWith("lucia-local-core-"));
        if (!cache) return 0;
        return (await (await caches.open(cache)).keys()).length;
      }),
    )
    .toBeGreaterThan(10);
  await context.setOffline(true);
  try {
    await page.reload();

    await expect(page.getByLabel("输入中文或英文课堂句子")).toBeVisible();
    await page.getByLabel("输入中文或英文课堂句子").fill("Read the book.");
    await page.getByRole("button", { name: "翻译并学习" }).click();
    await expect(page.locator("#word-list .word-card")).toHaveCount(3);
  } finally {
    await context.setOffline(false);
  }
});

test("documents every optional network data flow", async ({ page }) => {
  await page.goto("/privacy/");
  await expect(page.locator("main#main-content")).toContainText(
    "dictionaryapi.dev",
  );
  await expect(page.locator("main#main-content")).toContainText("Google");
  await expect(page.locator("main#main-content")).toContainText("OCR.Space");
  await expect(page.locator("main#main-content")).toContainText("Cloudflare");
});
