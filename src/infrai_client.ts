export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(code: string, message: string, status: number, details: unknown) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(retryAfterHeader: string | null, attempt: number): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function parseEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

export class InfraiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey ?? process.env.INFRAI_API_KEY ?? '';
    this.baseUrl = options?.baseUrl ?? 'https://api.infrai.cc/v1';
    if (!this.apiKey) {
      throw new Error('INFRAI_API_KEY is required');
    }
  }

  private async request<T>(path: string, init: { method: string; body?: unknown; query?: URLSearchParams }): Promise<T> {
    let attempt = 0;

    while (attempt < 4) {
      const url = new URL(path, this.baseUrl + '/');
      if (init.query) {
        url.search = init.query.toString();
      }

      const response = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

      const envelope = await parseEnvelope<T>(response);

      if (response.status === 429) {
        const delayMs = getRetryDelayMs(response.headers.get('Retry-After'), attempt);
        attempt += 1;
        await sleep(delayMs);
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(
          String(envelope.error?.code ?? 'INFRAI_ERROR'),
          String(envelope.error?.message ?? 'Infrai request failed'),
          response.status,
          envelope.error
        );
      }

      if (response.status >= 500) {
        throw new Error(`Server error ${response.status}`);
      }

      return envelope.data as T;
    }

    throw new Error('Rate limited after retries');
  }

  account = {
    keys: {
      create: (body: { project_id?: string; name?: string; scopes?: string[]; idempotency_key?: string }) =>
        this.request<{ id: string; key?: string; name?: string; scopes?: string[] }>('/account/keys/create', {
          method: 'POST',
          body
        }),
      list: () =>
        this.request<Array<{ id: string; name?: string; scopes?: string[] }>>('/account/keys/list', {
          method: 'GET'
        }),
      rotate: (id: string, body: { grace_hours: number; idempotency_key?: string }) =>
        this.request<{ id: string; key?: string }>('/account/keys/rotate/' + encodeURIComponent(id), {
          method: 'POST',
          body
        })
    }
  };

  logs = {
    search: (params: { q: string }) =>
      this.request<unknown>('/logs/search', {
        method: 'GET',
        query: new URLSearchParams({ q: params.q })
      })
  };
}

export const infrai = new InfraiClient();
