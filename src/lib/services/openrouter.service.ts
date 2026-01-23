/*
  OpenRouterService
  Implements chat completions (request + streaming) with robust typing, validation, and error handling.
  Note: Ensure OPENROUTER_API_KEY is set server-side (import.meta.env). Never expose it to the client.
*/

export type ModelParams = {
  temperature?: number; // 0–2
  top_p?: number;       // 0–1
  max_tokens?: number;  // > 0
  presence_penalty?: number;
  frequency_penalty?: number;
};

export type ResponseFormatSchema = {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
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
  signal?: AbortSignal;
};

export class OpenRouterService {
  constructor(private cfg: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    defaultParams?: ModelParams;
    fetchImpl?: typeof fetch; // dependency injection for tests
  }) {}

  // Private configuration
  private readonly apiKey = this.cfg.apiKey ?? (import.meta as any)?.env?.OPENROUTER_API_KEY;
  private readonly _fetch: typeof fetch = this.cfg.fetchImpl ?? fetch;
  private readonly _baseUrl = this.cfg.baseUrl ?? 'https://openrouter.ai/api/v1';
  private _defaultModel = this.cfg.defaultModel ?? 'openai/gpt-4o-mini';
  private _defaultParams: ModelParams = this.cfg.defaultParams ?? { temperature: 0.2, max_tokens: 512 };

  // Public readonly getters
  get baseUrl(): string { return this._baseUrl; }
  get defaultModel(): string { return this._defaultModel; }
  get defaultParams(): ModelParams { return this._defaultParams; }

  // Public setters
  setDefaultModel(model: string): void {
    if (!model || typeof model !== 'string') throw new Error('Model name must be a non-empty string');
    this._defaultModel = model;
  }
  setDefaultParams(params: ModelParams): void {
    this._defaultParams = this.validateParams(params);
  }

  // Public API: non-streaming completion
  async completeChat(
    messages: ChatMessage[],
    opt?: CompletionOptions
  ): Promise<{ text: string; raw: unknown; structured?: unknown }> {
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array');
    const url = `${this._baseUrl}/chat/completions`;
    const payload = this.buildPayload(messages, opt);
    const init: RequestInit = { method: 'POST', headers: this.makeHeaders(), body: payload, signal: opt?.signal };
    return this.requestJsonWithRetry(url, init, opt?.response_format);
  }

  // Public API: streaming completion via SSE-like response
  async streamChat(
    messages: ChatMessage[],
    opt?: CompletionOptions & { onToken: (t: string) => void; onDone?: () => void; onError?: (e: unknown) => void; }
  ): Promise<void> {
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array');
    if (!opt?.onToken) throw new Error('onToken callback is required for streaming');

    const url = `${this._baseUrl}/chat/completions`;
    const payload = this.buildPayload(messages, { ...opt, stream: true });
    const init: RequestInit = { method: 'POST', headers: this.makeHeaders(), body: payload, signal: opt?.signal };

    const resp = await this.fetchWithRetry(url, init);
    if (!resp.ok || !resp.body) {
      const txt = await safeReadText(resp).catch(() => '');
      throw new Error(`OpenRouter stream error ${resp.status}: ${txt}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') { opt.onDone?.(); return; }
          try {
            const json = JSON.parse(data);
            const token: string = json?.choices?.[0]?.delta?.content ?? '';
            if (token) opt.onToken(token);
          } catch {
            // ignore non-JSON fragments
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

  // Private helpers
  private makeHeaders() {
    if (!this.apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': '10x Astro Starter',
      Accept: 'application/json'
    } as const;
  }

  private validateParams(p?: ModelParams): ModelParams {
    const m = { ...this._defaultParams, ...(p ?? {}) };
    if (m.temperature != null && (m.temperature < 0 || m.temperature > 2)) throw new Error('Invalid temperature');
    if (m.top_p != null && (m.top_p < 0 || m.top_p > 1)) throw new Error('Invalid top_p');
    if (m.max_tokens != null && m.max_tokens <= 0) throw new Error('Invalid max_tokens');
    return m;
  }

  private buildPayload(messages: ChatMessage[], opt?: CompletionOptions) {
    const model = opt?.model || this._defaultModel;
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
      const txt = await safeReadText(resp).catch(() => '');
      throw new Error(`OpenRouter error ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    let structured: unknown;
    if (response_format?.json_schema?.strict) {
      try { structured = text ? JSON.parse(text) : undefined; } catch { /* ignore parse error */ }
    }
    return { text, raw: json, structured };
  }

  // Retry wrappers
  private isTransient(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600);
  }

  private async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3, baseDelayMs = 250): Promise<Response> {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const resp = await this._fetch(url, init);
        if (!resp.ok && this.isTransient(resp.status) && attempt < maxAttempts) {
          await sleep(baseDelayMs * Math.pow(2, attempt - 1));
          continue;
        }
        return resp;
      } catch (e) {
        if (attempt >= maxAttempts) throw e;
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  private async requestJsonWithRetry(url: string, init: RequestInit, response_format?: ResponseFormatSchema) {
    const resp = await this.fetchWithRetry(url, init);
    return this.handleResponse(resp, response_format);
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try { return await resp.text(); } catch { return ''; }
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}
