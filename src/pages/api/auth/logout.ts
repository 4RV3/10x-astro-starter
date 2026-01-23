import type { APIRoute } from 'astro';
import { logout } from '../../../lib/services/auth.service.ts';

export const POST: APIRoute = async ({ locals }) => {
  try {
    await logout(locals.supabase);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
