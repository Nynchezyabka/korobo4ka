import { useState, useRef, useEffect } from "react";
import { useApp } from "@/App";
import { parseVoice } from "@/lib/voiceParse";
import { Mic, Plus, Clock, Repeat, X } from "lucide-react";
import { CategoryId, RecurrenceType, RECURRENCE_LABELS, WEEKDAYS } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


interface Props {
  inTimer?: boolean;
}

const TIME_PRESETS = ["09:00", "12:00", "15:00", "18:00", "21:00"];

export function QuickAddBar({ inTimer }: Props) {
  const { addQuickTask, templates, saveTemplates, tasks } = useApp() as any;
  const [text, setText] = useState("");
  const [time, setTime] = useState<string>(""); // "HH:MM" today
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRecur, setShowRecur] = useState(false);
  const [recur, setRecur] = useState<RecurrenceType | null>(null);
  const [recurDay, setRecurDay] = useState(1);
  const [listening, setListening] = useState(false);
  const [pendingTimePrompt, setPendingTimePrompt] = useState<string | null>(null);
  const recogRef = useRef<any>(null);

  const computeScheduled = (): number | undefined => {
    if (!time) return undefined;
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
    return d.getTime();
  };

  const submit = () => {
    if (!text.trim()) return;
    const scheduled = computeScheduled();
    if (recur) {
      // create a recurring template + first instance
      const hour = time ? parseInt(time.split(":")[0], 10) : 9;
      const startId = (templates as any[]).reduce((m, t) => Math.max(m, t.id), 0) + 1;
      const tpl = {
        id: startId,
        text: text.trim(),
        category: 0 as CategoryId,
        recurrence: recur,
        recurrenceHour: hour,
        recurrenceDay: recur === "daily" ? undefined : recurDay,
        active: true,
      };
      saveTemplates([...(templates as any[]), tpl]);
      addQuickTask(text.trim(), scheduled, 0);
      toast.success("Создан повторяющийся шаблон");
    } else {
      addQuickTask(text.trim(), scheduled, 0);
    }
    setText("");
    setTime("");
    setShowTimePicker(false);
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
      if (parsed.scheduledFor) {
        addQuickTask(parsed.text, parsed.scheduledFor, 0);
        const d = new Date(parsed.scheduledFor);
        toast.success(`«${parsed.text}» — ${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`);
      } else {
        // ask for time
        setText(parsed.text);
        setPendingTimePrompt(parsed.text);
      }
    };
    r.onerror = () => { setListening(false); toast.error("Не удалось распознать"); };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const acceptPendingTime = (timeStr: string | null) => {
    const txt = pendingTimePrompt || text;
    if (!txt.trim()) { setPendingTimePrompt(null); return; }
    let scheduled: number | undefined;
    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
      scheduled = d.getTime();
    }
    addQuickTask(txt, scheduled, 0);
    setPendingTimePrompt(null);
    setText("");
  };

  const containerCls = inTimer
    ? "fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] w-[min(560px,calc(100%-1rem))]"
    : "fixed bottom-5 left-[calc(3rem+0.5rem)] right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(560px,calc(100%-4rem))] z-[90]";

  return (
    <>
      {/* Time-prompt popup after voice */}
      {pendingTimePrompt !== null && (
        <div className="fixed inset-0 z-[10200] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => acceptPendingTime(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-background p-4 shadow-xl border border-border">
            <h4 className="font-display text-lg mb-1">Уточните время</h4>
            <p className="text-sm text-muted-foreground mb-3 truncate">«{pendingTimePrompt}»</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {TIME_PRESETS.map((t) => (
                <button key={t} onClick={() => acceptPendingTime(t)} className="py-2 rounded-md border border-border bg-muted/40 text-sm font-medium hover:bg-muted">{t}</button>
              ))}
            </div>
            <button onClick={() => acceptPendingTime(null)} className="w-full py-2 mt-1 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted">Без времени</button>
          </div>
        </div>
      )}

      <div className={containerCls}>
        {/* Time picker dropdown */}
        {showTimePicker && (
          <div className="mb-2 rounded-xl bg-background border border-border shadow-lg p-2 flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((t) => (
              <button key={t} onClick={() => { setTime(t); setShowTimePicker(false); }} className={cn("px-2.5 py-1 rounded-md text-xs border", time === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/40")}>{t}</button>
            ))}
            <input
              type="time"
              value={time || ""}
              onChange={(e) => setTime(e.target.value)}
              className="px-2 py-1 rounded-md border border-border bg-muted/40 text-xs"
            />
            {time && <button onClick={() => { setTime(""); }} className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted"><X size={12} /></button>}
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
            onClick={() => { setShowTimePicker((v) => !v); setShowRecur(false); }}
            className={cn("flex items-center gap-1 px-2 h-10 sm:h-9 rounded-md text-xs border shrink-0", time ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Время"
          >
            <Clock size={16} /> <span className="hidden sm:inline">{time || "время"}</span>{time && <span className="sm:hidden">{time}</span>}
          </button>
          <button
            onClick={() => { setShowRecur((v) => !v); setShowTimePicker(false); }}
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
