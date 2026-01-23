import type { AICardProposalDTO, GenerateCardsResponseDTO, SaveAICardsBatchResponseDTO } from '../../types.ts';
import { generateCardsCommandSchema, saveAICardsBatchCommandSchema } from '../validation/ai.schema.ts';
import { supabaseClient } from '../../db/supabase.client.ts';

type SupabaseClient = typeof supabaseClient;

export async function generateCards(
  supabase: SupabaseClient,
  body: unknown,
): Promise<GenerateCardsResponseDTO> {
  const parsed = generateCardsCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid request body' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  const model = import.meta.env.OPENROUTER_MODEL || 'allenai/molmo-2-8b:free';
  if (!apiKey) {
    throw { status: 500, error: 'AI_CONFIG_ERROR', message: 'Missing OpenRouter API key' };
  }

  const prompt = `You are an assistant that creates basic flashcards (front, back, source_snippet) from text. \n` +
    `Return ONLY a JSON object with a 'cards' array where each item has keys front, back, source_snippet. \n` +
    `Use concise phrasing and extract meaningful Q&A. Text: ${parsed.data.input_text}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You create flashcards in JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw { status: 500, error: 'AI_PROVIDER_ERROR', message: text };
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';

  let cards: AICardProposalDTO[] = [];
  try {
    const parsedContent = JSON.parse(content);
    cards = parsedContent.cards ?? [];
  } catch {
    // Try to extract JSON substring if model wrapped it
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { cards = (JSON.parse(match[0])?.cards ?? []) as AICardProposalDTO[]; } catch {}
    }
  }

  // Validate each card shape
  cards = cards.filter((c) => typeof c?.front === 'string' && typeof c?.back === 'string' && typeof c?.source_snippet === 'string')
               .map((c) => ({ front: c.front.trim(), back: c.back.trim(), source_snippet: c.source_snippet.trim() }))
               .filter((c) => c.front && c.back && c.source_snippet);

  return {
    cards,
    model,
    tokens_used: { prompt: json?.usage?.prompt_tokens ?? 0, completion: json?.usage?.completion_tokens ?? 0 },
  };
}

export async function saveAICardsBatch(
  supabase: SupabaseClient,
  body: unknown,
): Promise<SaveAICardsBatchResponseDTO> {
  const parsed = saveAICardsBatchCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid request body' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  // Enforce origin and owner server-side via RPC
  const payload = parsed.data.cards.map((c) => ({ ...c, origin: 'ai' }));
  const { data, error } = await supabase.rpc('insert_cards_batch', { cards: payload as any });
  if (error) {
    throw { status: 500, error: 'CARD_BATCH_SAVE_FAILED', message: error.message };
  }

  // Fetch inserted rows by returned IDs
  const ids = (data ?? []) as string[];
  const { data: rows, error: fetchError } = await supabase.from('cards').select('*').in('id', ids);
  if (fetchError) {
    throw { status: 500, error: 'CARD_BATCH_FETCH_FAILED', message: fetchError.message };
  }

  return { cards: (rows ?? []) as any };
}
