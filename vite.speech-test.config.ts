/**
 * Vite config for the speech-test dev tool.
 *
 * Serves tools/speech-test/index.html at the root.
 * The script src in index.html references /tools/speech-test/main.ts,
 * so we need the project root as the server root (default),
 * with the custom entry configured below.
 */
import { defineConfig } from "vite";

export default defineConfig({
  // Serve from project root so /tools/speech-test/... paths resolve
  root: ".",
  // Use the speech-test page as the default entry
  build: {
    rollupOptions: {
      input: "tools/speech-test/index.html",
    },
  },
  server: {
    // This machine only (audit SEC-07). To test on a phone on the same network, start it with
    // `npm run speech-test -- --host` (Vite's --host flag overrides this for that run only).
    host: "127.0.0.1",
    // Never serve files outside the project; Vite's default deny list (key and dot files, .git) stays.
    fs: { strict: true },
    port: 5174,
    open: "/tools/speech-test/index.html",
    allowedHosts: [".trycloudflare.com"],
  },
});
