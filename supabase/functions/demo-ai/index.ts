import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CATEGORIES = `0 — Категория не определена
1 — Обязательные (работа, дом, здоровье, документы, деньги — то, что надо)
2 — Безопасность (подушка, документы, страховки, профилактика здоровья)
3 — Простые радости (отдых, готовка для удовольствия, прогулка, творчество)
4 — Эго-радости (карьера, учёба, достижения, свои проекты)
5 — Доступность простых радостей (то, что освобождает время, деньги, энергию, место: уборка, продажа вещей, делегирование)`;

const BRAINDUMP_INSTRUCTIONS = `Ты помощник в приложении «Коробочка» для человека с СДВГ. Пользователь пишет поток мыслей на русском. Твоя работа — аккуратно разложить его на карточки, НЕ перегружая.

Правила:
- Максимум 12 карточек. Если дел больше — объединяй мелочи в один проект.
- kind:
  * "task" — одно конкретное действие без даты
  * "event" — действие, привязанное к конкретной дате/времени
  * "project" — требует нескольких шагов; дай 3-7 очень маленьких конкретных шагов в поле steps
  * "recurring" — регулярное дело; заполни recurrence (daily/weekly/monthly), recurrenceDay (0-6 для weekly, 1-31 для monthly, иначе null), recurrenceHour (0-23)
  * "not_task" — размышления, суммы, зарплаты, бюджет, чужие мнения, контекст
- Деньги и бюджет никогда не становятся задачами. Если сумма относится к делу — впиши её в текст задачи в скобках.
- text — короткая формулировка действия в инфинитиве, до 90 символов.
- scheduledFor — "YYYY-MM-DDTHH:MM" или null.
- category — число 0-5 из списка:
${CATEGORIES}
- summary — одна дружелюбная фраза на русском.
Верни ТОЛЬКО JSON вида {"summary": "...", "items": [...]}, без markdown.`;

const STEPS_INSTRUCTIONS =
  'Ты помогаешь человеку с СДВГ начать дело. Разбей дело на 4-7 очень маленьких конкретных шагов на русском языке. ' +
  'Первый шаг должен занимать меньше одной минуты и быть физическим действием. ' +
  'Верни ТОЛЬКО JSON вида {"steps": ["...", "..."]}, без markdown.';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function readStatus() {
  const res = await rest('demo_usage?id=eq.global&select=used,limit_total');
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  const used = Number(row?.used ?? 0);
  const limit = Number(row?.limit_total ?? 0);
  return { used, limit, left: Math.max(limit - used, 0) };
}

async function consume(): Promise<boolean> {
  const res = await rest('rpc/demo_consume', { method: 'POST', body: '{}' });
  if (!res.ok) return false;
  const value = await res.json().catch(() => null);
  return value !== null && value !== undefined;
}

async function release() {
  await rest('rpc/demo_release', { method: 'POST', body: '{}' }).catch(() => {});
}

/** Мягкий разбор JSON из ответа модели. */
function parseLoose(raw: string): any {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch { /* ignore */ }
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function deepseekError(status: number): string {
  if (status === 401 || status === 403) return 'Демо временно недоступно (ключ демо-режима не принят)';
  if (status === 402) return 'Демо-режим закончился: на демо-ключе нет средств';
  if (status === 429) return 'Слишком много запросов к демо, попробуйте через минуту';
  return 'Демо-сервис сейчас недоступен';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action ?? 'status');

    if (action === 'status') {
      return json(await readStatus());
    }

    if (action === 'owner') {
      const expected = Deno.env.get('OWNER_ACCESS_CODE') ?? '';
      const given = typeof body?.code === 'string' ? body.code.trim() : '';
      return json({ ok: !!expected && given === expected });
    }

    if (action !== 'run') return json({ error: 'Неизвестное действие' }, 400);

    const key = Deno.env.get('DEMO_DEEPSEEK_API_KEY');
    if (!key) return json({ error: 'Демо-режим пока не настроен' }, 503);

    const task = body?.task === 'steps' ? 'steps' : 'braindump';
    let instructions = BRAINDUMP_INSTRUCTIONS;
    let userText = '';

    if (task === 'steps') {
      const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 300) : '';
      if (!title) return json({ error: 'Укажите название дела' }, 400);
      instructions = STEPS_INSTRUCTIONS;
      userText = `Дело: ${title}`;
    } else {
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 6000) : '';
      if (text.length < 5) return json({ error: 'Напишите чуть подробнее' }, 400);
      const today = typeof body?.today === 'string' ? body.today.slice(0, 60) : new Date().toISOString();
      userText = `Сегодня: ${today}\n\nТекст пользователя:\n${text}`;
    }

    const ok = await consume();
    if (!ok) {
      return json({ error: 'Демо-лимит исчерпан. Подключите свой ключ в настройках.', limitReached: true }, 429);
    }

    let res: Response;
    try {
      res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: userText },
          ],
        }),
      });
    } catch (e) {
      await release();
      console.error('deepseek network error', e);
      return json({ error: 'Демо-сервис сейчас недоступен' }, 502);
    }

    if (!res.ok) {
      await release();
      const errText = await res.text().catch(() => '');
      console.error('deepseek error', res.status, errText.slice(0, 400));
      return json({ error: deepseekError(res.status) }, res.status === 429 ? 429 : 502);
    }

    const data = await res.json().catch(() => null);
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseLoose(content);

    if (!parsed || typeof parsed !== 'object') {
      await release();
      console.error('bad demo output', content.slice(0, 400));
      return json({ error: 'Не получилось разобрать ответ, попробуйте ещё раз' }, 502);
    }

    if (task === 'braindump' && Array.isArray(parsed.items)) parsed.items = parsed.items.slice(0, 12);

    const status = await readStatus();
    return json({ ...parsed, demo: status });
  } catch (e) {
    console.error(e);
    return json({ error: 'Ошибка сервера' }, 500);
  }
});
