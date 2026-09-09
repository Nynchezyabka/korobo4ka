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
  /** Префикс однозначный: другие сервисы даже не проверяем */
  exclusivePrefixes?: string[];
  /** Поддерживает ли strict json_schema в response_format */
  jsonSchema: boolean;
  /** Дополнительные заголовки (только разрешённые браузером!) */
  headers?: Record<string, string>;
  /** Отдельный путь для проверки ключа (когда /models публичный) */
  authCheckPath?: string;
  /** Модели по умолчанию, если /models недоступен */
  fallbackModels?: string[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    prefixes: ["sk-or-"],
    exclusivePrefixes: ["sk-or-"],
    jsonSchema: true,
    // ВАЖНО: HTTP-Referer — запрещённый в браузере заголовок, fetch с ним падает.
    headers: { "X-Title": "Korobochka" },
    // /models у OpenRouter публичный, ключ проверяем через /key
    authCheckPath: "/key",
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
    exclusivePrefixes: ["gsk_"],
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
    exclusivePrefixes: ["AIza"],
    jsonSchema: true,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    prefixes: ["csk-"],
    exclusivePrefixes: ["csk-"],
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

const LEGACY_STORE = "ai_user_key";
const STORE = "ai_connections";

export interface UserAiConfig {
  id?: string;
  key: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  jsonSchema: boolean;
  model: string;
  models: string[];
}

export type AiConnection = UserAiConfig & { id: string };

interface AiStore {
  connections: AiConnection[];
  activeId: string | null;
}

function emptyStore(): AiStore {
  return { connections: [], activeId: null };
}

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function isValid(c: any): boolean {
  return !!(c?.key && c?.baseUrl && c?.model);
}

/** Читает хранилище, при необходимости переносит старый одиночный ключ. */
export function loadAiStore(): AiStore {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw);
      const connections: AiConnection[] = Array.isArray(parsed?.connections)
        ? parsed.connections.filter(isValid).map((c: any) => ({ ...c, id: c.id || newId() }))
        : [];
      const activeId =
        connections.find((c) => c.id === parsed?.activeId)?.id ?? connections[0]?.id ?? null;
      return { connections, activeId };
    }
  } catch { /* ignore */ }

  // миграция со старого формата
  try {
    const legacy = localStorage.getItem(LEGACY_STORE);
    if (legacy) {
      const cfg = JSON.parse(legacy);
      if (isValid(cfg)) {
        const store: AiStore = {
          connections: [{ ...cfg, id: newId() } as AiConnection],
          activeId: null,
        };
        store.activeId = store.connections[0].id;
        saveAiStore(store);
        localStorage.removeItem(LEGACY_STORE);
        return store;
      }
    }
  } catch { /* ignore */ }

  return emptyStore();
}

export function saveAiStore(store: AiStore) {
  localStorage.setItem(STORE, JSON.stringify(store));
}

/** Добавляет новое подключение, не трогая существующие. Делает его активным. */
export function addAiConnection(cfg: UserAiConfig): AiConnection {
  const store = loadAiStore();
  const conn: AiConnection = { ...cfg, id: newId() };
  // одно подключение на пару провайдер+ключ
  const rest = store.connections.filter(
    (c) => !(c.providerId === conn.providerId && c.key === conn.key),
  );
  store.connections = [...rest, conn];
  store.activeId = conn.id;
  saveAiStore(store);
  return conn;
}

export function removeAiConnection(id: string) {
  const store = loadAiStore();
  store.connections = store.connections.filter((c) => c.id !== id);
  if (store.activeId === id) store.activeId = store.connections[0]?.id ?? null;
  saveAiStore(store);
}

export function setActiveConnection(id: string | null) {
  const store = loadAiStore();
  store.activeId = store.connections.some((c) => c.id === id) ? id : null;
  saveAiStore(store);
}

export function updateConnection(id: string, patch: Partial<AiConnection>) {
  const store = loadAiStore();
  store.connections = store.connections.map((c) => (c.id === id ? { ...c, ...patch } : c));
  saveAiStore(store);
}

/** Активное подключение (или null — тогда работает встроенный ИИ). */
export function loadAiConfig(): UserAiConfig | null {
  const store = loadAiStore();
  if (!store.activeId) return null;
  return store.connections.find((c) => c.id === store.activeId) ?? null;
}

export function saveAiConfig(cfg: UserAiConfig) {
  if (cfg.id) {
    updateConnection(cfg.id, cfg as AiConnection);
    setActiveConnection(cfg.id);
  } else {
    addAiConnection(cfg);
  }
}

export function clearAiConfig() {
  localStorage.removeItem(STORE);
  localStorage.removeItem(LEGACY_STORE);
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

/** Текст ошибки от самого сервиса, если он его прислал. */
async function providerMessage(res: Response): Promise<string | null> {
  try {
    const t = await res.text();
    if (!t) return null;
    try {
      const j = JSON.parse(t);
      const msg = j?.error?.message ?? j?.error ?? j?.message;
      if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 200);
    } catch {
      return t.trim().slice(0, 200) || null;
    }
  } catch { /* ignore */ }
  return null;
}

type FetchResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number; message?: string | null }
  | { ok: false; status: 0; network: true; message: string };

async function fetchModels(
  baseUrl: string,
  key: string,
  extra?: Record<string, string>,
): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: providerHeaders({ headers: extra }, key),
    });
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      network: true,
      message:
        "Запрос к сервису не прошёл из браузера (сеть или блокировка CORS). " +
        (e?.message ? `Подробности: ${e.message}` : ""),
    };
  }
  if (!res.ok) return { ok: false, status: res.status, message: await providerMessage(res) };
  const data = await res.json().catch(() => null);
  const list: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => String(m?.id ?? "")).filter(Boolean)
    : Array.isArray(data?.models)
      ? data.models.map((m: any) => String(m?.id ?? m?.name ?? "")).filter(Boolean)
      : [];
  return { ok: true, models: list.sort() };
}

/** Проверка самого ключа там, где /models публичный (OpenRouter). */
async function checkAuth(
  p: ProviderDef,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!p.authCheckPath) return { ok: true };
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl.replace(/\/$/, "")}${p.authCheckPath}`, {
      headers: providerHeaders(p, key),
    });
  } catch (e: any) {
    return {
      ok: false,
      error:
        `${p.name}: запрос не прошёл из браузера (сеть или блокировка CORS). ` +
        (e?.message ? `Подробности: ${e.message}` : ""),
    };
  }
  if (res.ok) return { ok: true };
  const msg = await providerMessage(res);
  return { ok: false, error: `${p.name}: ${humanError(res.status)}${msg ? ` — ${msg}` : ""}` };
}

export interface DetectResult {
  provider: ProviderDef;
  models: string[];
}

type DetectOut = { ok: true; result: DetectResult } | { ok: false; error: string };

async function tryProvider(p: ProviderDef, key: string): Promise<DetectOut> {
  const auth = await checkAuth(p, key);
  if (!auth.ok) return { ok: false, error: auth.error };

  const r = await fetchModels(p.baseUrl, key, p.headers);
  if (r.ok) {
    const models = r.models.length ? r.models : (p.fallbackModels ?? []);
    if (!models.length) return { ok: false, error: `${p.name}: список моделей пуст` };
    return { ok: true, result: { provider: p, models } };
  }
  if ((r as any).network) return { ok: false, error: `${p.name}: ${(r as any).message}` };
  const msg = (r as any).message as string | null;
  return { ok: false, error: `${p.name}: ${humanError(r.status)}${msg ? ` — ${msg}` : ""}` };
}

/**
 * Определяет сервис по ключу. Для однозначных префиксов (sk-or-, gsk_, AIza, csk-)
 * проверяется только этот сервис и показывается именно его ошибка.
 */
export async function detectProvider(
  key: string,
  customBaseUrl?: string,
): Promise<DetectOut> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "Введите ключ" };

  if (customBaseUrl?.trim()) {
    const provider = { ...CUSTOM_PROVIDER, baseUrl: customBaseUrl.trim().replace(/\/$/, "") };
    return tryProvider(provider, trimmed);
  }

  const exclusive = PROVIDERS.find((p) =>
    (p.exclusivePrefixes ?? []).some((pre) => trimmed.startsWith(pre)),
  );
  if (exclusive) return tryProvider(exclusive, trimmed);

  const byPrefix = PROVIDERS.filter((p) => p.prefixes.some((pre) => trimmed.startsWith(pre)));
  const rest = PROVIDERS.filter((p) => !byPrefix.includes(p));
  const candidates = [...byPrefix, ...rest];

  let lastError = "Не удалось определить сервис по этому ключу";
  for (const p of candidates) {
    const r = await tryProvider(p, trimmed);
    if (r.ok) return r;
    if (byPrefix.includes(p)) lastError = r.error;
  }
  return { ok: false, error: lastError };
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


// ---------- режим ИИ: демо / встроенный / свой ключ ----------

const OWNER_CODE_KEY = "ai_owner_code";
const SOURCE_KEY = "ai_source"; // "demo" | "builtin"

export function loadOwnerCode(): string {
  return localStorage.getItem(OWNER_CODE_KEY) || "";
}
export function saveOwnerCode(code: string) {
  if (code) localStorage.setItem(OWNER_CODE_KEY, code);
  else localStorage.removeItem(OWNER_CODE_KEY);
}
export function hasOwnerCode(): boolean {
  return !!loadOwnerCode();
}

export type AiSource = "demo" | "builtin";

export function loadAiSource(): AiSource {
  const v = localStorage.getItem(SOURCE_KEY);
  if (v === "builtin" && hasOwnerCode()) return "builtin";
  if (v === "demo") return "demo";
  return hasOwnerCode() ? "builtin" : "demo";
}
export function saveAiSource(s: AiSource) {
  localStorage.setItem(SOURCE_KEY, s);
}
