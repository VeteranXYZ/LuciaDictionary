import { expect, test } from "@playwright/test";

test("creates local word cards and completes the review loop", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("输入中文或英文课堂句子")
    .fill("Read write draw and solve.");
  await page.getByRole("button", { name: "生成单词卡" }).click();

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

  await page.getByRole("tab", { name: "生词本" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空" }).click();
  await expect(page.locator("#review-all-btn span")).toHaveText("朗读");
  await expect(page.locator("#review-all-btn")).toBeDisabled();
  await expect(page.locator("#export-wb-btn")).toBeDisabled();
  await expect(page.locator("#clear-wb-btn")).toBeDisabled();
  await expect(page.locator("#wb-list")).toContainText("生词本还是空的");

  await page.getByRole("tab", { name: "首页" }).click();
  await expect(page.locator("#word-list .btn-star.active")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "收藏到生词本" })).toHaveCount(
    5,
  );
});

test("turns a classroom sentence into a contextual learning mission", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("输入中文或英文课堂句子")
    .fill("Plants need sunlight and water to grow.");
  await page.getByRole("button", { name: "生成单词卡" }).click();

  const mission = page.locator("#classroom-mission");
  await expect(mission).toContainText("3 分钟课堂小练习");
  await expect(mission).toContainText("这是这句话里的新词");
  await mission.getByRole("button", { name: "开始练习 · 5 个词" }).click();

  for (const [index, word] of [
    "plants",
    "need",
    "water",
    "grow",
    "sunlight",
  ].entries()) {
    const options = mission.locator(".mission-options");
    const correctOption = options.locator(
      `.mission-option[data-word="${word}"]`,
    );
    await correctOption.scrollIntoViewIfNeeded();
    const scrollTop = await page
      .locator(".app")
      .evaluate((app) => app.scrollTop);
    await correctOption.click();
    const next = mission.getByRole("button", {
      name: index === 4 ? "查看学习结果" : "下一题",
    });
    await expect(mission).toContainText(`答对了 · ${word}`);
    await expect(options).toBeHidden();
    await expect(next).toBeFocused();
    await expect
      .poll(() => page.locator(".app").evaluate((app) => app.scrollTop))
      .toBe(scrollTop);

    await expect(next).toBeInViewport();
    await next.click();
  }

  await expect(mission).toContainText("练习完成");
  await expect(mission).toContainText("和孩子再练一句");
  await expect(mission).toContainText("答对 5 / 5 个词");

  await page.getByRole("tab", { name: "生词本" }).click();
  await expect(page.locator("#wb-list .word-card")).toHaveCount(5);
  await expect(page.locator("#wb-list .word-source").first()).toContainText(
    "来自 1 个课堂句子",
  );
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
  await expect(page.locator("#camera-input")).toHaveAccessibleName(
    "拍照识别英文",
  );
  await expect(page.locator("#image-input")).toHaveAccessibleName(
    "从相册选择图片识别英文",
  );

  await page.getByLabel("输入中文或英文课堂句子").fill("Circle the answer.");
  await page.getByRole("button", { name: "生成单词卡" }).click();
  await expect(page.locator("#app-status")).toContainText("已生成 3 张单词卡");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "复制文本" }).click();
  await expect(page.locator("#copy-sentence-label")).toHaveText("已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Circle the answer.",
  );

  await page.getByRole("tab", { name: "设置" }).click();
  await expect(page.getByRole("tab", { name: "设置" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#pg-home")).toBeHidden();
  await expect(page.locator(".settings-info-links a")).toHaveCount(4);
  await expect(page.locator(".settings-info-links")).toContainText("使用指南");
  await page.getByRole("button", { name: "慢速" }).click();
  await expect(page.getByRole("button", { name: "慢速" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("tab", { name: "首页" }).click();
  await page.getByRole("tab", { name: "设置" }).click();
  await expect(page.getByRole("button", { name: "慢速" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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

test("keeps uncertain OCR tokens compact until individually confirmed", async ({
  page,
}) => {
  await page.route("**/api/ocr", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Read the rowe zzzz passage." }),
    }),
  );
  await page.goto("/");
  await page.locator("#image-input").setInputFiles("public/favicon.png");

  await expect(page.locator("#word-list .word-card")).toHaveCount(3);
  await expect(page.locator(".ocr-uncertain")).toContainText(
    "还有 2 个词没查到",
  );
  await expect(page.locator(".ocr-uncertain-chip")).toHaveCount(2);
  await expect(page.locator("#word-list")).not.toContainText("联网查词失败");
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
    await page.getByRole("button", { name: "生成单词卡" }).click();
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
  await expect(page.locator("main#main-content")).toContainText(
    "/api/translate",
  );
  await expect(page.locator("main#main-content")).toContainText("仅离线模式");
  await expect(page.locator("main#main-content")).toContainText("OCR.Space");
  await expect(page.locator("main#main-content")).toContainText("Cloudflare");
});

test("does not load client analytics or set analytics cookies", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.locator(
      'script[src*="googletagmanager.com"], script[src*="google-analytics.com"]',
    ),
  ).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, "dataLayer"))).toBe(
    false,
  );
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "_ga" || cookie.name.startsWith("_ga_"),
    ),
  ).toBe(false);
});

