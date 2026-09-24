import { useState, useMemo } from "react";
import { Task, CATEGORIES, CategoryId } from "@/types";
import { useApp } from "@/App";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ChevronLeft, ChevronRight, Plus, Clock, Undo2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClockPicker, pad2 } from "@/components/DateTimePicker";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const CAT_COLORS: Record<CategoryId, { bg: string; border: string }> = {
  0: { bg: "bg-[var(--color-cat-0-bg)]", border: "border-[var(--color-cat-0)]" },
  1: { bg: "bg-[var(--color-cat-1-bg)]", border: "border-[var(--color-cat-1)]" },
  2: { bg: "bg-[var(--color-cat-2-bg)]", border: "border-[var(--color-cat-2)]" },
  3: { bg: "bg-[var(--color-cat-3-bg)]", border: "border-[var(--color-cat-3)]" },
  4: { bg: "bg-[var(--color-cat-4-bg)]", border: "border-[var(--color-cat-4)]" },
  5: { bg: "bg-[var(--color-cat-5-bg)]", border: "border-[var(--color-cat-5)]" },
};

const DOT_COLORS: Record<CategoryId, string> = {
  0: "bg-[var(--color-cat-0)]",
  1: "bg-[var(--color-cat-1)]",
  2: "bg-[var(--color-cat-2)]",
  3: "bg-[var(--color-cat-3)]",
  4: "bg-[var(--color-cat-4)]",
  5: "bg-[var(--color-cat-5)]",
};

