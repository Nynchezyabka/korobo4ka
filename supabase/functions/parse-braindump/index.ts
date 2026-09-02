import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CATEGORIES = `0 — Категория не определена
1 — Обязательные (работа, дом, здоровье, документы, деньги — то, что надо)
2 — Безопасность (подушка, документы, страховки, профилактика здоровья)
3 — Простые радости (отдых, готовка для удовольствия, прогулка, творчество)
4 — Эго-радости (карьера, учёба, достижения, свои проекты)
5 — Доступность простых радостей (то, что освобождает время, деньги, энергию, место: уборка, продажа вещей, делегирование)`;

const INSTRUCTIONS = `Ты помощник в приложении «Коробочка» для человека с СДВГ. Пользователь пишет поток мыслей на русском. Твоя работа — аккуратно разложить его на карточки, НЕ перегружая.

Правила:
- Максимум 12 карточек. Если дел больше — объединяй мелочи в один проект (например «Уборка дома и дачи» вместо шести задач).
- kind:
  * "task" — одно конкретное действие без даты
  * "event" — действие, привязанное к конкретной дате/времени
  * "project" — требует нескольких шагов; дай 3-7 очень маленьких конкретных шагов в поле steps (первый шаг — физическое действие меньше минуты)
  * "recurring" — регулярное дело; заполни recurrence (daily/weekly/monthly), recurrenceDay (0-6 для weekly, 1-31 для monthly, иначе null), recurrenceHour (0-23)
  * "not_task" — размышления, суммы, зарплаты, бюджет, чужие мнения, контекст. Такое НЕ превращай в задачи, а собери в одну-две карточки not_task с кратким пересказом.
- Деньги и бюджет никогда не становятся задачами. Если сумма относится к делу — впиши её в текст задачи в скобках.
- text — короткая формулировка действия в инфинитиве, без нумерации, до 90 символов.
- scheduledFor — локальные дата-время в формате "YYYY-MM-DDTHH:MM" или null. Год бери из сегодняшней даты.
- category — число 0-5 из списка:
${CATEGORIES}
- summary — одна дружелюбная фраза на русском: сколько дел с датами, сколько без, с чего разумно начать. Без давления.
Отвечай только структурой.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'AI не настроен' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 6000) : '';
    const today = typeof body?.today === 'string' ? body.today.slice(0, 40) : new Date().toISOString();
    if (text.length < 5) {
      return new Response(JSON.stringify({ error: 'Напишите чуть подробнее' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        stream: true,
        instructions: INSTRUCTIONS,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: `Сегодня: ${today}\n\nТекст пользователя:\n${text}` },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'braindump',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      kind: { type: 'string', enum: ['task', 'event', 'project', 'recurring', 'not_task'] },
                      text: { type: 'string' },
                      category: { type: 'integer' },
                      scheduledFor: { type: ['string', 'null'] },
                      steps: { type: 'array', items: { type: 'string' } },
                      recurrence: { type: ['string', 'null'], enum: ['daily', 'weekly', 'monthly', null] },
                      recurrenceDay: { type: ['integer', 'null'] },
                      recurrenceHour: { type: ['integer', 'null'] },
                    },
                    required: ['kind', 'text', 'category', 'scheduledFor', 'steps', 'recurrence', 'recurrenceDay', 'recurrenceHour'],
                  },
                },
              },
              required: ['summary', 'items'],
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      const status = res.status === 429 ? 429 : res.status === 402 ? 402 : 500;
      const message =
        status === 429
          ? 'Слишком много запросов, попробуйте чуть позже'
          : status === 402
            ? 'Закончились кредиты AI'
            : 'AI недоступен';
      console.error('gateway error', res.status, errText);
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let out = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            out += evt.delta;
          }
        } catch { /* ignore partial */ }
      }
    }

    let parsed: any = null;
    try { parsed = JSON.parse(out); } catch { /* ignore */ }
    if (!parsed || !Array.isArray(parsed.items)) {
      console.error('bad model output', out.slice(0, 500));
      return new Response(JSON.stringify({ error: 'Не получилось разобрать ответ, попробуйте ещё раз' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = parsed.items.slice(0, 12);
    return new Response(JSON.stringify({ summary: String(parsed.summary ?? ''), items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Ошибка сервера' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
