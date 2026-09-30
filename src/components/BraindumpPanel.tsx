import { useState, useRef, useEffect } from "react";
import { runAI, currentAiLabel, fetchDemoStatus } from "@/lib/aiClient";
import { BRAINDUMP_INSTRUCTIONS, BRAINDUMP_SCHEMA } from "@/lib/aiPrompts";
import { AiModelPicker } from "@/components/AiModelPicker";
import { useApp } from "@/App";
import { CATEGORIES, CategoryId, RECURRENCE_LABELS, WEEKDAYS, RecurrenceType } from "@/types";
import { DraftItem, DraftKind, normalizeItems, applyDraft } from "@/lib/braindump";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Wand2, Mic, Loader2, Trash2, Check, StickyNote, ChevronDown, Paperclip, Link2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotes, markNotesProcessed, removeNote, restoreNote, addNote, Note } from "@/lib/notes";
import { showUndoToast } from "@/lib/undoDelete";
import { burnInPlace } from "@/lib/paperFx";

const GROUPS: { kind: DraftKind; title: string; hint: string }[] = [
  { kind: "event", title: "Со сроком", hint: "Привязано к дате и времени" },
  { kind: "task", title: "Задачи", hint: "Одно действие, без срока" },
  { kind: "project", title: "Проекты", hint: "Несколько шагов по порядку" },
  { kind: "recurring", title: "Повторяющиеся", hint: "Будут появляться регулярно" },
  { kind: "not_task", title: "Не задачи", hint: "Контекст и мысли — в списки не попадут" },
];

const PLACEHOLDER =
  "Опишите ситуацию своими словами: что происходит, что нужно сделать, что беспокоит. Можно длинно и без порядка.";

/** Живой пример потока мыслей — чтобы новичок сразу увидел, как работает разбор. */
const EXAMPLE_TEXT =
  "Иду по улице и всё крутится в голове. Надо записаться к врачу и не забыть спросить про анализы. " +
  "Зайти за жёлтой акриловой краской — я так и не расписала керамический горшок. " +
  "Грустно от того, что муж опять ворчал утром. Цветы не политы уже неделю. " +
  "Коту закончился корм, надо заказать. И привязалось от ребёнка «блинчики-оладушки, были мы у бабушки», никак не выгнать.";