export function HistoryModal() {
  const { tasks, setTasks } = useApp();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(dateKey(today));

  const [manualText, setManualText] = useState("");
  const [manualCategory, setManualCategory] = useState<CategoryId>(1);
  const [manualDuration, setManualDuration] = useState(15);
  const [manualHour, setManualHour] = useState(12);
  const [showManualClock, setShowManualClock] = useState(false);
  const [manualMinute, setManualMinute] = useState(0);

  // #1: Show tasks that are completed OR have timeSpent > 0
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if ((t.completed || (t.timeSpent && t.timeSpent > 0)) && t.statusChangedAt) {
        const d = new Date(t.statusChangedAt);
        const key = dateKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.statusChangedAt - b.statusChangedAt));
    return map;
  }, [tasks]);

  // Scheduled (future) tasks bucketed by date
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.scheduledFor && !t.completed) {
        const d = new Date(t.scheduledFor);
        const key = dateKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    });
    return map;
  }, [tasks]);

  const todayKey = dateKey(today);
  const isFutureSelected = selectedDate > todayKey;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    let startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }, [viewMonth, viewYear]);

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const selectedTotalTime = selectedTasks.reduce((s, t) => s + (t.timeSpent ?? 0), 0);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleAddManual = () => {
    if (!manualText.trim()) return;
    const [year, month, day] = selectedDate.split("-").map(Number);
    const isFuture = selectedDate > todayKey;
    setTasks((prev) => {
      const maxId = prev.reduce((m, t) => Math.max(m, t.id), 0);
      if (isFuture) {
        const scheduledFor = new Date(year, month - 1, day, manualHour, manualMinute).getTime();
        const newTask: Task = {
          id: maxId + 1,
          text: manualText.trim(),
          category: manualCategory,
          completed: false,
          active: true,
          statusChangedAt: Date.now(),
          scheduledFor,
        };
        return [...prev, newTask];
      } else {
        const completedAt = new Date(year, month - 1, day, manualHour, manualMinute).getTime();
        const newTask: Task = {
          id: maxId + 1,
          text: manualText.trim(),
          category: manualCategory,
          completed: true,
          active: false,
          statusChangedAt: completedAt,
          timeSpent: manualDuration * 60,
        };
        return [...prev, newTask];
      }
    });
    setManualText("");
    setManualDuration(15);
  };

  // Remove from history: return to active tasks
  const removeFromHistory = (taskId: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed: false, active: true, statusChangedAt: Date.now() }
          : t
      )
    );
  };

  // Delete task entirely
  const deleteFromHistory = (taskId: number) => {
    deleteWithUndo(setTasks as any, taskId);
  };

  const selParts = selectedDate.split("-").map(Number);
  const selDateStr = `${selParts[2]} ${MONTH_NAMES[selParts[1] - 1]} ${selParts[0]}`;

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-2xl sm:text-3xl text-primary mb-4">📅 Календарь</h2>

      {/* Calendar */}
      <div className="mb-4 sm:max-w-md">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-sm sm:text-base">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center border border-border rounded-md overflow-hidden">
          {WEEKDAY_HEADERS.map((wd) => (
            <div key={wd} className="text-xs sm:text-[11px] font-semibold text-muted-foreground py-1 bg-muted/40 border-b border-border">{wd}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="aspect-square sm:aspect-auto sm:h-9 border-r border-b border-border/50 last:border-r-0 bg-muted/10" />;
            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const count = tasksByDate.get(key)?.length ?? 0;
            const scheduledCount = scheduledByDate.get(key)?.length ?? 0;
            const isSelected = key === selectedDate;
            const isToday = key === dateKey(today);
            const isFuture = key > todayKey;
            const colIdx = i % 7;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={cn(
                  "relative aspect-square sm:aspect-auto sm:h-9 flex flex-col items-center justify-center text-xs sm:text-[11px] transition-all border-b border-border/50",
                  colIdx < 6 && "border-r border-border/50",
                  isSelected ? "bg-primary text-primary-foreground font-bold" :
                  isToday ? "bg-accent/30 font-semibold" :
                  "hover:bg-muted/50"
                )}
              >
                {day}
                {count > 0 && !isFuture && (
                  <span className={cn(
                    "absolute bottom-0.5 text-[8px] sm:text-[9px] font-bold leading-none",
                    isSelected ? "text-primary-foreground/80" : "text-primary"
                  )}>
                    {count}
                  </span>
                )}
                {scheduledCount > 0 && isFuture && (
                  <span className={cn(
                    "absolute bottom-0.5 text-[8px] sm:text-[9px] font-bold leading-none",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    📅{scheduledCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily activity (past/today only) */}
      {!isFutureSelected && (
        <div className="border-t border-border pt-3">
          <h3 className="font-display text-lg sm:text-xl text-primary">Активность за день</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">{selDateStr}</p>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground mb-3">
            <span>Задач: <strong className="text-foreground">{selectedTasks.length}</strong></span>
            <span>Время: <strong className="text-foreground">{selectedTotalTime > 0 ? formatTime(selectedTotalTime) : "—"}</strong></span>
          </div>

          {/* Category breakdown */}
          {selectedTasks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from(new Set(selectedTasks.map((t) => t.category))).map((cat) => {
                const catTasks = selectedTasks.filter((t) => t.category === cat);
                const catTime = catTasks.reduce((s, t) => s + (t.timeSpent ?? 0), 0);
                return (
                  <span key={cat} className={cn("inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-0.5 rounded-full", CAT_COLORS[cat].bg)}>
                    <CategoryIcon category={cat} size={12} />
                    {catTasks.length} · {catTime > 0 ? formatTime(catTime) : "—"}
                  </span>
                );
              })}
            </div>
          )}

          {/* Timeline stickers */}
          {selectedTasks.length > 0 ? (
            <div className="relative pl-5 mb-4">
              <div className="absolute left-2 top-0 bottom-0 w-1 bg-border rounded-full" />
              {selectedTasks.map((task) => {
                const completedAt = new Date(task.statusChangedAt);
                const durationMin = Math.round((task.timeSpent ?? 0) / 60);
                const startTime = task.timeSpent
                  ? new Date(task.statusChangedAt - (task.timeSpent * 1000))
                  : completedAt;
                const catInfo = CATEGORIES[task.category];
                return (
                  <div key={task.id} className="relative mb-2.5 last:mb-0 group">
                    <div className={cn(
                      "absolute -left-3.5 top-2 w-3.5 h-3.5 rounded-full border-2 border-background",
                      DOT_COLORS[task.category]
                    )} />
                    <div className={cn(
                      "rounded-lg p-3 border-l-4",
                      CAT_COLORS[task.category].bg,
                      CAT_COLORS[task.category].border
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                          {formatHHMM(startTime)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {durationMin > 0 && (
                            <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-0.5">
                              <Clock size={11} /> {durationMin}м
                            </span>
                          )}
                          <button
                            onClick={() => removeFromHistory(task.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 active:bg-black/10 transition-all"
                            title="Вернуть в активные"
                          >
                            <Undo2 size={12} />
                          </button>
                          <button
                            onClick={() => deleteFromHistory(task.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 active:bg-black/10 transition-all text-red-500"
                            title="Удалить задачу"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm sm:text-base font-medium leading-snug mb-1.5">
                        {task.text}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span className={cn(
                          "text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-semibold",
                          DOT_COLORS[task.category], "text-white"
                        )}>
                          {catInfo.name}
                        </span>
                        {task.subcategory && (
                          <span className={cn(
                            "text-[10px] sm:text-xs px-1.5 py-0.5 rounded",
                            CAT_COLORS[task.category].bg,
                            "border border-current opacity-70"
                          )}>
                            {task.subcategory}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm sm:text-base py-4">
              Нет записей за этот день
            </p>
          )}
        </div>
      )}

      {/* Future-day scheduled list */}
      {isFutureSelected && (
        <div className="border-t border-border pt-3">
          <h3 className="font-display text-lg sm:text-xl text-primary">📅 Запланировано</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3">{selDateStr}</p>
          {(scheduledByDate.get(selectedDate) ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-3">Пока ничего не запланировано</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {(scheduledByDate.get(selectedDate) ?? []).map((task) => (
                <div key={task.id} className={cn("rounded-lg p-2.5 border-l-4 group flex items-center gap-2", CAT_COLORS[task.category].bg, CAT_COLORS[task.category].border)}>
                  <CategoryIcon category={task.category} size={14} />
                  <span className="text-xs font-mono text-muted-foreground">{formatHHMM(new Date(task.scheduledFor!))}</span>
                  <span className="text-sm font-medium flex-1 truncate">{task.text}</span>
                  <button onClick={() => deleteFromHistory(task.id)} className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-500" title="Удалить"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual / scheduled task entry */}
      <div className="border-t border-border pt-3">
        <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">
          {isFutureSelected ? "Добавить задачу" : "Добавить задачу вручную"}
        </h4>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={isFutureSelected ? "Новая задача" : "Введите задачу, которую вы делали в этот день"}
          rows={2}
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm sm:text-base placeholder:text-muted-foreground/60 mb-2 resize-none"
        />
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StyledCategoryPicker value={manualCategory} onChange={setManualCategory} />
          {!isFutureSelected && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={480}
                value={manualDuration}
                onChange={(e) => setManualDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs sm:text-sm text-center"
              />
              <span className="text-xs sm:text-sm text-muted-foreground">мин</span>
            </div>
          )}
          <button
            onClick={() => setShowManualClock((v) => !v)}
            className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs sm:text-sm tabular-nums font-medium"
            title="Выбрать время"
          >
            🕐 {pad2(manualHour)}:{pad2(manualMinute)}
          </button>
          <button
            onClick={handleAddManual}
            disabled={!manualText.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm font-medium disabled:opacity-40 active:scale-95 transition-all"
          >
            <Plus size={12} /> Добавить
          </button>
          {showManualClock && (
            <div className="basis-full flex justify-center py-2">
              <ClockPicker
                hour={manualHour}
                minute={manualMinute}
                onChange={(h, m) => { setManualHour(h); setManualMinute(m); }}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StyledCategoryPicker({ value, onChange }: { value: CategoryId; onChange: (c: CategoryId) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium border-l-4 border border-border",
          CAT_COLORS[value].bg,
          CAT_COLORS[value].border
        )}
      >
        <CategoryIcon category={value} size={14} />
        {CATEGORIES[value].name}
      </button>
      {open && (
        <div className="absolute z-[10200] top-full left-0 mt-1 bg-background rounded-md shadow-lg p-1 min-w-[200px] border border-border">
          {([1, 2, 5, 3, 4] as CategoryId[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={cn(
                "w-full text-left text-xs sm:text-sm px-2 py-1.5 rounded flex items-center gap-1.5 border-l-4 mb-0.5",
                CAT_COLORS[c].bg,
                CAT_COLORS[c].border,
                value === c && "ring-1 ring-primary/40"
              )}
            >
              <CategoryIcon category={c} size={14} />
              {CATEGORIES[c].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
