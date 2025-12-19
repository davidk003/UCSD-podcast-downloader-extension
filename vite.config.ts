import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { jsoncToJSON } from "./plugins/vite-plugin-jsonc";
import { crossBrowserManifest } from "./plugins/vite-plugin-cross-browser-manifest";

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
  plugins: [
    react(),
    tailwindcss(),
    jsoncToJSON({ filename: "manifest.jsonc"}),
    crossBrowserManifest({ filename: "manifest.json", target: mode }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));