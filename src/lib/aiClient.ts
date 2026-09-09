import { supabase } from "@/integrations/supabase/client";
import {
  loadAiConfig, providerHeaders, humanError, UserAiConfig,
  loadAiSource, loadOwnerCode,
} from "@/lib/aiProviders";
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

/** Подпись текущего режима для интерфейса. */
export function currentAiLabel(): string {
  return activeAiLabel() ?? (loadAiSource() === "builtin" ? "Встроенный ИИ" : "Демо-режим");
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
  const body = { ...req.fallback.body, ownerCode: loadOwnerCode() };
  const { data, error } = await supabase.functions.invoke(req.fallback.fn, { body });
  if ((data as any)?.error) throw new AiError((data as any).error);
  if (error) throw new AiError(error.message || "ИИ недоступен");
  return data;
}

async function runDemo(req: AiRequest): Promise<any> {
  const isSteps = req.fallback.fn === "suggest-steps";
  const body = {
    action: "run",
    task: isSteps ? "steps" : "braindump",
    ...req.fallback.body,
  };
  const { data, error } = await supabase.functions.invoke("demo-ai", { body });
  if ((data as any)?.error) throw new AiError((data as any).error);
  if (error) throw new AiError(error.message || "Демо недоступно");
  return data;
}

export interface DemoStatus { used: number; limit: number; left: number }

export async function fetchDemoStatus(): Promise<DemoStatus | null> {
  try {
    const { data } = await supabase.functions.invoke("demo-ai", { body: { action: "status" } });
    if (data && typeof (data as any).left === "number") return data as DemoStatus;
  } catch { /* ignore */ }
  return null;
}

export async function checkOwnerCode(code: string): Promise<boolean> {
  const { data } = await supabase.functions.invoke("demo-ai", { body: { action: "owner", code } });
  return !!(data as any)?.ok;
}

/** Единая точка вызова ИИ: свой ключ, встроенный (только владелец) или демо. */
export async function runAI(req: AiRequest): Promise<any> {
  const cfg = loadAiConfig();
  if (cfg) return runWithUserKey(cfg, req);
  return loadAiSource() === "builtin" ? runBuiltin(req) : runDemo(req);
}
