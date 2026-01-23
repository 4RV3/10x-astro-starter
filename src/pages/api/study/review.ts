import type { APIRoute } from 'astro';
import { submitReview } from '../../../lib/services/study.service.ts';
import { submitReviewCommandSchema } from '../../../lib/validation/study.schema.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const parsed = submitReviewCommandSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid request body' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
    const res = await submitReview(locals.supabase, parsed.data.card_id, parsed.data.grade);
    return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.error ?? 'INTERNAL_SERVER_ERROR', message: e?.message ?? 'Unexpected server error' }), { status, headers: { 'content-type': 'application/json' } });
  }
};
