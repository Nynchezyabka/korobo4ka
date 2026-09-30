import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MAX_BYTES = 500_000; // не качаем больше 500 КБ HTML
const MAX_TEXT = 12_000;   // столько символов возвращаем приложению
const FETCH_TIMEOUT_MS = 10_000;

function htmlToText(html: string): string {
  let s = html;
  // вырезаем служебные блоки целиком
  s = s.replace(/<(script|style|noscript|svg|iframe|head|header|footer|nav|form)[\s\S]*?<\/\1>/gi, ' ');
  // переносы строк вместо блочных тегов
  s = s.replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, '\n');
  // остальные теги — в пробел
  s = s.replace(/<[^>]+>/g, ' ');
  // HTML-сущности
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  // схлопываем пробелы и пустые строки
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return s.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || url.length > 2000) {
      return new Response(JSON.stringify({ error: 'Нужна ссылка' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Ссылка не похожа на адрес страницы' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Поддерживаются только обычные веб-ссылки (http/https)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KorobochkaBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,text/plain',
        },
      });
    } catch {
      clearTimeout(timer);
      return new Response(JSON.stringify({ error: 'Страница не отвечает или слишком долго грузится' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    clearTimeout(timer);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Страница ответила ошибкой (${res.status})` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      return new Response(JSON.stringify({ error: 'По ссылке не текстовая страница' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // читаем не больше MAX_BYTES
    const reader = res.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: 'Не удалось прочитать страницу' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    try { await reader.cancel(); } catch { /* ignore */ }

    const html = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : (() => {
        const all = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { all.set(c, off); off += c.length; }
        return all;
      })(),
    );

    let text = contentType.includes('text/plain') ? html.trim() : htmlToText(html);
    if (text.length < 20) {
      return new Response(JSON.stringify({ error: 'Не удалось извлечь текст — возможно, страница требует входа или полностью строится скриптами' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let truncated = false;
    if (text.length > MAX_TEXT) {
      text = text.slice(0, MAX_TEXT);
      truncated = true;
    }

    return new Response(JSON.stringify({ text, truncated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Не удалось прочитать страницу' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
