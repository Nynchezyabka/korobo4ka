import { useState, useRef } from "react";
import { runAI, activeAiLabel } from "@/lib/aiClient";
import { BRAINDUMP_INSTRUCTIONS, BRAINDUMP_SCHEMA } from "@/lib/aiPrompts";
import { useApp } from "@/App";
import { CATEGORIES, CategoryId, RECURRENCE_LABELS, WEEKDAYS, RecurrenceType } from "@/types";
import { DraftItem, DraftKind, normalizeItems, applyDraft } from "@/lib/braindump";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Wand2, Mic, Loader2, Trash2, Check } from "lucide-react";

const GROUPS: { kind: DraftKind; title: string; hint: string }[] = [
  { kind: "event", title: "Со сроком", hint: "Привязано к дате и времени" },
  { kind: "task", title: "Задачи", hint: "Одно действие, без срока" },
  { kind: "project", title: "Проекты", hint: "Несколько шагов по порядку" },
  { kind: "recurring", title: "Повторяющиеся", hint: "Будут появляться регулярно" },
  { kind: "not_task", title: "Не задачи", hint: "Контекст и мысли — в списки не попадут" },
];

const PLACEHOLDER =
  "Опишите ситуацию своими словами: что происходит, что нужно сделать, что беспокоит. Можно длинно и без порядка.";

