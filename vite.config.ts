import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { jsoncToJSON } from "./plugins/vite-plugin-jsonc";
import { crossBrowserManifest } from "./plugins/vite-plugin-cross-browser-manifest";
import { playwright } from '@vitest/browser-playwright'

/// <reference types="vitest/config" />
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      input: {
        side_panel: "index.html",
        background: "src/background/background.ts",

      },
      output: {
        entryFileNames: "[name].js",
      },
    },
    outDir: "dist",
  },
  test: {
    projects: [
      {
        test: {
          name: 'node-tests',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.browser.test.ts'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'browser-tests',
          include: ['tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
    ]
  },
  plugins: [
    react(),
    tailwindcss(),
    jsoncToJSON({ filename: "manifest.jsonc" }),
    crossBrowserManifest({ filename: "manifest.json", target: mode }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
