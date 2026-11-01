/**
 * Language Lab — Cloudflare Worker
 * Minimal entry point. Provides a health endpoint.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "language-lab-worker",
        timestamp: new Date().toISOString(),
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler;
