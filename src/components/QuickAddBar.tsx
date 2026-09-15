import { useState, useRef } from "react";
import { useApp } from "@/App";
import { parseVoice } from "@/lib/voiceParse";
import { Mic, Plus, CalendarClock, Repeat, X } from "lucide-react";
import { CategoryId, RecurrenceType, RECURRENCE_LABELS, WEEKDAYS } from "@/types";
import { DateTimePicker, pad2 } from "@/components/DateTimePicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  inTimer?: boolean;
}

function nextHour(): number {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function QuickAddBar({ inTimer }: Props) {
  const { addQuickTask, templates, saveTemplates } = useApp() as any;
  const [text, setText] = useState("");
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [showWhen, setShowWhen] = useState(false);
  const [showRecur, setShowRecur] = useState(false);
  const [recur, setRecur] = useState<RecurrenceType | null>(null);
  const [recurDay, setRecurDay] = useState(1);
  const [listening, setListening] = useState(false);
  const [pendingVoiceText, setPendingVoiceText] = useState<string | null>(null);
  const [pendingWhen, setPendingWhen] = useState<number | null>(null);
  const recogRef = useRef<any>(null);

  const submit = () => {
    if (!text.trim()) return;
    if (recur) {
      const base = scheduled ? new Date(scheduled) : new Date();
      const startId = (templates as any[]).reduce((m, t) => Math.max(m, t.id), 0) + 1;
      const tpl = {
        id: startId,
        text: text.trim(),
        category: 0 as CategoryId,
        recurrence: recur,
        recurrenceHour: base.getHours(),
        recurrenceMinute: base.getMinutes(),
        recurrenceDay: recur === "daily" ? undefined : recurDay,
        active: true,
      };
      saveTemplates([...(templates as any[]), tpl]);
      addQuickTask(text.trim(), scheduled ?? undefined, 0);
      toast.success("Создан повторяющийся шаблон");
    } else {
      addQuickTask(text.trim(), scheduled ?? undefined, 0);
    }
    setText("");
    setScheduled(null);
    setShowWhen(false);
    setShowRecur(false);
    setRecur(null);
  };

  const handleVoice = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      toast.error("Голосовой ввод не поддерживается в этом браузере");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = "ru-RU";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      const parsed = parseVoice(transcript);
      if (parsed.scheduledFor && parsed.timeKnown) {
        addQuickTask(parsed.text, parsed.scheduledFor, 0);
        toast.success(`«${parsed.text}» — ${formatWhen(parsed.scheduledFor)}`);
      } else {
        // время не распознали — уточняем календарём и часами
        setText(parsed.text);
        setPendingVoiceText(parsed.text);
        setPendingWhen(parsed.scheduledFor ?? nextHour());
      }
    };
    r.onerror = () => { setListening(false); toast.error("Не удалось распознать"); };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const acceptPending = (withTime: boolean) => {
    const txt = (pendingVoiceText || text).trim();
    if (!txt) { setPendingVoiceText(null); return; }
    const when = withTime ? pendingWhen ?? undefined : undefined;
    addQuickTask(txt, when, 0);
    if (when) toast.success(`«${txt}» — ${formatWhen(when)}`);
    setPendingVoiceText(null);
    setPendingWhen(null);
    setText("");
  };

  const containerCls = inTimer
    ? "fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] w-[min(560px,calc(100%-1rem))]"
    : "fixed bottom-5 left-[calc(3rem+0.5rem)] right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(560px,calc(100%-4rem))] z-[90]";

  return (
    <>
      {/* Уточнение даты и времени после голосового ввода */}
      {pendingVoiceText !== null && (
        <div className="fixed inset-0 z-[10200] flex items-end sm:items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => acceptPending(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-background p-4 shadow-xl border border-border">
            <h4 className="font-display text-lg mb-1">Когда напомнить?</h4>
            <p className="text-sm text-muted-foreground mb-3 truncate">«{pendingVoiceText}»</p>
            <DateTimePicker value={pendingWhen} onChange={setPendingWhen} title="Дата и время" clearable={false} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => acceptPending(true)} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Сохранить</button>
              <button onClick={() => acceptPending(false)} className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">Без времени</button>
            </div>
          </div>
        </div>
      )}

      <div className={containerCls}>
        {/* Дата и время */}
        {showWhen && (
          <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-xl bg-background border border-border shadow-lg p-2">
            <DateTimePicker
              value={scheduled}
              onChange={(v) => setScheduled(v)}
              title="Когда напомнить"
            />
          </div>
        )}

        {/* Recurrence dropdown */}
        {showRecur && (
          <div className="mb-2 rounded-xl bg-background border border-border shadow-lg p-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(["daily","weekly","monthly"] as RecurrenceType[]).map((r) => (
                <button key={r} onClick={() => setRecur(r === recur ? null : r)} className={cn("px-2.5 py-1 rounded-full text-xs border", recur === r ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/40")}>{RECURRENCE_LABELS[r]}</button>
              ))}
              {recur && <button onClick={() => setRecur(null)} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded"><X size={12} /></button>}
            </div>
            {recur === "weekly" && (
              <select value={recurDay} onChange={(e) => setRecurDay(parseInt(e.target.value))} className="text-xs px-2 py-1 rounded border border-border bg-muted/40 w-full">
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
              </select>
            )}
            {recur === "monthly" && (
              <input type="number" min={1} max={31} value={recurDay} onChange={(e) => setRecurDay(parseInt(e.target.value) || 1)} className="text-xs px-2 py-1 rounded border border-border bg-muted/40 w-full" />
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">Время повтора берётся из «Дата и время».</p>
          </div>
        )}

        {/* Main bar */}
        <div className="flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-background border border-border shadow-lg p-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={inTimer ? "Записать идею…" : "Задача…"}
            className="flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-xl bg-transparent text-base sm:text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => { setShowWhen((v) => !v); setShowRecur(false); }}
            className={cn("flex items-center gap-1 px-2 h-10 sm:h-9 rounded-md text-xs border shrink-0", scheduled ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Дата и время"
          >
            <CalendarClock size={16} />
            {scheduled && <span className="tabular-nums">{formatWhen(scheduled)}</span>}
          </button>
          <button
            onClick={() => { setShowRecur((v) => !v); setShowWhen(false); }}
            className={cn("flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-md border shrink-0", recur ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Повтор"
          >
            <Repeat size={16} />
          </button>
          <button
            onClick={handleVoice}
            className={cn("flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-md border shrink-0", listening ? "bg-red-500/15 border-red-400 text-red-600 animate-pulse" : "border-border text-muted-foreground hover:bg-muted")}
            title={listening ? "Идёт запись — нажмите, чтобы остановить" : "Голосовой ввод"}
          >
            {listening ? <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> : <Mic size={16} />}
          </button>

          <button
            onClick={submit}
            disabled={!text.trim()}
            className="flex items-center justify-center w-11 h-11 sm:w-10 sm:h-9 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-all shrink-0"
            title="Добавить"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
