import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend",
  base: "/",
  plugins: [react()],
  build: {
    outDir: "../src/review_agent/web",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "static/app.js",
        chunkFileNames: "static/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "static/styles.css";
          }
          return "static/[name][extname]";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "frontend/src/test/setup.ts")],
    css: true,
  },
});
