import { Task, TaskTemplate } from "@/types";

/**
 * Compute next occurrence timestamp for a template, strictly after `from`.
 */
export function nextOccurrence(tpl: TaskTemplate, from: Date = new Date()): number {
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(0);
  candidate.setHours(tpl.recurrenceHour);

  const interval = Math.max(1, tpl.recurrenceInterval ?? 1);
  const days = tpl.recurrenceDays?.length
    ? tpl.recurrenceDays
    : tpl.recurrenceDay !== undefined && tpl.recurrence === "weekly"
      ? [tpl.recurrenceDay]
      : [];
  const limit = tpl.until ? new Date(`${tpl.until}T23:59:59`).getTime() : Infinity;

  const anchor = new Date(from);
  anchor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 800; i++) {
    if (candidate.getTime() > from.getTime() && candidate.getTime() <= limit) {
      switch (tpl.recurrence) {
        case "daily": {
          const dayDiff = Math.round((startOfDay(candidate) - startOfDay(anchor)) / 86400000);
          if (interval === 1 || dayDiff % interval === 0) return candidate.getTime();
          break;
        }
        case "weekly": {
          const matchesDay = days.length === 0 || days.includes(candidate.getDay());
          if (matchesDay) {
            if (interval === 1) return candidate.getTime();
            const weekDiff = Math.floor(
              (startOfWeek(candidate) - startOfWeek(anchor)) / (7 * 86400000)
            );
            if (weekDiff % interval === 0) return candidate.getTime();
          }
          break;
        }
        case "monthly": {
          const isLast = tpl.recurrenceDay === -1;
          const lastDay = new Date(
            candidate.getFullYear(),
            candidate.getMonth() + 1,
            0
          ).getDate();
          const target = isLast
            ? lastDay
            : Math.min(tpl.recurrenceDay ?? candidate.getDate(), lastDay);
          if (candidate.getDate() === target) {
            const monthDiff =
              (candidate.getFullYear() - anchor.getFullYear()) * 12 +
              (candidate.getMonth() - anchor.getMonth());
            if (interval === 1 || monthDiff % interval === 0) return candidate.getTime();
          }
          break;
        }
      }
    }
    if (candidate.getTime() > limit) break;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeek(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x.getTime();
}

/** Человеческое описание правила повторения. */
export function describeRecurrence(tpl: TaskTemplate): string {
  const WD = ["воскресеньям", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"];
  const interval = Math.max(1, tpl.recurrenceInterval ?? 1);
  const hour = `${String(tpl.recurrenceHour).padStart(2, "0")}:00`;
  let base: string;
  if (tpl.recurrence === "daily") {
    base = interval === 1 ? "Каждый день" : `Каждые ${interval} дн.`;
  } else if (tpl.recurrence === "weekly") {
    const days = tpl.recurrenceDays?.length
      ? tpl.recurrenceDays
      : tpl.recurrenceDay !== undefined
        ? [tpl.recurrenceDay]
        : [];
    const names = days.length ? days.slice().sort().map((d) => WD[d]).join(", ") : "неделям";
    base = interval === 1 ? `По ${names}` : `Каждые ${interval} нед. по ${names}`;
  } else {
    const d = tpl.recurrenceDay === -1 ? "в последний день месяца" : `${tpl.recurrenceDay ?? 1} числа`;
    base = interval === 1 ? `Ежемесячно ${d}` : `Каждые ${interval} мес. ${d}`;
  }
  const until = tpl.until ? `, до ${tpl.until}` : "";
  return `${base} в ${hour}${until}`;
}

/**
 * Create the next pending instance of a template (called when current instance is completed).
 */
export function createNextInstance(tpl: TaskTemplate, from: Date = new Date()): Omit<Task, "id"> {
  const next = nextOccurrence(tpl, from);
  return {
    text: tpl.text,
    category: tpl.category,
    subcategory: tpl.subcategory,
    completed: false,
    active: true,
    statusChangedAt: Date.now(),
    templateId: tpl.id,
    scheduledFor: next,
  };
}

/**
 * Safety net: if the app wasn't open for several days, ensure each active template
 * has at least one pending (non-completed) task. Also handles initial seeding.
 */
export function processRecurringTemplates(
  templates: TaskTemplate[],
  existingTasks: Task[]
): { newTasks: Omit<Task, "id">[]; updatedTemplates: TaskTemplate[] | null } {
  const now = new Date();
  const today = toDateStr(now);

  const newTasks: Omit<Task, "id">[] = [];
  let changed = false;

  const updated = templates.map((tpl) => {
    if (!tpl.active) return tpl;

    // If a pending (uncompleted) instance for this template already exists — skip
    const hasPending = existingTasks.some(
      (t) => t.templateId === tpl.id && !t.completed
    );
    if (hasPending) return tpl;

    // Otherwise create the next instance
    newTasks.push(createNextInstance(tpl, now));
    changed = true;
    return { ...tpl, lastCreated: today };
  });

  return {
    newTasks,
    updatedTemplates: changed ? updated : null,
  };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
