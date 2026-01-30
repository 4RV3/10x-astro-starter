import type { APIRoute } from "astro";
import { getCard, updateCard, deleteCard } from "../../../lib/services/cards.service.ts";
import { cardIdParamSchema } from "../../../lib/validation/cards.schema.ts";

function parseId(url: URL) {
  const match = url.pathname.match(/\/cards\/(.+)$/);
  const id = match?.[1] ?? "";
  const parsed = cardIdParamSchema.safeParse({ id });
  if (!parsed.success)
    throw { status: 400, error: "INVALID_PATH_PARAMS", message: parsed.error.issues[0]?.message || "Invalid id" };
  return parsed.data.id;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const id = parseId(url);
    const card = await getCard(locals.supabase, id);
    return new Response(JSON.stringify(card), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(
      JSON.stringify({ error: e?.error ?? "INTERNAL_SERVER_ERROR", message: e?.message ?? "Unexpected server error" }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};

export const PATCH: APIRoute = async ({ url, request, locals }) => {
  try {
    const id = parseId(url);
    const body = await request.json();
    const card = await updateCard(locals.supabase, id, body);
    return new Response(JSON.stringify(card), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(
      JSON.stringify({ error: e?.error ?? "INTERNAL_SERVER_ERROR", message: e?.message ?? "Unexpected server error" }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  try {
    const id = parseId(url);
    await deleteCard(locals.supabase, id);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(
      JSON.stringify({ error: e?.error ?? "INTERNAL_SERVER_ERROR", message: e?.message ?? "Unexpected server error" }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};
