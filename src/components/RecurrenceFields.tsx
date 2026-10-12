import React, { useState, useEffect } from "react";
import { RecurrenceType, TaskTemplate, WEEKDAYS } from "@/types";
import { cn } from "@/lib/utils";
import { ClockPicker, pad2 } from "@/components/DateTimePicker";

/** Поля расписания регулярного дела — общие для «Регулярных дел» и окна добавления задачи. */
export type RecurrencePatch = Pick<
  TaskTemplate,
  "recurrence" | "recurrenceDay" | "recurrenceMonth" | "recurrenceDays" | "recurrenceInterval" | "until" | "recurrenceHour" | "recurrenceMinute"
>;

const SCALE_LABELS: Record<RecurrenceType, string> = { daily: "День", weekly: "Неделя", monthly: "Месяц", yearly: "Год" };
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every((x) => a.includes(x));

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[11px] px-2 py-1 rounded-full border transition-all active:scale-95",
        active ? "border-primary bg-primary/10 font-semibold" : "border-border opacity-80"
      )}
    >
      {children}
    </button>
  );
}

function NumIn({ value, max, onChange, disabled }: { value: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <input
      type="number"
      min={1}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(1, Math.min(max, parseInt(e.target.value) || 1)))}
      className="w-12 text-center text-xs rounded border border-border px-1 py-1 bg-background disabled:opacity-40"
    />
  );
}

