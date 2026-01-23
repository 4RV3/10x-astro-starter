import type { APIRoute } from 'astro';
import { register } from '../../../lib/services/auth.service.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const res = await register(locals.supabase, body);
    return new Response(JSON.stringify(res), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
