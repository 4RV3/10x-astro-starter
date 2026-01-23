# Usługa OpenRouter — przewodnik implementacji (Astro 5 / TypeScript 5 / React 19)

## 1. Opis usługi

Usługa OpenRouter integruje API OpenRouter (chat completions) z aplikacją Astro, dostarczając warstwę serwisową do uzupełniania czatów LLM (request/response oraz streaming SSE). Zapewnia: konfigurację modelu i parametrów, budowę wiadomości (system/user/assistant), ustrukturyzowane odpowiedzi (response_format z JSON Schema), walidację wejścia/wyjścia, obsługę błędów oraz bezpieczne przechowywanie klucza API.

Dostosowanie do stacku: Astro 5 (SSR, Server Endpoints w `src/pages/api`), TypeScript 5 (silne typy), React 19 (UI warstwa kliencka), Tailwind 4 i shadcn/ui (prezentacja), Zod (walidacja), Supabase (opcjonalnie kontekst auth/logów przez `context.locals`).

## 2. Opis konstruktora

```ts
export type ModelParams = {
  temperature?: number; // 0–2 (zależnie od modelu)
  top_p?: number;       // 0–1
  max_tokens?: number;  // limit odpowiedzi
  presence_penalty?: number;
  frequency_penalty?: number;
};

export type ResponseFormatSchema = {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>; // JSON Schema object
  };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

export type CompletionOptions = {
  model?: string;
  params?: ModelParams;
  response_format?: ResponseFormatSchema;
  stream?: boolean;
  signal?: AbortSignal; // do obsługi timeoutów/anulowania
};

export class OpenRouterService {
  constructor(private cfg: {
    apiKey?: string;            // domyślnie: import.meta.env.OPENROUTER_API_KEY
    baseUrl?: string;           // domyślnie: 'https://openrouter.ai/api/v1'
    defaultModel?: string;      // np. 'anthropic/claude-3.5-sonnet'
    defaultParams?: ModelParams;
    fetchImpl?: typeof fetch;   // do testów: nadpisanie global fetch
  }) {}
}
```

## 3. Publiczne metody i pola

```ts
class OpenRouterService {
  // Pola publiczne (readonly getters):
  get baseUrl(): string { /* ... */ }
  get defaultModel(): string { /* ... */ }
  get defaultParams(): ModelParams { /* ... */ }

  // Metody publiczne:
  async completeChat(messages: ChatMessage[], options?: CompletionOptions)
    : Promise<{ text: string; raw: unknown; structured?: unknown }>; // text + pełny JSON + ewentualny obiekt zgodny ze schematem

  async streamChat(messages: ChatMessage[], options?: CompletionOptions & { onToken: (t: string) => void; onDone?: () => void; onError?: (e: unknown) => void; })
    : Promise<void>; // SSE/stream cząstkowych tokenów

  setDefaultModel(model: string): void;
  setDefaultParams(params: ModelParams): void;
}
```

Przykłady elementów wymaganych przez OpenRouter API:

1) Komunikat systemowy (ustawia zasady i kontekst modelu):
```ts
const system: ChatMessage = {
  role: 'system',
  content: 'Jesteś pomocnym asystentem. Odpowiadaj zwięźle i zgodnie ze schematem jeśli podano response_format.'
};
```

2) Komunikat użytkownika:
```ts
const user: ChatMessage = {
  role: 'user',
  content: 'Wygeneruj specyfikację produktu: nazwa, cechy, cena.'
};
```

3) Ustrukturyzowane odpowiedzi przez `response_format` (JSON Schema):
```ts
const response_format: ResponseFormatSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'ProductSpec',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1 },
        features: { type: 'array', items: { type: 'string' } },
        price: { type: 'number', minimum: 0 }
      },
      required: ['name','features','price']
    }
  }
};
```

4) Nazwa modelu:
```ts
const modelName = 'anthropic/claude-3.5-sonnet';
```

5) Parametry modelu:
```ts
const params: ModelParams = { temperature: 0.2, top_p: 0.9, max_tokens: 512 };
```

Wywołanie:
```ts
const res = await openRouter.completeChat([system, user], { model: modelName, params, response_format });
console.log(res.structured ?? res.text);
```

## 4. Prywatne metody i pola