for (const path of ["/how-to/", "/accessibility/", "/search"]) {
  test(`${path} remains retired without redirecting`, async ({
    page,
    baseURL,
  }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    expect(page.url()).toBe(`${baseURL}${path}`);
    await expect(page.locator("main#main-content")).toContainText("页面未找到");
  });
}

test("never sends a classroom sentence straight to a third party", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url() || "http://localhost").origin) {
      external.push(url.origin);
    }
  });

  await page.goto("/");
  external.length = 0;
  await page.getByLabel("输入中文或英文课堂句子").fill("请把答案圈出来");
  await page.getByRole("button", { name: "生成单词卡" }).click();
  await expect(page.locator("#sentence-source")).toBeVisible();

  // The old build called translate.googleapis.com directly from the browser.
  expect(external).not.toContain("https://translate.googleapis.com");
});

test("labels a template substitution instead of silently rewriting the input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("输入中文或英文课堂句子").fill("交上你的家庭作业");
  await page.getByRole("button", { name: "生成单词卡" }).click();

  await expect(page.locator("#sentence-text")).toHaveText(
    "Turn in your homework.",
  );
  await expect(page.locator("#sentence-source")).toContainText("课堂短句库");
});

test("refuses to replace a long sentence with a partial template match", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("输入中文或英文课堂句子")
    .fill("请交上你的家庭作业，然后安静地回到座位上等待");
  await page.getByRole("button", { name: "生成单词卡" }).click();

  // The template covers too little of the input to stand in for it, so the
  // sentence must not silently become "Turn in your homework."
  await expect(page.locator("#sentence-text")).not.toHaveText(
    "Turn in your homework.",
  );
});

test("keeps a classroom phrase as one card instead of splitting it", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("输入中文或英文课堂句子")
    .fill("Please show your work.");
  await page.getByRole("button", { name: "生成单词卡" }).click();

  await expect(
    page.locator('#word-list .word-card[data-word="show your work"]'),
  ).toBeVisible();
  await expect(
    page.locator('#word-list .word-card[data-word="show"]'),
  ).toHaveCount(0);
});

test("offline-only mode stops offering network lookups", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("输入中文或英文课堂句子").fill("The zyxwv machine.");
  await page.getByRole("button", { name: "生成单词卡" }).click();
  const card = page.locator('#word-list .word-card[data-word="zyxwv"]');
  const lookup = card.getByRole("button", { name: "联网查词" });
  await expect(lookup).toBeVisible();
  async function setOffline(value) {
    await page.getByRole("tab", { name: "设置" }).click();
    await page
      .locator(`#offline-only-options [data-offline-only="${value}"]`)
      .click();
    await page.getByRole("tab", { name: "首页" }).click();
  }
  await setOffline(true);
  await expect(card).toContainText("仅离线模式");
  await expect(lookup).toBeHidden();
  await setOffline(false);
  await expect(lookup).toBeVisible();
});

test("marking a review answer updates the card in place", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("输入中文或英文课堂句子").fill("Read and draw.");
  await page.getByRole("button", { name: "生成单词卡" }).click();
  for (const star of await page.locator("#word-list .btn-star").all()) {
    await star.click();
  }

  await page.getByRole("tab", { name: "生词本" }).click();
  const card = page.locator("#wb-list .word-card").first();
  await card.locator(".review-btn.know").click();

  await expect(card.locator(".review-btn.know")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.locator(".review-meta")).toContainText("学习中");
});

test("classroom phrase cards expose the authored practice details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "常用句" }).click();

  const details = page.locator(".tpl-details").first();
  await expect(details).toBeVisible();
  await details.locator("summary").click();
  await expect(details).toContainText("关键词");
  await expect(details).toContainText("可以这样回答");
});

