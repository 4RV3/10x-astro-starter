import type { APIRoute } from "astro";
import { saveAICardsBatch } from "../../../../lib/services/ai.service.ts";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const res = await saveAICardsBatch(locals.supabase, body);
    return new Response(JSON.stringify(res), { status: 201, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(
      JSON.stringify({ error: e?.error ?? "INTERNAL_SERVER_ERROR", message: e?.message ?? "Unexpected server error" }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};