export function BraindumpPanel() {
  const app = useApp() as any;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [showProcessed, setShowProcessed] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const draftRef = useRef<DraftItem[] | null>(null);
  draftRef.current = items;
  const doneRef = useRef(false);
  const [demoLeft, setDemoLeft] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_TEXT_LEN = 12_000;
  /** Добавить текст в поле, не превышая лимит запроса к модели. */
  const appendText = (addition: string) => {
    const chunk = addition.trim();
    if (!chunk) return;
    setText((prev) => {
      const joined = [prev.trim(), chunk].filter(Boolean).join("\n\n");
      if (joined.length > MAX_TEXT_LEN) {
        toast.info(`Текст очень длинный — взяла первые ${MAX_TEXT_LEN.toLocaleString("ru-RU")} символов`);
        return joined.slice(0, MAX_TEXT_LEN);
      }
      return joined;
    });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okType = /\.(txt|md)$/i.test(file.name) || /text\/(plain|markdown)/.test(file.type);
    if (!okType) {
      toast.error("Пока умею читать только текстовые файлы (.txt, .md)");
      return;
    }
    if (file.size > 300_000) {
      toast.error("Файл слишком большой — до 300 КБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => appendText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Не удалось прочитать файл");
    reader.readAsText(file);
  };

  const handleLinkFetch = async () => {
    const url = linkUrl.trim();
    if (!url) return;
    setLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-url", { body: { url } });
      if (error) throw new Error((data as any)?.error || "Не удалось прочитать страницу");
      const text = String((data as any)?.text ?? "");
      if (!text) throw new Error("Не удалось извлечь текст со страницы");
      appendText(text);
      if ((data as any)?.truncated) toast.info("Страница очень длинная — взяла начало");
      setLinkOpen(false);
      setLinkUrl("");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось прочитать страницу");
    } finally {
      setLinkLoading(false);
    }
  };

  useEffect(() => {
    if (currentAiLabel() !== "Демо-режим") { setDemoLeft(null); return; }
    let alive = true;
    fetchDemoStatus().then((s) => { if (alive && s) setDemoLeft(s.left); });
    return () => { alive = false; };
  }, []);

  const notes = useNotes();
  const pendingNotes = notes.filter((n) => !n.processed);
  const processedNotes = notes.filter((n) => n.processed);
  const takeNotes = (ids: string[]) => {
    const picked = pendingNotes.filter((n) => ids.includes(n.id)).map((n) => n.text);
    if (!picked.length) return;
    setText((prev) => [prev.trim(), ...picked].filter(Boolean).join("\n"));
    markNotesProcessed(ids);
  };

  const deleteNote = (note: Note) => {
    const index = notes.findIndex((n) => n.id === note.id);
    removeNote(note.id);
    showUndoToast("Заметка удалена", () => restoreNote(note, index));
  };

  const removeDraftItem = (item: DraftItem) => {
    const current = items ?? [];
    const index = current.findIndex((candidate) => candidate.uid === item.uid);
    setItems(current.filter((candidate) => candidate.uid !== item.uid));
    showUndoToast("Карточка удалена", () => {
      setItems((latest) => {
        if (!latest || latest.some((candidate) => candidate.uid === item.uid)) return latest;
        const restored = [...latest];
        restored.splice(Math.min(Math.max(index, 0), restored.length), 0, item);
        return restored;
      });
    });
  };

  const removeDraftStep = (item: DraftItem, stepIndex: number) => {
    const step = item.steps[stepIndex];
    if (step === undefined) return;
    update(item.uid, { steps: item.steps.filter((_, index) => index !== stepIndex) });
    showUndoToast("Шаг удалён", () => {
      setItems((latest) => latest?.map((candidate) => {
        if (candidate.uid !== item.uid) return candidate;
        const steps = [...candidate.steps];
        steps.splice(Math.min(Math.max(stepIndex, 0), steps.length), 0, step);
        return { ...candidate, steps };
      }) ?? latest);
    });
  };

  const update = (uid: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev?.map((i) => (i.uid === uid ? { ...i, ...patch } : i)) ?? prev);

  /** Сохранить неподтверждённые карточки как обработанные заметки — ничего не пропадает. */
  const saveUnconfirmed = (draft: DraftItem[]): number => {
    const rest = draft.filter((i) => i.text.trim() && !(i.selected && i.kind !== "not_task"));
    if (!rest.length) return 0;
    for (const i of rest) addNote(i.kind === "not_task" ? `(контекст) ${i.text}` : i.text, true);
    return rest.length;
  };

  const resetDraft = () => { setItems(null); setSummary(""); };

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
      if (typeof (data as any)?.demo?.left === "number") setDemoLeft((data as any).demo.left);
      setSummary(String((data as any)?.summary ?? ""));
      setItems(normalized);
      doneRef.current = false;
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
    const saved = saveUnconfirmed(items);
    doneRef.current = true;
    const parts: string[] = [];
    if (res.tasks) parts.push(`задач: ${res.tasks}`);
    if (res.projects) parts.push(`проектов: ${res.projects}`);
    if (res.recurring) parts.push(`повторяющихся: ${res.recurring}`);
    if (!parts.length) {
      if (saved) toast.info(`Добавлять нечего — остальное сохранила в заметки (${saved})`);
      else toast.info("Ничего не выбрано");
      resetDraft();
      return;
    }
    toast.success(`Добавлено — ${parts.join(", ")}`);
    if (saved) toast.info(`Остальное сохранила в заметки (${saved})`);
    resetDraft();
    setText("");
  };

  // При уходе с экрана черновик не пропадает: неподтверждённое уходит в заметки.
  useEffect(() => {
    return () => {
      const draft = draftRef.current;
      if (draft && !doneRef.current) saveUnconfirmed(draft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = items?.filter((i) => i.selected && i.kind !== "not_task").length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-foreground">Разбор</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Напишите всё как есть — помощник разложит это на задачи, проекты и повторяющиеся дела.
          Можно надиктовать, прикрепить текстовый файл (.txt, .md) или вставить ссылку на страницу.
          Ничего не сохранится, пока вы не подтвердите.
        </p>
        {!text.trim() && !items && (
          <button
            onClick={() => setText(EXAMPLE_TEXT)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 active:scale-95 transition-all"
          >
            <Sparkles size={14} /> Попробовать пример
          </button>
        )}
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={handleFilePick}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-border text-muted-foreground hover:bg-muted shrink-0"
            title="Прикрепить текстовый файл (.txt, .md)"
          >
            <Paperclip size={18} />
          </button>
          <div className="relative shrink-0">
            <button
              onClick={() => setLinkOpen((o) => !o)}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg border shrink-0",
                linkOpen ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-muted"
              )}
              title="Вставить ссылку на страницу"
            >
              <Link2 size={18} />
            </button>
            {linkOpen && (
              <>
                <div className="fixed inset-0 z-[10150]" onClick={() => setLinkOpen(false)} />
                <div className="absolute z-[10200] bottom-full left-0 mb-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background shadow-lg p-2 space-y-1.5 animate-scale-in">
                  <p className="text-[11px] text-muted-foreground px-0.5">Ссылка на страницу — текст добавится в поле</p>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLinkFetch(); }}
                    placeholder="https://…"
                    autoFocus
                    className="w-full text-sm px-2 py-1.5 rounded-md border border-border bg-background outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleLinkFetch}
                    disabled={linkLoading || !linkUrl.trim()}
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
                  >
                    {linkLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    {linkLoading ? "Читаю страницу…" : "Добавить текст"}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={analyze}
            disabled={loading || text.trim().length < 5}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 active:scale-[0.99] transition-all"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            {loading ? "Разбираю…" : "Разобрать"}
          </button>
        </div>
        <AiModelPicker
          className="mt-1.5"
          contextLabel="Кто разбирает записи"
          demoLeft={demoLeft}
          onDemoStatusChange={setDemoLeft}
        />

      </div>

      {pendingNotes.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold flex items-center gap-1.5"><StickyNote size={15} /> Накопленные заметки</h3>
            <button onClick={() => takeNotes(pendingNotes.map((n) => n.id))} className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted">Все в разбор</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Заметка уходит в поле выше — после «Разобрать» её можно подтвердить как задачу, проект или повтор. Можно и оставить как есть.</p>
          {pendingNotes.map((n) => (
            <div key={n.id} data-fx-row className="flex items-start gap-2 rounded-lg bg-muted/30 p-2">
              <p className="flex-1 min-w-0 text-sm whitespace-pre-wrap break-words">{n.text}</p>
              <button onClick={() => takeNotes([n.id])} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted shrink-0">В разбор</button>
              <button onClick={(e) => { burnInPlace(e.currentTarget, { text: n.text }); deleteNote(n); }} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0" title="Удалить заметку"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {processedNotes.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-2.5">
          <button
            onClick={() => setShowProcessed(!showProcessed)}
            className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><StickyNote size={15} /> Обработанные · {processedNotes.length}</span>
            <ChevronDown size={15} className={cn("transition-transform", showProcessed && "rotate-180")} />
          </button>
          {showProcessed && (
            <div className="mt-2 space-y-1.5">
              {processedNotes.map((n) => (
                <div key={n.id} data-fx-row className="flex items-start gap-2 rounded-lg bg-muted/20 p-2 opacity-70">
                  <p className="flex-1 min-w-0 text-sm whitespace-pre-wrap break-words">{n.text}</p>
                  <button onClick={(e) => { burnInPlace(e.currentTarget, { text: n.text }); deleteNote(n); }} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0" title="Удалить заметку"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    data-fx-row
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
                        onClick={(e) => { burnInPlace(e.currentTarget, { text: it.text }); removeDraftItem(it); }}
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
                          <li key={i} data-fx-row className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground/80">
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
                              onClick={(e) => { burnInPlace(e.currentTarget, { text: s }); removeDraftStep(it, i); }}
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
              onClick={() => { const saved = items ? saveUnconfirmed(items) : 0; doneRef.current = true; resetDraft(); if (saved) toast.info(`Остальное сохранила в заметки (${saved})`); }}
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
