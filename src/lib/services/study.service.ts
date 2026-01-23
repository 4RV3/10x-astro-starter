import type { StudyCardDTO, SubmitReviewResponseDTO } from '../../types.ts';
import { supabaseClient } from '../../db/supabase.client.ts'
import { applySM2 } from './sm2.ts';

type SupabaseClient = typeof supabaseClient

export async function getDueCards(
  supabase: SupabaseClient,
  nowIso: string,
  limit: number,
): Promise<StudyCardDTO[]> {
  const { data, error } = await supabase
    .from('cards')
    .select(
      'id, front, back, source_snippet, ease_factor, interval_days, repetitions, due_at, last_reviewed_at'
    )
    .lte('due_at', nowIso)
    .order('due_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as StudyCardDTO[];
}

export async function submitReview(
  supabase: SupabaseClient,
  cardId: string,
  grade: number,
): Promise<SubmitReviewResponseDTO> {
  // Fetch current SM-2 state
  const { data: card, error: getError } = await supabase
    .from('cards')
    .select('id, ease_factor, interval_days, repetitions')
    .eq('id', cardId)
    .single();
  if (getError || !card) {
    throw { status: 404, error: 'CARD_NOT_FOUND', message: 'Card not found' };
  }

  const now = new Date();
  const next = applySM2(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    grade,
    now,
  );

  const { data: updated, error: updateError } = await supabase
    .from('cards')
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_at: next.due_at,
      last_reviewed_at: next.last_reviewed_at,
    })
    .eq('id', cardId)
    .select('id, ease_factor, interval_days, repetitions, due_at, last_reviewed_at')
    .single();
  if (updateError || !updated) {
    throw { status: 500, error: 'REVIEW_UPDATE_FAILED', message: updateError?.message || 'Failed to update card' };
  }

  return { card: updated as any };
}
