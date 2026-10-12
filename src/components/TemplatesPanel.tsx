import { useState, useEffect } from "react";
import { describeRecurrence } from "@/lib/recurring";
import { TaskTemplate, CategoryId, CATEGORIES, DEFAULT_SUBCATEGORIES } from "@/types";
import { CategoryIcon } from "@/components/CategoryIcon";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ToggleLeft, ToggleRight, ListRestart, MoreVertical, Pencil } from "lucide-react";
import { getCustomSubcategoriesSync } from "@/lib/taskStore";
import { RecurrenceFields, RecurrencePatch } from "@/components/RecurrenceFields";
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
          Пока нет регулярных дел.
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
          <Plus size={16} /> Новое регулярное дело
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
  const [sched, setSched] = useState<RecurrencePatch | null>(null);

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
      ...(sched ?? {}),
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

      <RecurrenceFields initial={initial} onChange={setSched} />

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
