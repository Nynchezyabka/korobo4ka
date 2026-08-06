export const APP_VERSION = "5.1";

const SEEN_KEY = "app_version_seen";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Newest first */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "5.1",
    date: "Август 2026",
    title: "Проекты, подсказки и порядок в меню",
    items: [
      "Раздел «Проекты» — списки дел по шагам: можно выполнять по порядку или в любом порядке.",
      "Подсказки шагов: готовые чек-листы (уборка, звонки, готовка, зарядка) и кнопка «Спросить AI», если своих идей нет.",
      "Личная библиотека чек-листов: любой набор шагов можно сохранить как шаблон и использовать снова.",
      "В таймере появилась кнопка «С чего начать?» — записывайте шаги на одну минуту и отмечайте, из-за чего застряли.",
      "«Шаблоны» переименованы в «Повторяющиеся задачи» и снабжены пояснением, чем отличаются от проектов.",
      "Боковая панель разгружена: 5 разделов, всё остальное — в «Настройках». В свёрнутом виде остались только иконки.",
      "В настройках: размер шрифта и скин «Коробочка» / «Строгий», если рукописный шрифт читать тяжело.",
    ],
  },
];

function toNum(v: string): number {
  const [a = "0", b = "0"] = v.split(".");
  return Number(a) * 1000 + Number(b);
}

/** Entries newer than the given seen version */
export function entriesSince(seen: string | null): ChangelogEntry[] {
  if (!seen) return [];
  return CHANGELOG.filter((e) => toNum(e.version) > toNum(seen));
}

export function getSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {}
}
