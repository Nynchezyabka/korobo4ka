import { useState, useRef, useEffect } from "react";
import { CategoryId, CATEGORIES, DEFAULT_SUBCATEGORIES, RecurrenceType, RECURRENCE_LABELS, WEEKDAYS } from "@/types";
import { getCustomSubcategoriesSync, saveCustomSubcategories } from "@/lib/taskStore";
import { cn } from "@/lib/utils";
import { X, Plus, Repeat, CalendarClock } from "lucide-react";
import { DateTimePicker, ClockPicker, pad2 } from "@/components/DateTimePicker";

interface Props {
  defaultCategory: CategoryId;
  restrictCategories: CategoryId[] | null;
  onAdd: (
    text: string,
    category: CategoryId,
    subcategory?: string,
    recurrence?: { type: "daily"|"weekly"|"monthly"; hour: number; minute?: number; day?: number },
    scheduledFor?: number | null
  ) => void;
  onClose: () => void;
}

export function AddTaskModal({ defaultCategory, restrictCategories, onAdd, onClose }: Props) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [subcategory, setSubcategory] = useState<string>("");
  const [customSubInput, setCustomSubInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSubs, setCustomSubs] = useState(() => getCustomSubcategoriesSync());
  const [recurEnabled, setRecurEnabled] = useState(false);
  const [recurType, setRecurType] = useState<RecurrenceType>("daily");
  const [recurHour, setRecurHour] = useState(9);
  const [recurMinute, setRecurMinute] = useState(0);
  const [recurDay, setRecurDay] = useState(1);
  const [showClock, setShowClock] = useState(false);
  const [whenEnabled, setWhenEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    setSubcategory("");
    setShowCustomInput(false);
  }, [category]);

  const cats = restrictCategories ?? ([0, 1, 2, 5, 3, 4] as CategoryId[]);

  const getSubcategories = (cat: CategoryId): string[] => {
    const defaults = DEFAULT_SUBCATEGORIES[cat] || [];
    const custom = customSubs[String(cat)] || [];
    return [...defaults, ...custom.filter((c) => !defaults.includes(c))];
  };

  const addCustomSubcategory = () => {
    const val = customSubInput.trim();
    if (!val) return;
    const key = String(category);
    const updated = { ...customSubs };
    if (!updated[key]) updated[key] = [];
    if (!updated[key].includes(val) && !(DEFAULT_SUBCATEGORIES[category] || []).includes(val)) {
      updated[key] = [...updated[key], val];
      setCustomSubs(updated);
      saveCustomSubcategories(updated);
    }
    setSubcategory(val);
    setCustomSubInput("");
    setShowCustomInput(false);
  };

  const catBgMap: Record<CategoryId, string> = {
    0: "bg-cat-0-bg",
    1: "bg-cat-1-bg",
    2: "bg-cat-2-bg",
    3: "bg-cat-3-bg",
    4: "bg-cat-4-bg",
    5: "bg-cat-5-bg",
  };

  const catBorderMap: Record<CategoryId, string> = {
    0: "border-cat-0",
    1: "border-cat-1",
    2: "border-cat-2",
    3: "border-cat-3",
    4: "border-cat-4",
    5: "border-cat-5",
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    const recurrence = recurEnabled
      ? { type: recurType, hour: recurHour, minute: recurMinute, day: recurType === "daily" ? undefined : recurDay }
      : undefined;
    onAdd(text, category, subcategory || undefined, recurrence, whenEnabled ? scheduledFor : null);
    setText("");
    textRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-md rounded-xl p-5 shadow-lg relative max-h-[90vh] overflow-y-auto",
          catBgMap[category]
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md active:bg-black/10"
        >
          <X size={18} />
        </button>

        <h3 className="font-display text-2xl text-foreground mb-3">Добавить задачу</h3>

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите задачу или несколько (каждая с новой строки)..."
          className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-white/70 resize-y text-sm"
        />

        {/* Category picker */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-full border-2 transition-all font-medium",
                catBgMap[c],
                category === c
                  ? cn(catBorderMap[c], "shadow-sm")
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              {CATEGORIES[c].name}
            </button>
          ))}
        </div>

        {/* Subcategory picker */}
        {getSubcategories(category).length > 0 && (
          <div className="mt-2.5">
            <div className="text-xs text-foreground/60 mb-1">Подкатегория:</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSubcategory("")}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border transition-all",
                  !subcategory
                    ? "border-foreground/30 bg-white/60 font-semibold"
                    : "border-transparent bg-white/30 opacity-70 hover:opacity-100"
                )}
              >
                Без подкатегории
              </button>
              {getSubcategories(category).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSubcategory(sub)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-full border transition-all",
                    subcategory === sub
                      ? "border-foreground/30 bg-white/60 font-semibold"
                      : "border-transparent bg-white/30 opacity-70 hover:opacity-100"
                  )}
                >
                  {sub}
                </button>
              ))}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="text-xs px-2 py-1 rounded-full border border-dashed border-foreground/20 bg-white/20 opacity-70 hover:opacity-100 flex items-center gap-0.5"
                >
                  <Plus size={10} /> Своя
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customSubInput}
                    onChange={(e) => setCustomSubInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomSubcategory()}
                    placeholder="Название..."
                    className="text-xs px-2 py-1 rounded-full border border-foreground/20 bg-white/60 w-24"
                    autoFocus
                  />
                  <button
                    onClick={addCustomSubcategory}
                    className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Дата и время (опционально) */}
        <div className="mt-3 rounded-lg bg-white/40 border border-white/60 p-2.5">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={whenEnabled}
              onChange={(e) => {
                setWhenEnabled(e.target.checked);
                if (e.target.checked && scheduledFor === null) {
                  const d = new Date();
                  d.setMinutes(0, 0, 0);
                  d.setHours(d.getHours() + 1);
                  setScheduledFor(d.getTime());
                }
              }}
            />
            <CalendarClock size={14} /> Дата и время
          </label>
          {whenEnabled && (
            <div className="mt-2">
              <DateTimePicker value={scheduledFor} onChange={setScheduledFor} title="Когда напомнить" clearable={false} />
            </div>
          )}
        </div>

        {/* Recurrence block */}
        <div className="mt-3 rounded-lg bg-white/40 border border-white/60 p-2.5">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={recurEnabled} onChange={(e) => setRecurEnabled(e.target.checked)} />
            <Repeat size={14} /> Повторять
          </label>
          {recurEnabled && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={recurType}
                onChange={(e) => setRecurType(e.target.value as RecurrenceType)}
                className="text-xs px-2 py-1 rounded border border-border bg-white/70"
              >
                {(["daily","weekly","monthly"] as RecurrenceType[]).map((r) => (
                  <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                ))}
              </select>
              {recurType === "weekly" && (
                <select value={recurDay} onChange={(e) => setRecurDay(parseInt(e.target.value))} className="text-xs px-2 py-1 rounded border border-border bg-white/70">
                  {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              )}
              {recurType === "monthly" && (
                <input type="number" min={1} max={31} value={recurDay} onChange={(e) => setRecurDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))} className="w-14 text-xs px-2 py-1 rounded border border-border bg-white/70 text-center" />
              )}
              <span className="text-xs">в</span>
              <button
                onClick={() => setShowClock((v) => !v)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-white/70 tabular-nums font-medium"
              >
                {pad2(recurHour)}:{pad2(recurMinute)}
              </button>
              {showClock && (
                <div className="basis-full flex justify-center py-2">
                  <ClockPicker
                    hour={recurHour}
                    minute={recurMinute}
                    onChange={(h, m) => { setRecurHour(h); setRecurMinute(m); }}
                    compact
                  />
                </div>
              )}
              <span className="text-xs text-foreground/60 basis-full">Шаблон автоматически появится в разделе «Повторяющиеся задачи».</span>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-4">
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium active:scale-[0.98] transition-all"
          >
            Добавить
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium active:scale-[0.98] transition-all"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
