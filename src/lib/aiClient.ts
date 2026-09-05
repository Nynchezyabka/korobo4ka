import { supabase } from "@/integrations/supabase/client";
import { loadAiConfig, providerHeaders, humanError, UserAiConfig } from "@/lib/aiProviders";
import { parseLooseJson } from "@/lib/jsonRepair";

export interface AiRequest {
  /** системная инструкция */
  instructions: string;
  /** текст пользователя */
  input: string;
  schemaName: string;
  schema: any;
  /** запасной путь: встроенный ИИ через backend-функцию */
  fallback: { fn: string; body: Record<string, unknown> };
}

export class AiError extends Error {}

export function activeAiLabel(): string | null {
  const cfg = loadAiConfig();
  return cfg ? `${cfg.providerName} · ${cfg.model}` : null;
}

type FormatMode = "json_schema" | "json_object" | "none";

async function callProvider(cfg: UserAiConfig, req: AiRequest, mode: FormatMode) {
  const body: any = {
    model: cfg.model,
    messages: [
      { role: "system", content: req.instructions },
      { role: "user", content: req.input },
    ],
  };
  if (mode === "json_schema") {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: req.schemaName, strict: true, schema: req.schema },
    };
  } else if (mode === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: providerHeaders({}, cfg.key),
    body: JSON.stringify(body),
  });
  return res;
}

async function runWithUserKey(cfg: UserAiConfig, req: AiRequest): Promise<any> {
  const modes: FormatMode[] = cfg.jsonSchema
    ? ["json_schema", "json_object", "none"]
    : ["json_object", "none"];

  let lastError = "Сервис недоступен";

  for (const mode of modes) {
    let res: Response;
    try {
      res = await callProvider(cfg, req, mode);
    } catch {
      throw new AiError("Не удалось связаться с сервисом ИИ");
    }

    if (!res.ok) {
      // 400 — модель не поняла формат: пробуем более простой режим
      if (res.status === 400 && mode !== "none") continue;
      throw new AiError(humanError(res.status));
    }

    const data = await res.json().catch(() => null);
    const text: string =
      data?.choices?.[0]?.message?.content ??
      (typeof data?.choices?.[0]?.text === "string" ? data.choices[0].text : "");
    const parsed = parseLooseJson(typeof text === "string" ? text : "");
    if (parsed && typeof parsed === "object") return parsed;

    lastError = "Модель не справилась с форматом ответа — попробуйте другую модель";
  }

  throw new AiError(lastError);
}

async function runBuiltin(req: AiRequest): Promise<any> {
  const { data, error } = await supabase.functions.invoke(req.fallback.fn, { body: req.fallback.body });
  if (error) throw new AiError((data as any)?.error || error.message || "ИИ недоступен");
  if ((data as any)?.error) throw new AiError((data as any).error);
  return data;
}

/** Единая точка вызова ИИ: свой ключ, если настроен, иначе встроенный. */
export async function runAI(req: AiRequest): Promise<any> {
  const cfg = loadAiConfig();
  if (cfg) return runWithUserKey(cfg, req);
  return runBuiltin(req);
}
