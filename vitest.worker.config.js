import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// The handlers take their bindings as arguments, so every test supplies its own
// `env`. Running the pool against wrangler.jsonc would instead open a remote
// proxy session for the AI binding, which needs a Cloudflare API token and
// would make these tests non-hermetic. `cf:build` and `cf:types:check` remain
// the checks that the real configuration is valid.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-07-17",
        compatibilityFlags: ["nodejs_compat"],
      },
    }),
  ],
  test: {
    include: ["worker/**/*.worker.test.js"],
  },
});
