import { useEffect, useMemo, useState } from "react";
import { CategoryId, ChecklistTemplate, Project, Task } from "@/types";
import { useApp } from "@/App";
import { getCategoryDisplayName } from "@/lib/taskStore";
import { getNextId } from "@/lib/taskStore";
import { loadProjects, saveProjects, loadChecklists, saveChecklists, nextId } from "@/lib/projects";
import { suggestStepsOffline, BUILTIN_TEMPLATES } from "@/lib/stepHints";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, Play, Check, Trash2, Sparkles, Lightbulb,
  BookmarkPlus, Library, Lock, Loader2, ListChecks,
} from "lucide-react";

export function ProjectsPanel() {
  const { tasks, setTasks, openTimer, completeTaskWithRecurrence } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState<CategoryId>(1);
  const [newMode, setNewMode] = useState<"sequential" | "parallel">("sequential");

  useEffect(() => {
    loadProjects().then(setProjects);
    loadChecklists().then(setChecklists);
  }, []);

  const persist = (list: Project[]) => {
    setProjects(list);
    saveProjects(list);
  };
  const persistChecklists = (list: ChecklistTemplate[]) => {
    setChecklists(list);
    saveChecklists(list);
  };

  const createProject = () => {
    const title = newTitle.trim();
    if (!title) return;
    const p: Project = {
      id: nextId(projects),
      title,
      category: newCat,
      mode: newMode,
      createdAt: Date.now(),
    };
    persist([...projects, p]);
    setNewTitle("");
    setCreating(false);
    setOpenId(p.id);
  };

  const deleteProject = (id: number) => {
    persist(projects.filter((p) => p.id !== id));
    setTasks((prev) => prev.filter((t) => t.projectId !== id));
    if (openId === id) setOpenId(null);
  };

  const open = projects.find((p) => p.id === openId) || null;

  if (open) {
    return (
      <ProjectDetail
        project={open}
        tasks={tasks}
        setTasks={setTasks}
        openTimer={openTimer}
        completeTask={completeTaskWithRecurrence}
        checklists={checklists}
        onSaveChecklists={persistChecklists}
        onBack={() => setOpenId(null)}
        onDelete={() => deleteProject(open.id)}
        onUpdate={(patch) => persist(projects.map((p) => (p.id === open.id ? { ...p, ...patch } : p)))}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-2xl text-primary mb-1">🧩 Проекты</h2>
      <p className="text-xs sm:text-sm text-muted-foreground mb-3">
        Дела, которые нельзя сделать за один раз — разложите на маленькие шаги.
      </p>

      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
        >
          <Plus size={16} /> Новый проект
        </button>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-white/40 dark:bg-white/5 border border-border/60 space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createProject(); }}
            placeholder="Например: Забор на даче"
            className="w-full text-sm px-2.5 py-2 rounded-md border border-border bg-white/80 dark:bg-white/10 outline-none"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 5, 3, 4, 0] as CategoryId[]).map((c) => (
              <button
                key={c}
                onClick={() => setNewCat(c)}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border flex items-center gap-1",
                  newCat === c ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-white/40"
                )}
              >
                <CategoryIcon category={c} size={12} /> {getCategoryDisplayName(c)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["sequential", "parallel"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setNewMode(m)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border",
                  newMode === m ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-white/40"
                )}
              >
                {m === "sequential" ? "По порядку" : "В любом порядке"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={createProject} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">
              Создать
            </button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-md bg-white/60 text-sm border border-border/50">
              Отмена
            </button>
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">
          Пока нет проектов. Создайте первый — например «Разобрать шкаф».
        </p>
      )}

      <div className="space-y-2">
        {projects.map((p) => {
          const steps = tasks.filter((t) => t.projectId === p.id);
          const done = steps.filter((t) => t.completed).length;
          const next = steps.filter((t) => !t.completed).sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))[0];
          return (
            <div key={p.id} className="p-3 rounded-lg bg-white/40 dark:bg-white/5 border border-border/60">
              <button onClick={() => setOpenId(p.id)} className="w-full text-left">
                <div className="flex items-center gap-2">
                  <CategoryIcon category={p.category} size={16} />
                  <span className="font-semibold text-sm sm:text-base flex-1">{p.title}</span>
                  <span className="text-xs opacity-60">{done}/{steps.length}</span>
                </div>
                {next && (
                  <div className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                    Следующий шаг: <span className="text-foreground">{next.text}</span>
                  </div>
                )}
              </button>
              {next && (
                <button
                  onClick={() => openTimer(next)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary/15 text-primary border border-primary/25"
                >
                  <Play size={12} /> Сделать следующий шаг
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DetailProps {
  project: Project;
  tasks: Task[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
  openTimer: (t: Task) => void;
  completeTask: (id: number) => void;
  checklists: ChecklistTemplate[];
  onSaveChecklists: (list: ChecklistTemplate[]) => void;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Project>) => void;
}

function ProjectDetail({
  project, tasks, setTasks, openTimer, completeTask,
  checklists, onSaveChecklists, onBack, onDelete, onUpdate,
}: DetailProps) {
  const [stepText, setStepText] = useState("");
  const [hints, setHints] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const steps = useMemo(
    () => tasks.filter((t) => t.projectId === project.id).sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)),
    [tasks, project.id]
  );
  const firstUndoneIdx = steps.findIndex((s) => !s.completed);

  const addSteps = (texts: string[]) => {
    const clean = texts.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0) return;
    setTasks((prev) => {
      let id = getNextId(prev);
      let order = prev.filter((t) => t.projectId === project.id).reduce((m, t) => Math.max(m, t.stepOrder ?? 0), 0);
      const created: Task[] = clean.map((text) => ({
        id: id++,
        text,
        category: project.category,
        completed: false,
        active: true,
        statusChangedAt: Date.now(),
        projectId: project.id,
        stepOrder: ++order,
      }));
      return [...prev, ...created];
    });
  };

  const removeStep = (id: number) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const toggleStep = (t: Task) => {
    if (t.completed) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: false, statusChangedAt: Date.now() } : x)));
    } else {
      completeTask(t.id);
    }
  };

  const offline = () => {
    const res = suggestStepsOffline(project.title);
    setHints(res.steps);
    toast.info(`Подсказки: ${res.title}`);
  };

  const askAi = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-steps", {
        body: { title: project.title },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: string[] = Array.isArray(data?.steps) ? data.steps : [];
      if (list.length === 0) throw new Error("AI не вернул шаги");
      setHints(list);
    } catch (e: any) {
      toast.error(e?.message || "Не получилось спросить AI — попробуйте офлайн-подсказки");
    } finally {
      setAiLoading(false);
    }
  };

  const saveAsTemplate = () => {
    if (steps.length === 0) return;
    const tpl: ChecklistTemplate = {
      id: nextId(checklists),
      title: project.title,
      steps: steps.map((s) => s.text),
      category: project.category,
    };
    onSaveChecklists([...checklists, tpl]);
    toast.success("Чек-лист сохранён в вашу библиотеку");
  };

  const library = [...checklists, ...BUILTIN_TEMPLATES];

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <ChevronLeft size={16} /> К проектам
      </button>

      <div className="flex items-start gap-2 mb-1">
        <h2 className="font-display text-xl sm:text-2xl text-primary flex-1">{project.title}</h2>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-black/5 text-red-600" title="Удалить проект">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {(["sequential", "parallel"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onUpdate({ mode: m })}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border",
              project.mode === m ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-white/40"
            )}
          >
            {m === "sequential" ? "По порядку" : "В любом порядке"}
          </button>
        ))}
        <span className="text-xs opacity-60 ml-1">
          {steps.filter((s) => s.completed).length}/{steps.length} готово
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-1.5 mb-4">
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">Шагов пока нет. Добавьте вручную или возьмите подсказки ниже.</p>
        )}
        {steps.map((s, i) => {
          const blocked = project.mode === "sequential" && !s.completed && i > firstUndoneIdx && firstUndoneIdx !== -1;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border border-border/50 bg-white/40 dark:bg-white/5",
                s.completed && "opacity-60",
                blocked && "opacity-50"
              )}
            >
              <button
                onClick={() => toggleStep(s)}
                className={cn(
                  "w-5 h-5 shrink-0 rounded border flex items-center justify-center",
                  s.completed ? "bg-emerald-600/80 border-emerald-700 text-white" : "border-border bg-white/70"
                )}
              >
                {s.completed && <Check size={12} />}
              </button>
              <span className={cn("flex-1 text-sm sm:text-base", s.completed && "line-through")}>{s.text}</span>
              {blocked && <Lock size={12} className="opacity-50" />}
              {!s.completed && (
                <button onClick={() => openTimer(s)} className="p-1.5 rounded hover:bg-black/5" title="Таймер">
                  <Play size={14} />
                </button>
              )}
              <button onClick={() => removeStep(s.id)} className="p-1.5 rounded hover:bg-black/5 opacity-50" title="Убрать шаг">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add step */}
      <div className="flex gap-2 mb-3">
        <input
          value={stepText}
          onChange={(e) => setStepText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { addSteps([stepText]); setStepText(""); } }}
          placeholder="Новый шаг..."
          className="flex-1 text-sm px-2.5 py-2 rounded-md border border-border bg-white/70 dark:bg-white/10 outline-none"
        />
        <button
          onClick={() => { addSteps([stepText]); setStepText(""); }}
          className="px-3 rounded-md bg-primary text-primary-foreground"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Hint actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={offline} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white/60 border border-border/50">
          <Lightbulb size={13} /> Подсказать шаги
        </button>
        <button
          onClick={askAi}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary/15 text-primary border border-primary/25 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Спросить AI
        </button>
        <button onClick={() => setShowLibrary(!showLibrary)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white/60 border border-border/50">
          <Library size={13} /> Библиотека
        </button>
        {steps.length > 0 && (
          <button onClick={saveAsTemplate} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white/60 border border-border/50">
            <BookmarkPlus size={13} /> Сохранить как чек-лист
          </button>
        )}
      </div>

      {hints && (
        <div className="mb-3 p-2.5 rounded-lg bg-white/50 dark:bg-white/5 border border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold opacity-70">Предложенные шаги</span>
            <button
              onClick={() => { addSteps(hints); setHints(null); }}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
            >
              Добавить все
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hints.map((h, i) => (
              <button
                key={i}
                onClick={() => addSteps([h])}
                className="text-xs px-2 py-1 rounded-full bg-white/70 border border-border/50 hover:border-primary/50"
              >
                + {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLibrary && (
        <div className="mb-3 p-2.5 rounded-lg bg-white/50 dark:bg-white/5 border border-border/50 space-y-1.5">
          <span className="text-xs font-semibold opacity-70 flex items-center gap-1"><ListChecks size={12} /> Готовые чек-листы</span>
          {library.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-2">
              <span className="text-sm flex-1">{tpl.title} <span className="text-xs opacity-50">({tpl.steps.length})</span></span>
              <button
                onClick={() => { addSteps(tpl.steps); setShowLibrary(false); }}
                className="text-xs px-2 py-1 rounded bg-primary/15 text-primary border border-primary/25"
              >
                Взять
              </button>
              {!tpl.builtin && (
                <button
                  onClick={() => onSaveChecklists(checklists.filter((c) => c.id !== tpl.id))}
                  className="p-1 rounded hover:bg-black/5 text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
