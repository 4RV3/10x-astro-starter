import type { CardDTO, ListCardsResponseDTO, PaginationDTO } from '../../types.ts';
import { createCardCommandSchema, listCardsQuerySchema, updateCardCommandSchema } from '../validation/cards.schema.ts';
import { supabaseClient } from '../../db/supabase.client.ts';

type SupabaseClient = typeof supabaseClient;

export async function createCard(supabase: SupabaseClient, body: unknown): Promise<CardDTO> {
  const parsed = createCardCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid request body' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('cards')
    .insert({
      front: parsed.data.front,
      back: parsed.data.back,
      source_snippet: parsed.data.source_snippet,
      origin: 'manual',
      owner_id: userData.user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw { status: 500, error: 'CARD_CREATE_FAILED', message: error?.message || 'Failed to create card' };
  }

  return data as any;
}

export async function listCards(
  supabase: SupabaseClient,
  query: Record<string, string>,
): Promise<ListCardsResponseDTO> {
  const parsed = listCardsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw { status: 400, error: 'INVALID_QUERY_PARAMS', message: parsed.error.issues[0]?.message || 'Invalid query' };
  }
  const { page, page_size, sort, origin } = parsed.data as any;
  const offset = (page - 1) * page_size;

  let q = supabase.from('cards').select('*', { count: 'exact' });
  if (origin) q = q.eq('origin', origin);
  if (sort === 'created_at_asc') q = q.order('created_at', { ascending: true });
  else if (sort === 'created_at_desc') q = q.order('created_at', { ascending: false });
  else if (sort === 'due_at_asc') q = q.order('due_at', { ascending: true });

  const { data, error, count } = await q.range(offset, offset + page_size - 1);
  if (error) {
    throw { status: 500, error: 'CARD_LIST_FAILED', message: error.message };
  }

  const totalItems = count ?? 0;
  const pagination: PaginationDTO = {
    page,
    page_size,
    total_items: totalItems,
    total_pages: Math.max(1, Math.ceil(totalItems / page_size)),
  };

  return { data: (data ?? []) as any, pagination };
}

export async function getCard(supabase: SupabaseClient, id: string): Promise<CardDTO> {
  const { data, error } = await supabase.from('cards').select('*').eq('id', id).single();
  if (error || !data) {
    throw { status: 404, error: 'CARD_NOT_FOUND', message: 'Card not found' };
  }
  return data as any;
}

export async function updateCard(supabase: SupabaseClient, id: string, body: unknown): Promise<CardDTO> {
  const parsed = updateCardCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid request body' };
  }
  const updateData: Record<string, string> = {};
  if (parsed.data.front != null) updateData.front = parsed.data.front!;
  if (parsed.data.back != null) updateData.back = parsed.data.back!;
  if (parsed.data.source_snippet != null) updateData.source_snippet = parsed.data.source_snippet!;

  const { data, error } = await supabase
    .from('cards')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    const status = (error as any)?.code === 'PGRST116' ? 404 : 500;
    throw { status, error: status === 404 ? 'CARD_NOT_FOUND' : 'CARD_UPDATE_FAILED', message: error?.message || 'Update failed' };
  }

  return data as any;
}

export async function deleteCard(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) {
    const status = (error as any)?.code === 'PGRST116' ? 404 : 500;
    throw { status, error: status === 404 ? 'CARD_NOT_FOUND' : 'CARD_DELETE_FAILED', message: error.message };
  }
}
