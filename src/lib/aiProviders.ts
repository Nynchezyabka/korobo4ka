/**
 * Реестр ИИ-сервисов, работающих по OpenAI-совместимому протоколу.
 * Добавление нового сервиса = одна запись в PROVIDERS.
 *
 * Ключ пользователя хранится ТОЛЬКО в localStorage этого устройства
 * и на сервер приложения никогда не отправляется.
 */

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;
  /** Префиксы ключа, по которым сервис определяется в первую очередь */
  prefixes: string[];
  /** Поддерживает ли strict json_schema в response_format */
  jsonSchema: boolean;
  /** Дополнительные заголовки */
  headers?: Record<string, string>;
  /** Модели по умолчанию, если /models недоступен */
  fallbackModels?: string[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    prefixes: ["sk-or-"],
    jsonSchema: true,
    headers: { "HTTP-Referer": "https://korobo4ka.lovable.app", "X-Title": "Korobochka" },
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    prefixes: ["sk-"],
    jsonSchema: false,
    fallbackModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    prefixes: ["sk-proj-", "sk-svcacct-", "sk-"],
    jsonSchema: true,
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    prefixes: ["gsk_"],
    jsonSchema: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    prefixes: [],
    jsonSchema: false,
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    prefixes: ["AIza"],
    jsonSchema: true,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    prefixes: ["csk-"],
    jsonSchema: true,
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    prefixes: [],
    jsonSchema: true,
  },
];

export const CUSTOM_PROVIDER: ProviderDef = {
  id: "custom",
  name: "Свой адрес (локальная модель)",
  baseUrl: "",
  prefixes: [],
  jsonSchema: false,
};

// ---------- storage ----------

const KEY_STORE = "ai_user_key";

export interface UserAiConfig {
  key: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  jsonSchema: boolean;
  model: string;
  models: string[];
}

export function loadAiConfig(): UserAiConfig | null {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg?.key && cfg?.baseUrl && cfg?.model) return cfg as UserAiConfig;
  } catch { /* ignore */ }
  return null;
}

export function saveAiConfig(cfg: UserAiConfig) {
  localStorage.setItem(KEY_STORE, JSON.stringify(cfg));
}

export function clearAiConfig() {
  localStorage.removeItem(KEY_STORE);
}

// ---------- detection ----------

export function providerHeaders(p: { headers?: Record<string, string> }, key: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...(p.headers ?? {}),
  };
}

export function humanError(status: number, fallback = "Сервис недоступен"): string {
  if (status === 401 || status === 403) return "Ключ неверный или не даёт доступа";
  if (status === 402) return "На ключе закончились средства";
  if (status === 429) return "Слишком много запросов — подождите немного";
  if (status === 404) return "Выбранная модель недоступна на этом сервисе";
  if (status >= 500) return "Сервис временно недоступен";
  return fallback;
}

async function fetchModels(baseUrl: string, key: string, extra?: Record<string, string>) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: providerHeaders({ headers: extra }, key),
  });
  if (!res.ok) return { ok: false as const, status: res.status };
  const data = await res.json().catch(() => null);
  const list: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => String(m?.id ?? "")).filter(Boolean)
    : Array.isArray(data?.models)
      ? data.models.map((m: any) => String(m?.id ?? m?.name ?? "")).filter(Boolean)
      : [];
  return { ok: true as const, models: list.sort() };
}

export interface DetectResult {
  provider: ProviderDef;
  models: string[];
}

/**
 * Определяет сервис по ключу: сначала кандидаты по префиксу, затем остальные.
 * Первый сервис, который ответил 200 на GET /models, считается верным.
 */
export async function detectProvider(
  key: string,
  customBaseUrl?: string,
): Promise<{ ok: true; result: DetectResult } | { ok: false; error: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "Введите ключ" };

  if (customBaseUrl?.trim()) {
    const provider = { ...CUSTOM_PROVIDER, baseUrl: customBaseUrl.trim().replace(/\/$/, "") };
    const r = await fetchModels(provider.baseUrl, trimmed).catch(() => null);
    if (!r) return { ok: false, error: "Не удалось связаться с указанным адресом" };
    if (!r.ok) return { ok: false, error: humanError(r.status) };
    return { ok: true, result: { provider, models: r.models } };
  }

  const byPrefix = PROVIDERS.filter((p) => p.prefixes.some((pre) => trimmed.startsWith(pre)));
  const rest = PROVIDERS.filter((p) => !byPrefix.includes(p));
  const candidates = [...byPrefix, ...rest];

  let lastStatus = 0;
  for (const p of candidates) {
    try {
      const r = await fetchModels(p.baseUrl, trimmed, p.headers);
      if (r.ok) {
        const models = r.models.length ? r.models : (p.fallbackModels ?? []);
        if (!models.length) continue;
        return { ok: true, result: { provider: p, models } };
      }
      lastStatus = r.status;
      // 401/403 — ключ не от этого сервиса, пробуем следующий
    } catch { /* сеть/CORS — пробуем следующий */ }
  }

  return {
    ok: false,
    error: lastStatus
      ? humanError(lastStatus, "Не удалось определить сервис по этому ключу")
      : "Не удалось определить сервис по этому ключу",
  };
}

/** Разумная модель по умолчанию из списка. */
export function pickDefaultModel(providerId: string, models: string[]): string {
  const prefer: Record<string, string[]> = {
    deepseek: ["deepseek-chat"],
    openrouter: ["deepseek/deepseek-chat", "openai/gpt-4o-mini", "google/gemini-flash-1.5"],
    openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    mistral: ["mistral-small-latest", "mistral-large-latest"],
    google: ["gemini-2.0-flash", "gemini-1.5-flash"],
  };
  for (const want of prefer[providerId] ?? []) {
    const hit = models.find((m) => m === want) ?? models.find((m) => m.includes(want));
    if (hit) return hit;
  }
  const chatty = models.find((m) => /chat|instruct|flash|mini|turbo/i.test(m));
  return chatty ?? models[0] ?? "";
}
