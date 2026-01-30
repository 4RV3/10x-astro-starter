import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const body = { status: "ok", timestamp: new Date().toISOString() };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
