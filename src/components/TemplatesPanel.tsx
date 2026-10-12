import React, { useState, useEffect } from "react";
import { describeRecurrence } from "@/lib/recurring";
import { TaskTemplate, CategoryId, CATEGORIES, RecurrenceType, WEEKDAYS, DEFAULT_SUBCATEGORIES } from "@/types";
import { CategoryIcon } from "@/components/CategoryIcon";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ToggleLeft, ToggleRight, ListRestart, MoreVertical, Pencil } from "lucide-react";
import { getCustomSubcategoriesSync } from "@/lib/taskStore";
import { ClockPicker, pad2 } from "@/components/DateTimePicker";
import { showUndoToast } from "@/lib/undoDelete";
import { burnInPlace } from "@/lib/paperFx";

interface Props {
  templates: TaskTemplate[];
  onSave: (templates: TaskTemplate[]) => void;
}

export function TemplatesPanel({ templates, onSave }: Props) {
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);

  // Открыть настройки только что перенесённого дела
  useEffect(() => {
    const id = Number(sessionStorage.getItem("editTemplateId"));
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      sessionStorage.removeItem("editTemplateId");
      setEditing(tpl);
      setShowForm(true);
    }
  }, [templates]);

  const deleteTemplate = (id: number) => {
    const index = templates.findIndex((t) => t.id === id);
    const removed = templates[index];
    if (!removed) return;
    onSave(templates.filter((t) => t.id !== id));
    showUndoToast("Регулярное дело удалено", () => {
      const restored = [...templates.filter((t) => t.id !== removed.id)];
      restored.splice(Math.min(Math.max(index, 0), restored.length), 0, removed);
      onSave(restored);
    });
  };

  const toggleTemplate = (id: number) => {
    onSave(templates.map((t) => t.id === id ? { ...t, active: !t.active } : t));
  };

  const saveTemplate = (tpl: TaskTemplate) => {
    const exists = templates.find((t) => t.id === tpl.id);
    if (exists) {
      onSave(templates.map((t) => t.id === tpl.id ? tpl : t));
    } else {
      onSave([...templates, tpl]);
    }
    setEditing(null);
    setShowForm(false);
  };

  const nextId = templates.reduce((max, t) => Math.max(max, t.id), 0) + 1;

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-2xl text-primary flex items-center gap-2 mb-1">
        <ListRestart size={22} /> Регулярные дела
      </h2>
      <div className="mb-3 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs sm:text-sm text-muted-foreground">
        Одна задача, которая сама появляется по расписанию: зарядка каждое утро, оплата счетов 5-го числа.
        Если нужен список шагов к одной цели — это <span className="font-semibold text-foreground">Проекты</span>.
      </div>

      {templates.length === 0 && !showForm && (
        <p className="text-center text-muted-foreground py-6">
          Нет шаблонов. Создайте первый!
        </p>
      )}

      <div className="flex flex-col gap-2 mb-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            data-fx-row
            className={cn(
              "p-3 rounded-md border border-border transition-all",
              tpl.active ? "bg-muted/30" : "bg-muted/10 opacity-60"
            )}
          >
            <div className="flex items-start gap-2">
              <CategoryIcon category={tpl.category} size={16} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tpl.text}</p>
                <p className="text-xs text-muted-foreground">
                  {describeRecurrence(tpl)}
                  {tpl.subcategory && ` · ${tpl.subcategory}`}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => toggleTemplate(tpl.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                  {tpl.active ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} />}
                </button>
                <div className="relative">
                  <button onClick={() => setMenuId(menuId === tpl.id ? null : tpl.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Действия">
                    <MoreVertical size={14} />
                  </button>
                  {menuId === tpl.id && (
                    <div className="absolute z-[10200] top-full right-0 mt-1 bg-background rounded-md shadow-lg p-1 min-w-[150px] border border-border animate-scale-in">
                      <button onClick={() => { setEditing(tpl); setShowForm(true); setMenuId(null); }} className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted flex items-center gap-1.5">
                        <Pencil size={12} /> Изменить
                      </button>
                      <button onClick={(e) => { burnInPlace(e.currentTarget, { text: tpl.text, category: tpl.category }); deleteTemplate(tpl.id); setMenuId(null); }} className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted text-red-600 flex items-center gap-1.5">
                        <Trash2 size={12} /> Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <TemplateForm
          initial={editing || { id: nextId, text: "", category: 1 as CategoryId, recurrence: "daily", recurrenceHour: 9, recurrenceMinute: 0, active: true }}
          onSave={saveTemplate}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      ) : (
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Plus size={16} /> Новый шаблон
        </button>
      )}
    </div>
  );
}

