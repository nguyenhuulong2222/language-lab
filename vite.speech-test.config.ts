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
    // Bind to all interfaces so phones on the same network can reach it
    host: "0.0.0.0",
    port: 5174,
    open: "/tools/speech-test/index.html",
  },
});
