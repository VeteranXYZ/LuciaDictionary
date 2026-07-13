import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/*.worker.test.js",
      "tests/e2e/**",
      "node_modules/**",
      "dist/**",
    ],
  },
});
