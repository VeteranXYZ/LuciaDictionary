import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: {
    assets: "_a",
    inlineStylesheets: "auto"
  },
  vite: {
    build: {
      minify: "terser",
      terserOptions: {
        mangle: true,
        compress: { drop_console: true }
      }
    }
  }
});
