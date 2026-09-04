/**
 * Извлечение JSON-объекта из свободного текста модели.
 * Слабые модели часто оборачивают ответ в ```json, добавляют пояснения
 * до/после или обрывают хвост. Здесь мы стараемся достать корректный объект.
 */

function stripFences(text: string): string {
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}

/** Вырезает первый сбалансированный {...} блок с учётом строк и экранирования. */
function extractBalanced(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  // Не закрыт — пробуем починить, дописав недостающие скобки
  let tail = text.slice(start);
  if (inStr) tail += '"';
  tail += "]".repeat(0) + "}".repeat(Math.max(depth, 0));
  return tail;
}

/** Обрезает оборванный массив/объект до последнего валидного элемента. */
function truncateRepair(text: string): string | null {
  const lastComplete = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastComplete === -1) return null;
  let candidate = text.slice(0, lastComplete + 1);
  // добиваем закрывающие скобки по балансу
  let depthCurly = 0;
  let depthSquare = 0;
  let inStr = false;
  let esc = false;
  for (const ch of candidate) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depthCurly++;
    else if (ch === "}") depthCurly--;
    else if (ch === "[") depthSquare++;
    else if (ch === "]") depthSquare--;
  }
  if (inStr) candidate += '"';
  candidate += "]".repeat(Math.max(depthSquare, 0)) + "}".repeat(Math.max(depthCurly, 0));
  return candidate;
}

export function parseLooseJson(raw: string): any | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = stripFences(raw);

  const attempts: (string | null)[] = [cleaned, extractBalanced(cleaned)];
  for (const a of attempts) {
    if (!a) continue;
    try {
      return JSON.parse(a);
    } catch {
      const fixed = truncateRepair(a);
      if (fixed) {
        try {
          return JSON.parse(fixed);
        } catch { /* дальше */ }
      }
    }
  }
  return null;
}