```ts
class OpenRouterService {
  private readonly apiKey = this.cfg.apiKey ?? import.meta.env.OPENROUTER_API_KEY;
  private readonly _fetch: typeof fetch = this.cfg.fetchImpl ?? fetch;
  private readonly _baseUrl = this.cfg.baseUrl ?? 'https://openrouter.ai/api/v1';
  private _defaultModel = this.cfg.defaultModel ?? 'openai/gpt-4o-mini';
  private _defaultParams: ModelParams = this.cfg.defaultParams ?? { temperature: 0.2, max_tokens: 512 };

  private makeHeaders() {
    if (!this.apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': '10x Astro Starter',
      'Accept': 'application/json'
    } as const;
  }

  private validateParams(p?: ModelParams): ModelParams {
    // Proste gardy: zakresy, typy, domyślne
    const m = { ...this._defaultParams, ...(p ?? {}) };
    if (m.temperature != null && (m.temperature < 0 || m.temperature > 2)) throw new Error('Invalid temperature');
    if (m.top_p != null && (m.top_p < 0 || m.top_p > 1)) throw new Error('Invalid top_p');
    if (m.max_tokens != null && m.max_tokens <= 0) throw new Error('Invalid max_tokens');
    return m;
  }

  private buildPayload(messages: ChatMessage[], opt?: CompletionOptions) {
    const model = opt?.model ?? this._defaultModel;
    const params = this.validateParams(opt?.params);
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
    };
    if (opt?.response_format) body.response_format = opt.response_format;
    if (opt?.stream) body.stream = true;
    return JSON.stringify(body);
  }

  private async handleResponse(resp: Response, response_format?: ResponseFormatSchema) {
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`OpenRouter error ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    // OpenRouter zwraca format zbliżony do OpenAI: choices[0].message.content
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    let structured: unknown;
    if (response_format?.json_schema?.strict) {
      // Model zwykle zwraca JSON; spróbuj sparsować
      try { structured = text ? JSON.parse(text) : undefined; } catch {}
    }
    return { text, raw: json, structured };
  }

  async completeChat(messages: ChatMessage[], opt?: CompletionOptions) {
    const url = `${this._baseUrl}/chat/completions`;
    const payload = this.buildPayload(messages, opt);
    const resp = await this._fetch(url, { method: 'POST', headers: this.makeHeaders(), body: payload, signal: opt?.signal });
    return this.handleResponse(resp, opt?.response_format);
  }

  async streamChat(messages: ChatMessage[], opt?: CompletionOptions & { onToken: (t: string) => void; onDone?: () => void; onError?: (e: unknown) => void; }) {
    const url = `${this._baseUrl}/chat/completions`;
    const payload = this.buildPayload(messages, { ...opt, stream: true });
    const resp = await this._fetch(url, { method: 'POST', headers: this.makeHeaders(), body: payload, signal: opt?.signal });
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`OpenRouter stream error ${resp.status}: ${txt}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parsowanie SSE: linie zaczynające się od "data:"
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') { opt.onDone?.(); return; }
            try {
              const json = JSON.parse(data);
              const token: string = json?.choices?.[0]?.delta?.content ?? '';
              if (token) opt.onToken(token);
            } catch (e) { /* ignoruj nieparsowalne fragmenty */ }
          }
        }
      }
      opt.onDone?.();
    } catch (e) {
      opt.onError?.(e);
      throw e;
    } finally {
      reader.releaseLock();
    }
  }
}
```

## 5. Obsługa błędów

Scenariusze i działania:

1) Brak/niepoprawny klucz API (401):
- Sprawdź `import.meta.env.OPENROUTER_API_KEY`; rzuć błąd na starcie (guard w `makeHeaders`).

2) Rate limit / quota (429):
- Retry z backoff (exponential), logowanie zdarzenia (bez treści promptu), komunikat user-friendly.

3) Nieprawidłowy model (404/400):
- Walidacja modelu względem listy dozwolonej; fallback do domyślnego.

4) Nieprawidłowe parametry (400):
- `validateParams` (zakresy), zwróć błąd z komunikatem.

5) Timeout/anulowanie:
- Użyj `AbortController`; propaguj `signal` do fetch; zwróć błąd kontrolowany.

6) Błąd sieci/parsowania JSON:
- Try/catch w `handleResponse`; zwróć opis i status; w structured parse zabezpiecz JSON.parse.

7) Błąd strumienia (SSE) / przerwanie:
- Eventy `onError`, `onDone`; bezpieczne domknięcie readera.

8) Przekroczenie limitu tokenów:
- Sygnalizuj w UI; umożliwiaj zmniejszenie `max_tokens`/`temperature`.

9) Błędy dostawcy (wewnętrzne 5xx):
- Retry ograniczony; wyświetl informację bez szczegółów wrażliwych.

## 6. Kwestie bezpieczeństwa

