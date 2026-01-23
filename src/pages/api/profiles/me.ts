import type { APIRoute } from 'astro';
import { getMyProfile, updateMyProfile } from '../../../lib/services/profile.service.ts';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const profile = await getMyProfile(locals.supabase);
    return new Response(JSON.stringify(profile), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const profile = await updateMyProfile(locals.supabase, body);
    return new Response(JSON.stringify(profile), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
