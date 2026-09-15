import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ------------------------------ Часы (циферблат) ------------------------------ */

interface ClockProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  compact?: boolean;
}

/** Аналоговый выбор времени: сначала час, потом минуты (шаг 5). */
export function ClockPicker({ hour, minute, onChange, compact }: ClockProps) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const pm = hour >= 12;
  const size = compact ? 196 : 224;
  const radius = size / 2 - (compact ? 22 : 24);
  const center = size / 2;

  const items = step === "hour"
    ? Array.from({ length: 12 }, (_, i) => ({ label: String(i === 0 ? 12 : i), value: i }))
    : Array.from({ length: 12 }, (_, i) => ({ label: pad2(i * 5), value: i * 5 }));

  const selectedIndex = step === "hour" ? hour % 12 : Math.round(minute / 5) % 12;

  const pick = (value: number) => {
    if (step === "hour") {
      const h = pm ? (value % 12) + 12 : value % 12;
      onChange(h, minute);
      setStep("minute");
    } else {
      onChange(hour, value);
    }
  };

  const togglePm = () => {
    const h = pm ? hour - 12 : hour + 12;
    onChange((h + 24) % 24, minute);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1 text-2xl font-display">
        <button
          onClick={() => setStep("hour")}
          className={cn("px-2 py-0.5 rounded-md tabular-nums", step === "hour" ? "bg-primary/15 text-primary" : "text-foreground/70")}
        >
          {pad2(hour)}
        </button>
        <span className="text-foreground/50">:</span>
        <button
          onClick={() => setStep("minute")}
          className={cn("px-2 py-0.5 rounded-md tabular-nums", step === "minute" ? "bg-primary/15 text-primary" : "text-foreground/70")}
        >
          {pad2(minute)}
        </button>
        <button
          onClick={togglePm}
          className="ml-2 text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted"
          title="Утро / вечер"
        >
          {pm ? "после 12" : "до 12"}
        </button>
      </div>

      <div className="relative rounded-full bg-muted/40 border border-border" style={{ width: size, height: size }}>
        {/* стрелка */}
        <div
          className="absolute left-1/2 top-1/2 origin-left h-0.5 bg-primary/70 rounded-full"
          style={{
            width: radius - 16,
            transform: `translateY(-50%) rotate(${selectedIndex * 30 - 90}deg)`,
          }}
        />
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        {items.map((item, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const active = i === selectedIndex;
          return (
            <button
              key={item.value}
              onClick={() => pick(item.value)}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-sm font-medium transition-all tabular-nums",
                compact ? "w-8 h-8" : "w-9 h-9",
                active ? "bg-primary text-primary-foreground shadow" : "hover:bg-primary/10 text-foreground/80"
              )}
              style={{ left: x, top: y }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        {[0, 15, 30, 45].map((m) => (
          <button
            key={m}
            onClick={() => onChange(hour, m)}
            className={cn(
              "text-xs px-2 py-1 rounded-full border tabular-nums",
              minute === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            :{pad2(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Календарь ------------------------------ */

interface CalendarProps {
  /** YYYY-MM-DD */
  value: string;
  onChange: (key: string) => void;
  compact?: boolean;
}

export function MiniCalendar({ value, onChange, compact }: CalendarProps) {
  const base = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const todayKey = dateKey(new Date());

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    let start = first.getDay();
    start = start === 0 ? 6 : start - 1;
    const arr: (number | null)[] = [];
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(d);
    return arr;
  }, [viewMonth, viewYear]);

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className={compact ? "w-full max-w-[17rem]" : "w-full max-w-xs"}>
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={prev} className="p-1.5 rounded-md hover:bg-muted"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={next} className="p-1.5 rounded-md hover:bg-muted"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_HEADERS.map((wd) => (
          <div key={wd} className="text-[10px] font-semibold text-muted-foreground py-0.5">{wd}</div>
        ))}
        {days.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const key = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
          const selected = key === value;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "aspect-square rounded-md text-xs tabular-nums transition-all",
                selected
                  ? "bg-primary text-primary-foreground font-bold"
                  : isToday
                    ? "border border-primary/60 text-primary font-semibold"
                    : "hover:bg-muted text-foreground/80"
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Дата + время ------------------------------ */

interface DateTimePickerProps {
  /** timestamp или null, если время не выбрано */
  value: number | null;
  onChange: (value: number | null) => void;
  /** заголовок блока */
  title?: string;
  /** показать кнопку «Убрать» */
  clearable?: boolean;
  compact?: boolean;
}

export function DateTimePicker({ value, onChange, title = "Когда", clearable = true, compact }: DateTimePickerProps) {
  const initial = value ? new Date(value) : (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  })();
  const [dayKey, setDayKey] = useState(dateKey(initial));
  const [hour, setHour] = useState(initial.getHours());
  const [minute, setMinute] = useState(initial.getMinutes());

  const emit = (key: string, h: number, m: number) => {
    const [y, mo, d] = key.split("-").map(Number);
    onChange(new Date(y, mo - 1, d, h, m, 0, 0).getTime());
  };

  const setDay = (key: string) => {
    setDayKey(key);
    emit(key, hour, minute);
  };
  const setTime = (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    emit(dayKey, h, m);
  };

  const shiftDay = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDay(dateKey(d));
  };

  const todayKey = dateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="rounded-xl border border-border bg-background/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        {clearable && value !== null && (
          <button onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X size={12} /> убрать
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <button
          onClick={() => shiftDay(0)}
          className={cn("text-xs px-2.5 py-1 rounded-full border", dayKey === todayKey ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
        >
          Сегодня
        </button>
        <button
          onClick={() => shiftDay(1)}
          className={cn("text-xs px-2.5 py-1 rounded-full border", dayKey === dateKey(tomorrow) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
        >
          Завтра
        </button>
        <span className="text-xs px-2.5 py-1 rounded-full bg-muted/60 tabular-nums">
          {dayKey.split("-").reverse().join(".")} · {pad2(hour)}:{pad2(minute)}
        </span>
      </div>

      <div className={cn("flex gap-4", compact ? "flex-col items-center" : "flex-col sm:flex-row sm:items-start")}>
        <MiniCalendar value={dayKey} onChange={setDay} compact />
        <ClockPicker hour={hour} minute={minute} onChange={setTime} compact />
      </div>
    </div>
  );
}
