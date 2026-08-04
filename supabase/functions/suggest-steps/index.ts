import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 300) : '';
    if (!title) {
      return new Response(JSON.stringify({ error: 'Укажите название дела' }), {
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
        instructions:
          'Ты помогаешь человеку с СДВГ начать дело. Разбей дело на 4-7 очень маленьких конкретных шагов на русском языке. ' +
          'Первый шаг должен занимать меньше одной минуты и быть физическим действием (открыть, достать, найти, встать). ' +
          'Каждый шаг — короткая фраза, без нумерации и без пояснений.',
        input: [{ role: 'user', content: [{ type: 'input_text', text: `Дело: ${title}` }] }],
        text: {
          format: {
            type: 'json_schema',
            name: 'steps',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                steps: { type: 'array', items: { type: 'string' } },
              },
              required: ['steps'],
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      const status = res.status === 429 ? 429 : res.status === 402 ? 402 : 500;
      const message =
        status === 429
          ? 'Слишком много запросов, попробуйте чуть позже'
          : status === 402
            ? 'Закончились кредиты AI'
            : 'AI недоступен';
      console.error('gateway error', res.status, text);
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read SSE and accumulate output text
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

    let steps: string[] = [];
    try {
      const parsed = JSON.parse(out);
      if (Array.isArray(parsed?.steps)) {
        steps = parsed.steps.filter((s: unknown) => typeof s === 'string' && s.trim()).slice(0, 10);
      }
    } catch {
      steps = out.split('\n').map((s) => s.replace(/^[\d.\-–•\s]+/, '').trim()).filter(Boolean).slice(0, 10);
    }

    return new Response(JSON.stringify({ steps }), {
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
