import { useState, useCallback, useEffect, createContext, useContext, useRef } from "react";
import { Task, TaskTemplate, CategoryId } from "@/types";
import { initTaskStore, loadTasks, saveTasks, getNextId, exportTasksToFile, importTasksFromFile } from "@/lib/taskStore";
import { dbGetMeta, dbSetMeta } from "@/lib/db";
import { Dashboard } from "@/components/Dashboard";
import { TaskListPanel } from "@/components/TaskListPanel";
import { ProjectsPanel } from "@/components/ProjectsPanel";

import { TimerScreen } from "@/components/TimerScreen";
import { AddTaskModal } from "@/components/AddTaskModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InfoPage } from "@/components/InfoPage";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { AppSidebar, PageId } from "@/components/AppSidebar";
import { HistoryModal } from "@/components/HistoryModal";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { QuickAddBar } from "@/components/QuickAddBar";
import { processRecurringTemplates, createNextInstance } from "@/lib/recurring";
import { sendNotification } from "@/lib/notifications";
import { toast } from "sonner";

interface AppContextValue {
  tasks: Task[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
  openTimer: (task: Task) => void;
  openAddModal: (category?: CategoryId, restrictCategories?: CategoryId[]) => void;
  templates: TaskTemplate[];
  saveTemplates: (tpls: TaskTemplate[]) => void;
  completeTaskWithRecurrence: (id: number) => void;
  addQuickTask: (text: string, scheduledFor?: number, category?: CategoryId) => void;
}

export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);

const REMINDERS_KEY = "daily_reminders";
const REMINDER_LAST_KEY = "daily_reminders_last";

interface DailyReminders {
  enabled: boolean;
  times: string[]; // ["09:00", "18:00"]
}

function loadReminders(): DailyReminders {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, times: ["09:00"] };
}

