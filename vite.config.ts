import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { DEV_DOCUMENT_CSP, DEV_WORKER_CSP } from "./src/shared/csp.ts";

/** The worker needs `blob:` in `script-src`; the document must never get it. */
function contentSecurityPolicy(): Plugin {
  return {
    name: "sculpt-csp",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? "";
        const worker = url.includes("worker_file") || url.includes("/cad/worker");
        response.setHeader("Content-Security-Policy", worker ? DEV_WORKER_CSP : DEV_DOCUMENT_CSP);
        next();
      });
    },
  };
}

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), contentSecurityPolicy()],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    target: "chrome120",
    assetsInlineLimit: 0,
  },
  worker: {
    format: "es",
    rollupOptions: { output: { entryFileNames: "assets/cad-worker-[hash].js" } },
  },
  server: { port: 5273, strictPort: true },
});
