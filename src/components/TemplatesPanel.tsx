import { useState } from "react";
import { TaskTemplate, CategoryId, CATEGORIES, RecurrenceType, RECURRENCE_LABELS, WEEKDAYS, DEFAULT_SUBCATEGORIES } from "@/types";
import { CategoryIcon } from "@/components/CategoryIcon";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ToggleLeft, ToggleRight, Repeat } from "lucide-react";
import { getCustomSubcategoriesSync } from "@/lib/taskStore";

interface Props {
  templates: TaskTemplate[];
  onSave: (templates: TaskTemplate[]) => void;
}

export function TemplatesPanel({ templates, onSave }: Props) {
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  const deleteTemplate = (id: number) => {
    onSave(templates.filter((t) => t.id !== id));
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
        <Repeat size={22} /> Повторяющиеся задачи
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
                  {RECURRENCE_LABELS[tpl.recurrence]}
                  {tpl.recurrence === "weekly" && tpl.recurrenceDay !== undefined && ` · ${WEEKDAYS[tpl.recurrenceDay]}`}
                  {tpl.recurrence === "monthly" && tpl.recurrenceDay !== undefined && ` · ${tpl.recurrenceDay} числа`}
                  {` · в ${tpl.recurrenceHour}:00`}
                  {tpl.subcategory && ` · ${tpl.subcategory}`}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => toggleTemplate(tpl.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                  {tpl.active ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} />}
                </button>
                <button onClick={() => { setEditing(tpl); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted transition-colors text-xs">
                  ✏️
                </button>
                <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <TemplateForm
          initial={editing || { id: nextId, text: "", category: 1 as CategoryId, recurrence: "daily", recurrenceHour: 9, active: true }}
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
      recurrenceDay: recurrence === "daily" ? undefined : recurrenceDay,
      recurrenceHour,
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

      {/* Recurrence — buttons on desktop, select on mobile */}
      <div className="mb-2">
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
          className="sm:hidden w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
        >
          {(["daily","weekly","monthly"] as RecurrenceType[]).map((r) => (
            <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
          ))}
        </select>
        <div className="hidden sm:flex gap-1">
          {(["daily", "weekly", "monthly"] as RecurrenceType[]).map((r) => (
            <button
              key={r}
              onClick={() => setRecurrence(r)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-all",
                recurrence === r ? "border-primary bg-primary/10 font-semibold" : "border-border opacity-70"
              )}
            >
              {RECURRENCE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Day selector */}
      {recurrence === "weekly" && (
        <div className="mb-2">
          <select
            value={recurrenceDay}
            onChange={(e) => setRecurrenceDay(parseInt(e.target.value))}
            className="sm:hidden w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <div className="hidden sm:flex gap-1">
            {WEEKDAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => setRecurrenceDay(i)}
                className={cn(
                  "text-xs w-8 h-8 rounded-full border transition-all",
                  recurrenceDay === i ? "border-primary bg-primary/10 font-bold" : "border-border opacity-60"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurrence === "monthly" && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs">День месяца:</span>
          <input
            type="number"
            min={1}
            max={31}
            value={recurrenceDay}
            onChange={(e) => setRecurrenceDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
            className="w-14 text-center text-sm rounded border border-border px-2 py-1"
          />
        </div>
      )}

      {/* Hour */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs">Час создания:</span>
        <input
          type="number"
          min={0}
          max={23}
          value={recurrenceHour}
          onChange={(e) => setRecurrenceHour(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
          className="w-14 text-center text-sm rounded border border-border px-2 py-1"
        />
        <span className="text-xs text-muted-foreground">:00</span>
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