- Przechowywanie sekretów: `OPENROUTER_API_KEY` tylko po stronie serwera (Astro SSR), nigdy w kodzie klienckim.
- Redakcja logów: nie loguj pełnych promptów ani odpowiedzi zawierających dane osobowe; stosuj maskowanie.
- Ochrona przed prompt injection: mocny komunikat systemowy, użycie `response_format.strict`, walidacja i odrzucanie danych niezgodnych ze schematem.
- Walidacja wejścia (Zod) dla endpointów; ogranicz długość treści requestu.
- Rate limiting/DoS: wprowadź per-IP/per-user limity (np. przez middleware/murę w Supabase lub edge proxy).
- CSP i nagłówki: dodaj `X-Title`, `Content-Security-Policy` w serwowaniu UI; nie ujawniaj klucza w kliencie.

## 7. Plan wdrożenia krok po kroku

1) Konfiguracja środowiska
- Dodaj do `.env`: `OPENROUTER_API_KEY="<sekret>"`.
- Upewnij się, że Astro wczytuje zmienne środowiskowe (import.meta.env) i nie ekspotuje ich do klienta.

2) Typy i foldery
- Używaj standardowej struktury: `src/lib/services` dla serwisu; `src/pages/api` dla endpointów.
- Dodaj powyższe typy (`ModelParams`, `ChatMessage`, `ResponseFormatSchema`) w `src/types.ts` lub lokalnie w serwisie.

3) Implementacja serwisu
- Utwórz `src/lib/services/openrouter.service.ts` z klasą `OpenRouterService` jak wyżej.
- Zaimplementuj metody `completeChat` i `streamChat` oraz prywatne gardy/parsowanie.

4) Endpoint API (Astro Server Endpoint)
```ts
// src/pages/api/openrouter.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { OpenRouterService } from '@/lib/services/openrouter.service';

export const prerender = false;

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system','user','assistant','tool']),
    content: z.string().min(1)
  })),
  model: z.string().optional(),
  params: z.object({ temperature: z.number().min(0).max(2).optional(), top_p: z.number().min(0).max(1).optional(), max_tokens: z.number().min(1).optional() }).optional(),
  response_format: z.object({
    type: z.literal('json_schema'),
    json_schema: z.object({ name: z.string(), strict: z.literal(true), schema: z.record(z.unknown()) })
  }).optional(),
  stream: z.boolean().optional()
});

export const POST: APIRoute = async ({ request }) => {
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), { status: 400 });
  const svc = new OpenRouterService({});
  const { messages, ...opt } = parsed.data;
  try {
    if (opt.stream) {
      // Opcjonalnie: przekierować na stream SSE
      const ctrl = new AbortController();
      const chunks: string[] = [];
      await svc.streamChat(messages, { ...opt, signal: ctrl.signal, onToken: (t) => chunks.push(t) });
      return new Response(chunks.join(''));
    }
    const res = await svc.completeChat(messages, opt);
    return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'OpenRouter failure', details: String(e) }), { status: 502 });
  }
};
```

5) Integracja UI (React 19)
- Utwórz komponent formularza (shadcn/ui) wysyłający POST do `/api/openrouter`.
- Dla streamingu użyj `ReadableStream`/EventSource lub progresywnych aktualizacji w React.
- Zadbaj o ARIA (role, aria-live dla aktualizacji strumienia).

6) Testy i walidacja
- Testy jednostkowe serwisu: mock `fetchImpl`; scenariusze błędów (401/429/timeout/parsowanie JSON).
- Testy e2e endpointu: walidacja Zod, poprawność odpowiedzi.

7) Logowanie i monitorowanie
- Dodaj redakcję wrażliwych pól; status/kody odpowiedzi; metryki czasu.
- Opcjonalnie loguj do Supabase (context.locals) bez promptów.

8) Bezpieczeństwo i limity
- Rate limit per-IP; ochrona przed nadużyciem.
- Przegląd CSP/nagłówków; brak ekspozycji klucza do klienta.

9) Konfiguracja modeli i parametrów
- W serwisie: `setDefaultModel()` i `setDefaultParams()`; whitelist dostępnych modeli.
- UI: selektor modeli; podpowiedzi zakresów parametrów.

10) Przykładowe wywołanie end-to-end
```ts
// Klient: wysłanie żądania z response_format
await fetch('/api/openrouter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'Zwróć wyłącznie poprawny JSON zgodny ze schematem.' },
      { role: 'user', content: 'Opisz produkt: name, features[], price.' }
    ],
    model: 'anthropic/claude-3.5-sonnet',
    params: { temperature: 0.2, max_tokens: 512 },
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ProductSpec',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } },
            price: { type: 'number', minimum: 0 }
          },
          required: ['name','features','price']
        }
      }
    }
  })
});
```

---

Ten przewodnik zapewnia minimalne, bezpieczne i rozszerzalne wdrożenie usługi OpenRouter w środowisku Astro/TypeScript z pełnym wsparciem dla system/user message, response_format, nazwy modelu i parametrów modelu, wraz z obsługą błędów i streamingiem.