import type { APIRoute } from 'astro';
import { me } from '../../../lib/services/auth.service.ts';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const res = await me(locals.supabase);
    return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
