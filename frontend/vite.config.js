import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const djangoTarget = process.env.DJANGO_URL || "http://127.0.0.1:8000";

export default defineConfig({
  root: frontendDirectory,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: djangoTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest, request) => {
            if (request.headers.origin) {
              proxyRequest.setHeader("origin", djangoTarget);
            }
          });
        },
      },
      "/static": {
        target: djangoTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: fileURLToPath(
      new URL("../deteksi/static/deteksi/frontend", import.meta.url),
    ),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("src/main.jsx", import.meta.url)),
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/app.css",
      },
    },
  },
});