export function RecurrenceFields({ initial, onChange }: { initial: Partial<RecurrencePatch>; onChange: (p: RecurrencePatch) => void }) {
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initial.recurrence ?? "daily");
  const [recurrenceDay, setRecurrenceDay] = useState(initial.recurrenceDay ?? 1);
  const [recurrenceHour, setRecurrenceHour] = useState(initial.recurrenceHour ?? 9);
  const [recurrenceMinute, setRecurrenceMinute] = useState(initial.recurrenceMinute ?? 0);
  const [showClock, setShowClock] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(
    initial.recurrenceDays?.length
      ? initial.recurrenceDays
      : initial.recurrence === "weekly" && initial.recurrenceDay !== undefined
        ? [initial.recurrenceDay]
        : []
  );
  const [interval, setInterval] = useState(initial.recurrenceInterval ?? 1);
  const [until, setUntil] = useState(initial.until ?? "");
  const [untilOn, setUntilOn] = useState(!!initial.until);
  const [recurrenceMonth, setRecurrenceMonth] = useState(initial.recurrenceMonth ?? new Date().getMonth());

  useEffect(() => {
    onChange({
      recurrence,
      recurrenceDay: recurrence === "monthly" ? recurrenceDay : recurrence === "yearly" ? Math.max(1, recurrenceDay) : undefined,
      recurrenceMonth: recurrence === "yearly" ? recurrenceMonth : undefined,
      recurrenceDays: recurrence === "weekly" ? (recurrenceDays.length ? recurrenceDays : [new Date().getDay()]) : undefined,
      recurrenceInterval: Math.max(1, interval),
      until: untilOn && until ? until : undefined,
      recurrenceHour,
      recurrenceMinute,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrence, recurrenceDay, recurrenceMonth, recurrenceDays, interval, until, untilOn, recurrenceHour, recurrenceMinute]);

  const toggleDay = (d: number) =>
    setRecurrenceDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {(["daily", "weekly", "monthly", "yearly"] as RecurrenceType[]).map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => { setRecurrence(r); setInterval(1); }}
            className={cn(
              "flex-1 text-xs px-2 py-1.5 rounded-full border transition-all active:scale-95",
              recurrence === r ? "border-primary bg-primary/10 font-semibold" : "border-border opacity-70"
            )}
          >
            {SCALE_LABELS[r]}
          </button>
        ))}
      </div>

      {recurrence === "daily" && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <Chip active={interval === 1} onClick={() => setInterval(1)}>Каждый день</Chip>
          <Chip active={false} onClick={() => { setRecurrence("weekly"); setRecurrenceDays([1, 2, 3, 4, 5]); setInterval(1); }}>По будням</Chip>
          <span className="text-xs ml-1">каждые</span>
          <NumIn value={interval} max={30} onChange={setInterval} />
          <span className="text-xs text-muted-foreground">дн.</span>
        </div>
      )}

      {recurrence === "weekly" && (
        <div className="mb-2 space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => toggleDay(i)}
                className={cn(
                  "text-xs w-9 h-9 rounded-full border transition-all",
                  recurrenceDays.includes(i) ? "border-primary bg-primary/10 font-bold" : "border-border opacity-60"
                )}
              >
                {WEEKDAYS[i]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Chip active={sameDays(recurrenceDays, [1, 2, 3, 4, 5])} onClick={() => setRecurrenceDays([1, 2, 3, 4, 5])}>Будни</Chip>
            <Chip active={sameDays(recurrenceDays, [0, 6])} onClick={() => setRecurrenceDays([0, 6])}>Выходные</Chip>
            <span className="text-xs ml-1">раз в</span>
            <NumIn value={interval} max={12} onChange={setInterval} />
            <span className="text-xs text-muted-foreground">нед.</span>
          </div>
        </div>
      )}

      {recurrence === "monthly" && (
        <div className="mb-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {[[1, "Каждый месяц"], [2, "Раз в 2 мес."], [3, "Квартал"], [6, "Полгода"]].map(([n, l]) => (
              <Chip key={n} active={interval === n} onClick={() => setInterval(n as number)}>{l}</Chip>
            ))}
            <span className="text-xs ml-1">свой:</span>
            <NumIn value={interval} max={24} onChange={setInterval} />
            <span className="text-xs text-muted-foreground">мес.</span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs">Число:</span>
            <NumIn value={recurrenceDay === -1 ? 1 : recurrenceDay} max={31} disabled={recurrenceDay === -1} onChange={setRecurrenceDay} />
            <Chip active={recurrenceDay === -1} onClick={() => setRecurrenceDay(recurrenceDay === -1 ? 1 : -1)}>Последний день</Chip>
          </div>
        </div>
      )}

      {recurrence === "yearly" && (
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            <NumIn value={Math.max(1, recurrenceDay)} max={31} onChange={setRecurrenceDay} />
            <select
              value={recurrenceMonth}
              onChange={(e) => setRecurrenceMonth(Number(e.target.value))}
              className="text-xs px-2 py-1.5 rounded border border-border bg-background"
            >
              {MONTHS_GEN.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Chip active={interval === 1} onClick={() => setInterval(1)}>Каждый год</Chip>
            <Chip active={interval === 2} onClick={() => setInterval(2)}>Раз в 2 года</Chip>
            <span className="text-xs ml-1">свой:</span>
            <NumIn value={interval} max={10} onChange={setInterval} />
            <span className="text-xs text-muted-foreground">г.</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <Chip active={!untilOn} onClick={() => { setUntilOn(false); setUntil(""); }}>Бессрочно</Chip>
        <Chip active={untilOn} onClick={() => setUntilOn(true)}>До даты</Chip>
        {untilOn && (
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="text-xs rounded border border-border px-2 py-1 bg-background"
          />
        )}
      </div>
      {!untilOn && <p className="text-[11px] text-muted-foreground -mt-1 mb-2">Повторяется, пока не выключите.</p>}

      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">Время:</span>
          <button
            type="button"
            onClick={() => setShowClock((v) => !v)}
            className="text-sm px-3 py-1 rounded-full border border-border bg-background tabular-nums font-medium"
          >
            {pad2(recurrenceHour)}:{pad2(recurrenceMinute)}
          </button>
        </div>
        {showClock && (
          <div className="mt-2 flex justify-center">
            <ClockPicker
              hour={recurrenceHour}
              minute={recurrenceMinute}
              onChange={(h, m) => { setRecurrenceHour(h); setRecurrenceMinute(m); }}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
