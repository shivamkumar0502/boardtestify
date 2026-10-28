import { prepareOCRAssets } from "./ocr-assets.js";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
prepareOCRAssets();
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
});
