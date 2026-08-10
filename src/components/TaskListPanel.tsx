import { useState, useRef, useCallback } from "react";
import { Task, CategoryId, CATEGORIES, DEFAULT_SUBCATEGORIES } from "@/types";
import { useApp } from "@/App";
import { getCustomSubcategoriesSync, saveCustomSubcategories, getCategoryDisplayName, getCustomCategoryNamesSync, saveCustomCategoryNames, renameSubcategory } from "@/lib/taskStore";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";
import { NextMinuteSheet } from "@/components/NextMinuteSheet";
import { setTaskReminder, clearTaskReminder, hasActiveReminder } from "@/lib/notifications";
import {
  Play, Eye, EyeOff, Trash2, Check, Undo2, FolderOpen, Plus, Pencil, GripVertical, MoreVertical,
  Bell, BellOff, Lightbulb, X, CalendarClock,
} from "lucide-react";

interface Props {
  showArchive: boolean;
  restrictCategories?: CategoryId[] | null;
  onClearFilter?: () => void;
}

export function TaskListPanel({ showArchive, restrictCategories, onClearFilter }: Props) {
  const { tasks, setTasks, openTimer, openAddModal, completeTaskWithRecurrence } = useApp();
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  // #3: Categories collapsed by default
  const [collapsedCats, setCollapsedCats] = useState<Set<CategoryId>>(
    () => new Set([0, 1, 2, 3, 4, 5] as CategoryId[])
  );
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());
  const [renamingCat, setRenamingCat] = useState<CategoryId | null>(null);
  const [renameCatText, setRenameCatText] = useState("");
  const [renamingSub, setRenamingSub] = useState<{ cat: CategoryId; sub: string } | null>(null);
  const [renameSubText, setRenameSubText] = useState("");
  const [nextMinuteTask, setNextMinuteTask] = useState<Task | null>(null);
  const [reminderTask, setReminderTask] = useState<Task | null>(null);

  const source = tasks
    .filter((t) => (showArchive ? t.completed : !t.completed))
    .filter((t) => !restrictCategories || restrictCategories.includes(t.category));

  // Group by category
  const groups = new Map<CategoryId, Task[]>();
  source.forEach((t) => {
    const cat = t.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(t);
  });

  const categoryOrder = Array.from(groups.keys()).sort((a, b) => a - b);

  const toggleActive = (id: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, active: !t.active, statusChangedAt: Date.now() } : t
      )
    );
  };

  const deleteTask = (id: number) => {
    clearTaskReminder(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const completeTask = (id: number) => {
    clearTaskReminder(id);
    completeTaskWithRecurrence(id);
  };

  const returnTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: false, active: true, statusChangedAt: Date.now() } : t
      )
    );
  };

  const setTaskReminderAt = (task: Task, scheduledFor: number | null) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, scheduledFor: scheduledFor ?? undefined }
          : t
      )
    );
    clearTaskReminder(task.id);
    if (scheduledFor && scheduledFor > Date.now()) {
      setTaskReminder(task.id, task.text, Math.ceil((scheduledFor - Date.now()) / (60 * 1000)));
    }
  };

  const changeCategory = (id: number, newCat: CategoryId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, category: newCat };
        if (t.category === 0 && !t.active && newCat !== 0) {
          updated.active = true;
          updated.statusChangedAt = Date.now();
        }
        if (t.category !== newCat) delete updated.subcategory;
        return updated;
      })
    );
  };

  const updateTaskText = (id: number, text: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text } : t))
    );
  };

  const updateTaskSubcategory = (id: number, subcategory: string | undefined) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t };
        if (subcategory) updated.subcategory = subcategory;
        else delete updated.subcategory;
        return updated;
      })
    );
  };

  // Drag & drop reorder
  const handleDrop = useCallback((targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setTasks((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((t) => t.id === dragId);
      const toIdx = arr.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDragId(null);
    setDragOverId(null);
  }, [dragId, setTasks]);

  const toggleCat = (cat: CategoryId) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleSub = (cat: CategoryId, sub: string) => {
    const key = `${cat}-${sub}`;
    setCollapsedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRenameCat = (cat: CategoryId) => {
    const name = renameCatText.trim();
    if (name) {
      const custom = getCustomCategoryNamesSync();
      custom[String(cat)] = name;
      saveCustomCategoryNames(custom);
    }
    setRenamingCat(null);
  };

  const handleRenameSub = () => {
    if (!renamingSub) return;
    const newName = renameSubText.trim();
    if (newName && newName !== renamingSub.sub) {
      const { updatedSubs, updatedTasks } = renameSubcategory(
        renamingSub.cat, renamingSub.sub, newName, tasks
      );
      saveCustomSubcategories(updatedSubs);
      setTasks(() => updatedTasks);
    }
    setRenamingSub(null);
  };

  const filterLabel = restrictCategories && restrictCategories.length > 0
    ? restrictCategories.map((c) => getCategoryDisplayName(c)).join(", ")
    : null;

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-2xl text-primary mb-3">
        {showArchive ? "✅ Выполненные" : "📋 Все задачи"}
      </h2>

      {filterLabel && (
        <div className="mb-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm">
          <span>Секция: <strong>{filterLabel}</strong></span>
          <button onClick={onClearFilter} className="p-0.5 rounded hover:bg-primary/15" title="Сбросить">
            <Plus size={12} className="rotate-45" />
          </button>
        </div>
      )}

      {categoryOrder.length === 0 && (
        <p className="text-center text-muted-foreground py-8 animate-fade-in">
          {showArchive ? "Нет выполненных задач" : "Нет задач. Добавьте первую!"}
        </p>
      )}

      {categoryOrder.map((cat) => {
        const catTasks = groups.get(cat)!;
        catTasks.sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          return (a.statusChangedAt || 0) - (b.statusChangedAt || 0);
        });

        // Group by subcategory
        const subGroups = new Map<string, Task[]>();
        catTasks.forEach((t) => {
          const sub = t.subcategory || "";
          if (!subGroups.has(sub)) subGroups.set(sub, []);
          subGroups.get(sub)!.push(t);
        });
        const subKeys = Array.from(subGroups.keys()).sort((a, b) => {
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b, "ru");
        });

        return (
          <div key={cat} className="mb-4 animate-fade-in bg-white/30 dark:bg-white/5 rounded-lg p-2 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              {renamingCat === cat ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    value={renameCatText}
                    onChange={(e) => setRenameCatText(e.target.value)}
                    onBlur={() => handleRenameCat(cat)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameCat(cat); if (e.key === "Escape") setRenamingCat(null); }}
                    className="flex-1 text-sm px-2 py-1 rounded border border-border bg-white/70 dark:bg-white/10 outline-none"
                    autoFocus
                  />
                </div>
              ) : (
                <button 
                  onClick={() => toggleCat(cat)}
                  className="flex items-center gap-2 flex-1 text-left p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <CategoryIcon category={cat} size={18} />
                  <span className="font-semibold text-sm sm:text-base">{getCategoryDisplayName(cat)} <span className="text-xs font-normal opacity-60">({catTasks.length})</span></span>
                </button>
              )}
              {!showArchive && renamingCat !== cat && (
                <>
                  <button
                    onClick={() => { setRenameCatText(getCategoryDisplayName(cat)); setRenamingCat(cat); }}
                    className="p-1 rounded-md hover:bg-black/5 active:bg-black/10 transition-colors opacity-40 hover:opacity-70"
                    title="Переименовать категорию"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => openAddModal(cat)}
                    className="p-1.5 rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </>
              )}
            </div>
            
            {!collapsedCats.has(cat) && (
              <div className="pl-1 space-y-3 mt-2">
                {subKeys.map((sub) => {
                  const subKey = `${cat}-${sub}`;
                  const isCollapsed = collapsedSubs.has(subKey);
                  return (
                    <div key={sub || "__none"}>
                      {sub && (
                        <div className="flex items-center gap-1 mb-1.5">
                          {renamingSub?.cat === cat && renamingSub?.sub === sub ? (
                            <input
                              value={renameSubText}
                              onChange={(e) => setRenameSubText(e.target.value)}
                              onBlur={handleRenameSub}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRenameSub(); if (e.key === "Escape") setRenamingSub(null); }}
                              className="text-sm px-2 py-0.5 rounded border border-border bg-white/70 dark:bg-white/10 outline-none flex-1"
                              autoFocus
                            />
                          ) : (
                            <>
                              <button 
                                onClick={() => toggleSub(cat, sub)}
                                className="flex items-center gap-1.5 text-left text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors"
                              >
                                <span className="w-4 text-center">{isCollapsed ? "+" : "−"}</span>
                                {sub} <span className="text-xs font-normal opacity-50">({subGroups.get(sub)!.length})</span>
                              </button>
                              {!showArchive && (
                                <button
                                  onClick={() => { setRenameSubText(sub); setRenamingSub({ cat, sub }); }}
                                  className="p-0.5 rounded hover:bg-black/5 opacity-30 hover:opacity-60 transition-opacity"
                                  title="Переименовать подкатегорию"
                                >
                                  <Pencil size={10} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {(!sub || !isCollapsed) && (
                        <div className="flex flex-col gap-2">
                          {subGroups.get(sub)!.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            showArchive={showArchive}
                            isDragOver={dragOverId === task.id}
                            onStart={() => openTimer(task)}
                            onToggle={() => toggleActive(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            onComplete={() => completeTask(task.id)}
                            onReturn={() => returnTask(task.id)}
                            onChangeCategory={(newCat) => changeCategory(task.id, newCat)}
                            onUpdateText={(text) => updateTaskText(task.id, text)}
                            onUpdateSubcategory={(sub) => updateTaskSubcategory(task.id, sub)}
                            onSetReminder={(ts) => setTaskReminderAt(task, ts)}
                            onOpenNextMinute={() => setNextMinuteTask(task)}
                            onDragStart={() => setDragId(task.id)}
                            onDragOver={() => setDragOverId(task.id)}
                            onDrop={() => handleDrop(task.id)}
                            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                          />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  showArchive: boolean;
  isDragOver: boolean;
  onStart: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onReturn: () => void;
  onChangeCategory: (cat: CategoryId) => void;
  onUpdateText: (text: string) => void;
  onUpdateSubcategory: (sub: string | undefined) => void;
  onSetReminder: (ts: number | null) => void;
  onOpenNextMinute: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TaskCard({
  task, showArchive, isDragOver,
  onStart, onToggle, onDelete, onComplete, onReturn, onChangeCategory,
  onUpdateText, onUpdateSubcategory,
  onSetReminder, onOpenNextMinute,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: TaskCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState<string>("");
  const [reminderTime, setReminderTime] = useState<string>("12:00");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editingSub, setEditingSub] = useState(false);
  const [addingCustomSub, setAddingCustomSub] = useState(false);
  const [customSubInput, setCustomSubInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLDivElement>(null);

  const hasReminder = Boolean(task.scheduledFor && task.scheduledFor > Date.now());

  const applyReminder = () => {
    if (!reminderDate || !reminderTime) return;
    const [h, m] = reminderTime.split(":").map(Number);
    const d = new Date(reminderDate);
    d.setHours(h, m, 0, 0);
    onSetReminder(d.getTime());
    setShowReminder(false);
  };

  const clearReminder = () => {
    onSetReminder(null);
    setShowReminder(false);
  };

  const openReminder = () => {
    const initial = task.scheduledFor && task.scheduledFor > Date.now() ? new Date(task.scheduledFor) : new Date();
    setReminderDate(initial.toISOString().split("T")[0]);
    setReminderTime(`${String(initial.getHours()).padStart(2, "0")}:${String(initial.getMinutes()).padStart(2, "0")}`);
    setShowReminder(true);
    setShowActions(false);
  };

  const bgMap: Record<CategoryId, string> = {
    0: "bg-cat-0-bg border-l-4 border-l-cat-0",
    1: "bg-cat-1-bg border-l-4 border-l-cat-1",
    2: "bg-cat-2-bg border-l-4 border-l-cat-2",
    3: "bg-cat-3-bg border-l-4 border-l-cat-3",
    4: "bg-cat-4-bg border-l-4 border-l-cat-4",
    5: "bg-cat-5-bg border-l-4 border-l-cat-5",
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) onUpdateText(trimmed);
    else setEditText(task.text);
    setEditing(false);
  };

  const subcategories = [
    ...(DEFAULT_SUBCATEGORIES[task.category] || []),
    ...((getCustomSubcategoriesSync()[String(task.category)] || []).filter(
      (c: string) => !(DEFAULT_SUBCATEGORIES[task.category] || []).includes(c)
    )),
  ];

  const addCustomSub = () => {
    const val = customSubInput.trim();
    if (!val) return;
    const key = String(task.category);
    const subs = getCustomSubcategoriesSync();
    if (!subs[key]) subs[key] = [];
    if (!subs[key].includes(val) && !(DEFAULT_SUBCATEGORIES[task.category] || []).includes(val)) {
      subs[key] = [...subs[key], val];
      saveCustomSubcategories(subs);
    }
    onUpdateSubcategory(val);
    setCustomSubInput("");
    setAddingCustomSub(false);
    setEditingSub(false);
  };

  return (
    <div
      draggable={!showArchive && !editing}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={cn(
        "p-2.5 rounded-md transition-all relative group",
        bgMap[task.category],
        !task.active && "opacity-60",
        task.completed && "opacity-70",
        isDragOver && "ring-2 ring-primary/40 scale-[1.02]",
        "hover:shadow-md",
        showDropdown && "z-10"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        {!showArchive && !editing && (
          <div className="cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-60 transition-opacity pt-0.5">
            <GripVertical size={14} />
          </div>
        )}

        {editing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") { setEditText(task.text); setEditing(false); }
            }}
            className="flex-1 text-sm bg-white/70 dark:bg-white/10 rounded px-2 py-1 border border-border outline-none focus:ring-1 focus:ring-primary/30"
            autoFocus
          />
        ) : (
          <p
            className={cn(
              "flex-1 text-sm sm:text-base leading-snug break-words cursor-text",
              task.completed && "line-through"
            )}
            onClick={() => {
              if (!showArchive) {
                setEditText(task.text);
                setEditing(true);
              }
            }}
          >
            {task.text}
            {task.subcategory && (
              <span
                className="ml-1.5 text-xs opacity-60 italic cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showArchive) setEditingSub(!editingSub);
                }}
              >
                ({task.subcategory})
              </span>
            )}
            {!task.subcategory && !showArchive && subcategories.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditingSub(!editingSub); }}
                className="ml-1 text-xs opacity-40 hover:opacity-70 italic"
              >
                +подкат.
              </button>
            )}
            {task.scheduledFor && task.scheduledFor > Date.now() && (
              <span className="ml-1.5 text-[11px] sm:text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1 align-middle">
                📅 {new Date(task.scheduledFor).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                {" "}
                {new Date(task.scheduledFor).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        )}

        <div className="flex items-center gap-0.5 shrink-0 relative" ref={actionsRef}>
          {!showArchive && !editing && (
            <>
              <button onClick={onStart} className="p-1.5 rounded active:bg-black/10 hover:bg-black/5 transition-colors" title="Таймер">
                <Play size={14} />
              </button>
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 rounded active:bg-black/10 hover:bg-black/5 transition-colors"
                title="Действия"
              >
                <MoreVertical size={14} />
              </button>
              {showActions && (
                <div className="absolute z-[10200] top-full right-0 mt-1 bg-background rounded-md shadow-lg p-1 min-w-[150px] border border-border animate-scale-in">
                  <button
                    onClick={() => { onComplete(); setShowActions(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    <Check size={12} /> Выполнено
                  </button>
                  <button
                    onClick={() => { onToggle(); setShowActions(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    {task.active ? <><EyeOff size={12} /> Скрыть</> : <><Eye size={12} /> Показать</>}
                  </button>
                  <button
                    onClick={openReminder}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    {hasReminder ? <><BellRing size={12} /> Изменить напоминание</> : <><Bell size={12} /> Напомнить</>}
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowActions(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted text-red-600 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Удалить
                  </button>
                </div>
              )}
            </>
          )}
          {showArchive && (
            <>
              <button onClick={onReturn} className="p-1.5 rounded active:bg-black/10 hover:bg-black/5 transition-colors" title="Вернуть">
                <Undo2 size={14} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded active:bg-black/10 hover:bg-muted transition-colors" title="Удалить">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subcategory inline editor */}
      {editingSub && (
        <div className="mt-1.5 flex flex-wrap gap-1 animate-fade-in">
          <button
            onClick={() => { onUpdateSubcategory(undefined); setEditingSub(false); }}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border transition-all",
              !task.subcategory ? "border-foreground/30 bg-white/60 font-semibold" : "border-transparent bg-white/30 opacity-70"
            )}
          >
            Без
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => { onUpdateSubcategory(sub); setEditingSub(false); }}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full border transition-all",
                task.subcategory === sub ? "border-foreground/30 bg-white/60 font-semibold" : "border-transparent bg-white/30 opacity-70"
              )}
            >
              {sub}
            </button>
          ))}
          {/* Add custom subcategory button */}
          {!addingCustomSub ? (
            <button
              onClick={() => setAddingCustomSub(true)}
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-foreground/20 bg-white/20 opacity-70 hover:opacity-100 flex items-center gap-0.5"
            >
              <Plus size={8} /> Своя
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customSubInput}
                onChange={(e) => setCustomSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomSub(); if (e.key === "Escape") setAddingCustomSub(false); }}
                placeholder="Название..."
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-foreground/20 bg-white/60 w-20"
                autoFocus
              />
              <button
                onClick={addCustomSub}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category dropdown */}
      {!showArchive && !editing && (
        <div className="relative mt-1">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-black/5 active:bg-black/10 hover:bg-black/8 transition-colors"
          >
            <FolderOpen size={10} />
            <span>{getCategoryDisplayName(task.category)}</span>
          </button>
          {showDropdown && (
            <div className="absolute z-[10200] top-full left-0 mt-1 bg-background rounded-md shadow-lg p-1.5 min-w-[160px] border border-border animate-scale-in">
              {([0, 1, 2, 5, 3, 4] as CategoryId[]).map((c) => (
                <button
                  key={c}
                  onClick={() => { onChangeCategory(c); setShowDropdown(false); }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <CategoryIcon category={c} size={12} />
                  {getCategoryDisplayName(c)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
