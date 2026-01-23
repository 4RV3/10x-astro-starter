import type { APIRoute } from 'astro';
// GET /study/due-cards - returns list of due cards for current user (SM-2)

import type { GetDueCardsResponseDTO, StudyCardDTO } from '../../../types.ts';
import { getDueCardsQuerySchema } from '../../../lib/validation/study.schema.ts';
import { getDueCards as getDueCardsService } from '../../../lib/services/study.service.ts';

export const GET: APIRoute = async ({ url, locals }) => {
  const supabase = locals.supabase;

  // Auth: ensure user is present (RLS should still protect, but we return 401 for clarity)
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // Parse and validate query params
  const parsed = getDueCardsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'INVALID_QUERY_PARAMS', message: parsed.error.issues[0]?.message || 'Invalid query' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  const { limit, from_now } = parsed.data as { limit: number; from_now?: string };
  const nowIso = from_now ?? new Date().toISOString();

  try {
    const cards: StudyCardDTO[] = await getDueCardsService(supabase, nowIso, limit);
    const body: GetDueCardsResponseDTO = { cards };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (error) {
    console.error('GET /study/due-cards supabase error', { userId: userData.user.id, error });
    return new Response(
      JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

};