function formatTodayHeader(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export default function App() {
  const [tasks, setTasksRaw] = useState<Task[]>([]);
  const [templates, setTemplatesRaw] = useState<TaskTemplate[]>([]);
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [timerTask, setTimerTask] = useState<Task | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<CategoryId>(0);
  const [addModalRestrict, setAddModalRestrict] = useState<CategoryId[] | null>(null);
  const [tasksFilter, setTasksFilter] = useState<CategoryId[] | null>(null);
  const [headerDate, setHeaderDate] = useState(() => formatTodayHeader(new Date()));

  // Initialize IndexedDB and load tasks + templates
  useEffect(() => {
    Promise.all([
      initTaskStore(),
      dbGetMeta<TaskTemplate[]>("templates"),
    ]).then(([loaded, tpls]) => {
      setTasksRaw(loaded);
      setTemplatesRaw(tpls ?? []);
      if (!localStorage.getItem("onboarding_done") && loaded.length === 0) {
        setShowOnboarding(true);
      }
      setReady(true);
    });
  }, []);

  const setTasks = useCallback((fn: (prev: Task[]) => Task[]) => {
    setTasksRaw((prev) => {
      const next = fn(prev);
      saveTasks(next);
      return next;
    });
  }, []);

  // Process recurring templates on load and every 30 minutes
  useEffect(() => {
    if (!ready || templates.length === 0) return;
    const process = () => {
      const { newTasks, updatedTemplates } = processRecurringTemplates(templates, tasks);
      if (newTasks.length > 0) {
        let nextId = getNextId(tasks);
        const tasksToAdd = newTasks.map((t) => ({ ...t, id: nextId++ }));
        setTasks((prev) => [...prev, ...tasksToAdd]);
      }
      if (updatedTemplates) {
        setTemplatesRaw(updatedTemplates);
        dbSetMeta("templates", updatedTemplates);
      }
    };
    process();
    const interval = setInterval(process, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [ready, templates.length]); // eslint-disable-line

  // Daily reminders scheduler
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const cfg = loadReminders();
      if (!cfg.enabled || cfg.times.length === 0) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const cur = `${hh}:${mm}`;
      if (!cfg.times.includes(cur)) return;
      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${cur}`;
      const last = localStorage.getItem(REMINDER_LAST_KEY);
      if (last === todayKey) return;
      localStorage.setItem(REMINDER_LAST_KEY, todayKey);

      const active = tasks.filter((t) => !t.completed && t.active);
      const top = active.slice(0, 5).map((t, i) => `${i + 1}) ${t.text}`).join("\n");
      const body = active.length === 0
        ? "На сегодня задач нет — отдыхайте 🌿"
        : `Дела на сегодня (${active.length}):\n${top}`;
      sendNotification("🎁 Коробочка — план на день", { body, tag: "daily-reminder" });
      // soft beep when app is open
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (Ctx) {
          const c = new Ctx();
          const o = c.createOscillator();
          const g = c.createGain();
          o.frequency.value = 660;
          g.gain.setValueAtTime(0.0001, c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6);
          o.connect(g).connect(c.destination);
          o.start();
          o.stop(c.currentTime + 0.7);
          setTimeout(() => c.close(), 800);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [ready, tasks]);

  // Update header date at midnight
  useEffect(() => {
    const t = setInterval(() => setHeaderDate(formatTodayHeader(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const saveTemplates = useCallback((tpls: TaskTemplate[]) => {
    setTemplatesRaw(tpls);
    dbSetMeta("templates", tpls);
  }, []);

  const openTimer = useCallback((task: Task) => {
    setTimerTask(task);
  }, []);

  const openAddModal = useCallback((category?: CategoryId, restrictCategories?: CategoryId[]) => {
    setAddModalCategory(category ?? 0);
    setAddModalRestrict(restrictCategories ?? null);
    setAddModalOpen(true);
  }, []);

  const handleAddTask = useCallback((text: string, category: CategoryId, subcategory?: string, recurrence?: { type: "daily"|"weekly"|"monthly"; hour: number; day?: number }) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    if (recurrence) {
      // Create one template + one immediate task instance per line (usually 1)
      setTemplatesRaw((prevT) => {
        const startId = prevT.reduce((m, t) => Math.max(m, t.id), 0) + 1;
        const newTpls: TaskTemplate[] = lines.map((line, i) => ({
          id: startId + i,
          text: line,
          category,
          subcategory,
          recurrence: recurrence.type,
          recurrenceHour: recurrence.hour,
          recurrenceDay: recurrence.type === "daily" ? undefined : recurrence.day,
          active: true,
        }));
        const merged = [...prevT, ...newTpls];
        dbSetMeta("templates", merged);

        setTasks((prev) => {
          let nextId = getNextId(prev);
          const created = newTpls.map((tpl) => ({ ...createNextInstance(tpl, new Date()), id: nextId++ }));
          return [...prev, ...created];
        });
        return merged;
      });
      toast.success(`Создан повторяющийся шаблон`);
      return;
    }

    setTasks((prev) => {
      let nextId = getNextId(prev);
      const newTasks = lines.map((line) => {
        const t: Task = {
          id: nextId++,
          text: line,
          category,
          completed: false,
          active: true,
          statusChangedAt: Date.now(),
        };
        if (subcategory) t.subcategory = subcategory;
        return t;
      });
      return [...prev, ...newTasks];
    });
    toast.success(`Добавлено ${lines.length} задач(и)`);
  }, [setTasks]);

  /** Quick add — used by QuickAddBar (voice + text) */
  const addQuickTask = useCallback((text: string, scheduledFor?: number, category: CategoryId = 0) => {
    if (!text.trim()) return;
    setTasks((prev) => {
      const nextId = getNextId(prev);
      const t: Task = {
        id: nextId,
        text: text.trim(),
        category,
        completed: false,
        active: true,
        statusChangedAt: Date.now(),
      };
      if (scheduledFor) t.scheduledFor = scheduledFor;
      return [...prev, t];
    });
  }, [setTasks]);

  /** Complete task; if it has a templateId, schedule next instance. */
  const completeTaskWithRecurrence = useCallback((id: number) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const updated = prev.map((t) =>
        t.id === id ? { ...t, completed: true, statusChangedAt: Date.now() } : t
      );
      if (task.templateId) {
        const tpl = templates.find((tt) => tt.id === task.templateId);
        if (tpl && tpl.active) {
          // only create next if no other pending exists
          const hasPending = updated.some((t) => t.templateId === tpl.id && !t.completed);
          if (!hasPending) {
            const nextId = getNextId(updated);
            const inst = createNextInstance(tpl, new Date());
            updated.push({ ...inst, id: nextId });
            const next = new Date(inst.scheduledFor!);
            toast.info(`Следующая «${tpl.text}» — ${next.toLocaleDateString("ru-RU")} в ${String(next.getHours()).padStart(2, "0")}:00`);
          }
        }
      }
      return updated;
    });
  }, [templates, setTasks]);

  const handleRandomTask = useCallback((categories: CategoryId[]) => {
    const now = Date.now();
    const active = tasks.filter(
      (t) => categories.includes(t.category) && t.active && !t.completed
        && (!t.scheduledFor || t.scheduledFor <= now)
    );
    if (active.length === 0) {
      toast.info("Нет активных задач в этой категории!");
      return;
    }
    const task = active[Math.floor(Math.random() * active.length)];
    openTimer(task);
  }, [tasks, openTimer]);

  const handleExport = useCallback(() => {
    exportTasksToFile(tasks);
    toast.success("Задачи экспортированы");
  }, [tasks]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const imported = await importTasksFromFile(file);
      setTasks(() => imported);
      toast.success(`Импортировано ${imported.length} задач`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [setTasks]);

  const handleViewTasks = useCallback((categories?: CategoryId[]) => {
    setTasksFilter(categories ?? null);
    setCurrentPage("tasks");
  }, []);

  const ctx: AppContextValue = {
    tasks, setTasks, openTimer, openAddModal,
    templates, saveTemplates, completeTaskWithRecurrence, addQuickTask,
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-primary animate-pulse text-xl font-display">🎁 Загрузка...</div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "tasks":
        return <TaskListPanel showArchive={false} restrictCategories={tasksFilter} onClearFilter={() => setTasksFilter(null)} />;
      case "projects":
        return <ProjectsPanel />;
      case "archive":
        return <TaskListPanel showArchive={true} />;

      case "history":
        return <HistoryModal />;
      case "templates":
        return <TemplatesPanel templates={templates} onSave={saveTemplates} />;
      case "info":
        return <InfoPage />;
      default:
        return <Dashboard onRandomTask={handleRandomTask} onViewTasks={handleViewTasks} />;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <AppSidebar
        currentPage={currentPage}
        onNavigate={(p) => { if (p !== "tasks") setTasksFilter(null); setCurrentPage(p); }}
        onExport={handleExport}
        onImport={handleImport}
      />

      <div className="ml-12 transition-all duration-300">
        <div className="max-w-4xl mx-auto p-2.5 pb-32">
          {/* Header */}
          <header className="text-center mb-4 pt-1 relative">
            <div className="absolute right-0 top-1 flex items-center gap-1.5 z-10">
              <ThemeToggle />
            </div>
            <h1 className="font-display text-2xl sm:text-4xl text-primary drop-shadow-sm animate-fade-in px-10">
              🎁 КОРОБОЧКА 5.0
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 capitalize animate-fade-in">
              {headerDate}
            </p>
          </header>

          {/* Page content */}
          {renderPage()}
        </div>
      </div>

      {timerTask && (
        <TimerScreen task={timerTask} onClose={() => setTimerTask(null)} />
      )}

      {/* Unified bottom bar — visible on Home and inside Timer */}
      {(currentPage === "home" || timerTask) && !addModalOpen && (
        <QuickAddBar inTimer={!!timerTask} />
      )}

      {/* Add modal */}
      {addModalOpen && (
        <AddTaskModal
          defaultCategory={addModalCategory}
          restrictCategories={addModalRestrict}
          onAdd={handleAddTask}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </AppContext.Provider>
  );
}