export function BraindumpPanel() {
  const app = useApp() as any;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const update = (uid: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev?.map((i) => (i.uid === uid ? { ...i, ...patch } : i)) ?? prev);

  const analyze = async () => {
    if (text.trim().length < 5) {
      toast.error("Напишите чуть подробнее");
      return;
    }
    setLoading(true);
    try {
      const data = await runAI({
        instructions: BRAINDUMP_INSTRUCTIONS,
        input: `Сегодня: ${new Date().toString()}\n\nТекст пользователя:\n${text.trim()}`,
        schemaName: "braindump",
        schema: BRAINDUMP_SCHEMA,
        fallback: { fn: "parse-braindump", body: { text: text.trim(), today: new Date().toString() } },
      });
      const normalized = normalizeItems((data as any)?.items ?? []);
      if (!normalized.length) {
        toast.info("Не нашла здесь конкретных дел — попробуйте описать подробнее");
      }
      setSummary(String((data as any)?.summary ?? ""));
      setItems(normalized);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось разобрать текст");
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { toast.error("Голосовой ввод не поддерживается в этом браузере"); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = "ru-RU";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) add += e.results[i][0].transcript + " ";
      setText((prev) => (prev ? prev + " " : "") + add.trim());
    };
    r.onerror = () => { setListening(false); toast.error("Не удалось распознать"); };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const apply = async () => {
    if (!items) return;
    const res = await applyDraft(items, {
      setTasks: app.setTasks,
      templates: app.templates,
      saveTemplates: app.saveTemplates,
    });
    const parts: string[] = [];
    if (res.tasks) parts.push(`задач: ${res.tasks}`);
    if (res.projects) parts.push(`проектов: ${res.projects}`);
    if (res.recurring) parts.push(`повторяющихся: ${res.recurring}`);
    if (!parts.length) { toast.info("Ничего не выбрано"); return; }
    toast.success(`Добавлено — ${parts.join(", ")}`);
    setItems(null);
    setSummary("");
    setText("");
  };

  const selectedCount = items?.filter((i) => i.selected && i.kind !== "not_task").length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-foreground">Разбор</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Напишите всё как есть — помощник разложит это на задачи, проекты и повторяющиеся дела.
          Ничего не сохранится, пока вы не подтвердите.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="w-full min-h-[140px] sm:min-h-[180px] p-2 rounded-lg bg-transparent resize-y text-sm sm:text-base outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex items-center gap-2 pt-1.5 border-t border-border">
          <button
            onClick={handleVoice}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg border shrink-0",
              listening ? "bg-red-500/15 border-red-400 text-red-600" : "border-border text-muted-foreground hover:bg-muted"
            )}
            title={listening ? "Идёт запись — нажмите, чтобы остановить" : "Надиктовать"}
          >
            {listening ? <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> : <Mic size={18} />}
          </button>
          <button
            onClick={analyze}
            disabled={loading || text.trim().length < 5}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 active:scale-[0.99] transition-all"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            {loading ? "Разбираю…" : "Разобрать"}
          </button>
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground text-right">
          {activeAiLabel() ?? "Встроенный ИИ"}
        </div>
      </div>

      {items && (
        <div className="space-y-3">
          {summary && (
            <div className="rounded-lg bg-muted/50 border border-border p-2.5 text-xs sm:text-sm text-foreground/80">
              {summary}
            </div>
          )}

          {GROUPS.map((g) => {
            const group = items.filter((i) => i.kind === g.kind);
            if (!group.length) return null;
            return (
              <div key={g.kind} className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm sm:text-base font-semibold">{g.title}</h3>
                  <span className="text-[11px] sm:text-xs text-muted-foreground">{g.hint}</span>
                </div>

                {group.map((it) => (
                  <div
                    key={it.uid}
                    className={cn(
                      "rounded-lg border p-2.5 transition-colors",
                      it.kind === "not_task"
                        ? "border-dashed border-border bg-muted/30 opacity-70"
                        : it.selected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {it.kind !== "not_task" && (
                        <input
                          type="checkbox"
                          checked={it.selected}
                          onChange={(e) => update(it.uid, { selected: e.target.checked })}
                          className="mt-1.5 shrink-0 w-4 h-4"
                        />
                      )}
                      <textarea
                        value={it.text}
                        onChange={(e) => update(it.uid, { text: e.target.value })}
                        rows={1}
                        className="flex-1 min-w-0 bg-transparent resize-none text-sm sm:text-base outline-none leading-snug"
                      />
                      <button
                        onClick={() => setItems((prev) => prev?.filter((x) => x.uid !== it.uid) ?? prev)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted shrink-0"
                        title="Убрать из разбора"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {it.kind !== "not_task" && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-6">
                        <select
                          value={it.category}
                          onChange={(e) => update(it.uid, { category: Number(e.target.value) as CategoryId })}
                          className="text-xs px-2 py-1 rounded-md border border-border bg-muted/40"
                        >
                          {([1, 2, 5, 3, 4, 0] as CategoryId[]).map((c) => (
                            <option key={c} value={c}>{CATEGORIES[c].name}</option>
                          ))}
                        </select>

                        {it.kind !== "recurring" && (
                          <input
                            type="datetime-local"
                            value={it.scheduledFor ?? ""}
                            onChange={(e) => update(it.uid, { scheduledFor: e.target.value || null })}
                            className="text-xs px-2 py-1 rounded-md border border-border bg-muted/40"
                          />
                        )}

                        {it.kind === "recurring" && (
                          <>
                            <select
                              value={it.recurrence ?? "weekly"}
                              onChange={(e) => update(it.uid, { recurrence: e.target.value as RecurrenceType })}
                              className="text-xs px-2 py-1 rounded-md border border-border bg-muted/40"
                            >
                              {(["daily", "weekly", "monthly"] as RecurrenceType[]).map((r) => (
                                <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                              ))}
                            </select>
                            {it.recurrence === "weekly" && (
                              <select
                                value={it.recurrenceDay ?? 1}
                                onChange={(e) => update(it.uid, { recurrenceDay: Number(e.target.value) })}
                                className="text-xs px-2 py-1 rounded-md border border-border bg-muted/40"
                              >
                                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                              </select>
                            )}
                            {it.recurrence === "monthly" && (
                              <input
                                type="number" min={1} max={31}
                                value={it.recurrenceDay ?? 1}
                                onChange={(e) => update(it.uid, { recurrenceDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })}
                                className="w-14 text-xs px-2 py-1 rounded-md border border-border bg-muted/40 text-center"
                              />
                            )}
                            <input
                              type="number" min={0} max={23}
                              value={it.recurrenceHour ?? 9}
                              onChange={(e) => update(it.uid, { recurrenceHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                              className="w-12 text-xs px-2 py-1 rounded-md border border-border bg-muted/40 text-center"
                            />
                            <span className="text-xs text-muted-foreground">:00</span>
                          </>
                        )}
                      </div>
                    )}

                    {it.kind === "project" && it.steps.length > 0 && (
                      <ul className="mt-2 pl-6 space-y-1">
                        {it.steps.map((s, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground/80">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <input
                              value={s}
                              onChange={(e) => {
                                const steps = [...it.steps];
                                steps[i] = e.target.value;
                                update(it.uid, { steps });
                              }}
                              className="flex-1 min-w-0 bg-transparent outline-none border-b border-transparent focus:border-border"
                            />
                            <button
                              onClick={() => update(it.uid, { steps: it.steps.filter((_, j) => j !== i) })}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              title="Убрать шаг"
                            >
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          <div className="sticky bottom-2 flex gap-2 pt-1">
            <button
              onClick={apply}
              disabled={selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg disabled:opacity-40 active:scale-[0.99] transition-all"
            >
              <Check size={18} /> Добавить выбранное ({selectedCount})
            </button>
            <button
              onClick={() => { setItems(null); setSummary(""); }}
              className="px-4 h-11 rounded-xl bg-muted text-muted-foreground text-sm font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
