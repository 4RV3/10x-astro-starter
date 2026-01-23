import type { APIRoute } from 'astro';
import { login } from '../../../lib/services/auth.service.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const res = await login(locals.supabase, body);
    return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