const SCALE_LABELS: Record<RecurrenceType, string> = { daily: "День", weekly: "Неделя", monthly: "Месяц", yearly: "Год" };
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every((x) => a.includes(x));

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
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

function TemplateForm({ initial, onSave, onCancel }: {
  initial: TaskTemplate;
  onSave: (t: TaskTemplate) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [category, setCategory] = useState<CategoryId>(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory || "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initial.recurrence);
  const [recurrenceDay, setRecurrenceDay] = useState(initial.recurrenceDay ?? 1);
  const [recurrenceHour, setRecurrenceHour] = useState(initial.recurrenceHour);
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

  const toggleDay = (d: number) =>
    setRecurrenceDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const customSubs = getCustomSubcategoriesSync();
  const allSubs = [
    ...(DEFAULT_SUBCATEGORIES[category] || []),
    ...((customSubs[String(category)] || []).filter(
      (c: string) => !(DEFAULT_SUBCATEGORIES[category] || []).includes(c)
    )),
  ];

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      ...initial,
      text: text.trim(),
      category,
      subcategory: subcategory || undefined,
      recurrence,
      recurrenceDay: recurrence === "monthly" ? recurrenceDay : recurrence === "yearly" ? Math.max(1, recurrenceDay) : undefined,
      recurrenceMonth: recurrence === "yearly" ? recurrenceMonth : undefined,
      recurrenceDays: recurrence === "weekly" ? (recurrenceDays.length ? recurrenceDays : [new Date().getDay()]) : undefined,
      recurrenceInterval: Math.max(1, interval),
      until: untilOn && until ? until : undefined,
      recurrenceHour,
      recurrenceMinute,
    });
  };

  return (
    <div className="p-3 rounded-md border border-border bg-muted/20 animate-fade-in">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Текст задачи"
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm mb-2"
        autoFocus
      />

      {/* Category */}
      <div className="flex flex-wrap gap-1 mb-2">
        {([1, 2, 5, 3, 4] as CategoryId[]).map((c) => (
          <button
            key={c}
            onClick={() => { setCategory(c); setSubcategory(""); }}
            className={cn(
              "text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-all",
              category === c ? "border-primary bg-primary/10 font-semibold" : "border-border bg-background opacity-70"
            )}
          >
            <CategoryIcon category={c} size={10} />
            {CATEGORIES[c].name}
          </button>
        ))}
      </div>

      {/* Subcategory */}
      {allSubs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={() => setSubcategory("")}
            className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", !subcategory ? "border-primary font-semibold" : "border-border opacity-60")}
          >
            Без
          </button>
          {allSubs.map((s) => (
            <button
              key={s}
              onClick={() => setSubcategory(s)}
              className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", subcategory === s ? "border-primary font-semibold" : "border-border opacity-60")}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Повторение: масштаб + компактное уточнение */}
      <div className="mb-2 flex gap-1">
        {(["daily", "weekly", "monthly", "yearly"] as RecurrenceType[]).map((r) => (
          <button
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

      {/* Срок */}
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

      {/* Время */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">Время:</span>
          <button
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

      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-all">
          Сохранить
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm active:scale-[0.98] transition-all">
          Отмена
        </button>
      </div>
    </div>
  );
}
