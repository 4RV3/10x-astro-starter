import type { APIRoute } from 'astro';
import { createCard, listCards } from '../../../lib/services/cards.service.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const card = await createCard(locals.supabase, body);
    return new Response(JSON.stringify(card), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const res = await listCards(locals.supabase, Object.fromEntries(url.searchParams.entries()));
    return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
