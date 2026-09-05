/** Общие промпты и схемы: используются и своим ключом, и встроенным ИИ. */

const CATEGORIES = `0 — Категория не определена
1 — Обязательные (работа, дом, здоровье, документы, деньги — то, что надо)
2 — Безопасность (подушка, документы, страховки, профилактика здоровья)
3 — Простые радости (отдых, готовка для удовольствия, прогулка, творчество)
4 — Эго-радости (карьера, учёба, достижения, свои проекты)
5 — Доступность простых радостей (то, что освобождает время, деньги, энергию, место: уборка, продажа вещей, делегирование)`;

export const BRAINDUMP_INSTRUCTIONS = `Ты помощник в приложении «Коробочка» для человека с СДВГ. Пользователь пишет поток мыслей на русском. Твоя работа — аккуратно разложить его на карточки, НЕ перегружая.

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
Верни ТОЛЬКО JSON-объект вида {"summary": "...", "items": [...]}, без пояснений и без markdown.`;

export const BRAINDUMP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["task", "event", "project", "recurring", "not_task"] },
          text: { type: "string" },
          category: { type: "integer" },
          scheduledFor: { type: ["string", "null"] },
          steps: { type: "array", items: { type: "string" } },
          recurrence: { type: ["string", "null"], enum: ["daily", "weekly", "monthly", null] },
          recurrenceDay: { type: ["integer", "null"] },
          recurrenceHour: { type: ["integer", "null"] },
        },
        required: ["kind", "text", "category", "scheduledFor", "steps", "recurrence", "recurrenceDay", "recurrenceHour"],
      },
    },
  },
  required: ["summary", "items"],
};

export const STEPS_INSTRUCTIONS =
  "Ты помогаешь человеку с СДВГ начать дело. Разбей дело на 4-7 очень маленьких конкретных шагов на русском языке. " +
  "Первый шаг должен занимать меньше одной минуты и быть физическим действием (открыть, достать, найти, встать). " +
  "Каждый шаг — короткая фраза, без нумерации и без пояснений. " +
  'Верни ТОЛЬКО JSON вида {"steps": ["...", "..."]}, без markdown и без пояснений.';

export const STEPS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { steps: { type: "array", items: { type: "string" } } },
  required: ["steps"],
};