test("the tab bar is one tab stop with arrow-key navigation", async ({
  page,
}) => {
  await page.goto("/");
  const home = page.getByRole("tab", { name: "首页" });
  await home.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("tab", { name: "生词本" })).toBeFocused();
  await expect(page.locator("#pg-wordbook")).toBeVisible();
  await expect(home).toHaveAttribute("tabindex", "-1");
});

for (const useFallback of [false, true]) {
  test(`preserves simultaneous wordbook edits with ${useFallback ? "IndexedDB" : "Web Locks"}`, async ({
    page,
    context,
  }) => {
    if (useFallback) {
      await context.addInitScript(() =>
        Object.defineProperty(navigator, "locks", { value: undefined }),
      );
    }
    const other = await context.newPage();
    async function prepare(tab, word) {
      await tab.goto("/");
      await tab.locator("#sentence-input").fill(word);
      await tab.locator("#go-btn").click();
      await expect(tab.locator("#word-list .btn-star")).toBeVisible();
    }
    await Promise.all([prepare(page, "apple"), prepare(other, "pear")]);
    await Promise.all([
      page.locator("#word-list .btn-star").click(),
      other.locator("#word-list .btn-star").click(),
    ]);
    await page.getByRole("tab", { name: "生词本" }).click();
    await expect(page.locator("#wb-list .word-card")).toHaveCount(2);
    await other.getByRole("tab", { name: "生词本" }).click();
    await Promise.all(
      [page, other].map((tab) =>
        tab.locator('#wb-list [data-word="apple"] .review-btn.know').click(),
      ),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("lucia-wordbook")).find(
              (entry) => entry.w === "apple",
            ).correct,
        ),
      )
      .toBe(2);
    await other.getByRole("tab", { name: "首页" }).click();
    await other.locator("#word-list .btn-star").click();
    await expect(page.locator("#wb-list .word-card")).toHaveCount(1);
    await expect(page.locator("#wb-list .word-en")).toHaveText("apple");
  });
}

test("accepts only one answer to a quiz question", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.25;
    localStorage.setItem(
      "lucia-wordbook",
      JSON.stringify([
        { w: "read", m: "读" },
        { w: "write", m: "写" },
        { w: "draw", m: "画" },
        { w: "swim", m: "游泳" },
      ]),
    );
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "测验" }).click();
  const meaning = await page.locator(".quiz-q strong").textContent();
  const answer = await page.evaluate(
    (m) =>
      JSON.parse(localStorage.getItem("lucia-wordbook")).find((i) => i.m === m)
        .w,
    meaning,
  );
  await page.locator('.quiz-opt[data-word="' + answer + '"]').dblclick();
  await expect(page.locator(".quiz-score")).toContainText("1 / 1");
  expect(
    await page.evaluate(
      (w) =>
        JSON.parse(localStorage.getItem("lucia-wordbook")).find(
          (i) => i.w === w,
        ).reviewHistory.length,
      answer,
    ),
  ).toBe(1);
});

test("allows IME confirmation before submitting the completed sentence", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.locator("#sentence-input");
  await input.fill("pai");
  expect(
    await input.evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    ),
  ).toBe(true);
  await expect(page.locator("#word-list .word-card")).toHaveCount(0);
  await input.fill("在门口排队。");
  await input.press("Enter");
  await expect(page.locator("#sentence-text")).toHaveText(
    "Line up at the door.",
  );
});

test("keeps a previously visited guide available on offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.goto("/guide/");
  const title = await page.title();
  await expect
    .poll(() =>
      page.evaluate(async () => Boolean(await caches.match("/guide/"))),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(title);
});

test("revokes an OCR upload while its photo is being compressed", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...options) {
      window.finishOcrCompression = () =>
        encode.call(this, callback, ...options);
    };
  });
  const uploads = [];
  await page.route("**/api/ocr", (route) => {
    uploads.push(route.request().url());
    return route.fulfill({ json: { text: "Read." } });
  });
  await page.goto("/");
  await page.locator("#image-input").setInputFiles("public/favicon.png");
  await page.waitForFunction(
    () => typeof window.finishOcrCompression === "function",
  );
  await page.getByRole("tab", { name: "设置" }).click();
  await page
    .locator('#offline-only-options [data-offline-only="true"]')
    .click();
  await page.evaluate(() => window.finishOcrCompression());
  await page.getByRole("tab", { name: "首页" }).click();
  await expect(page.locator("#ocr-status")).toContainText("仅离线模式");
  expect(uploads).toEqual([]);
});
