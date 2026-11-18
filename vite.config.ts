import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Lets a phone reach the dev server through a Cloudflare quick tunnel (the microphone needs HTTPS).
  server: { allowedHosts: [".trycloudflare.com"] },
  test: {
    globals: false,
    // CSS files are empty in tests, except when a test reads one as raw text (?raw).
    css: { include: [/\?raw/] },
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tools/**/*.test.ts",
    ],
  },
});
