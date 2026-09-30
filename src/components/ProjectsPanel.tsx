import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryId, ChecklistTemplate, DEFAULT_SUBCATEGORIES, Project, Task } from "@/types";
import { useApp } from "@/App";
import { getCategoryDisplayName, getCustomSubcategoriesSync } from "@/lib/taskStore";
import { getNextId } from "@/lib/taskStore";
import { loadProjects, saveProjects, loadChecklists, saveChecklists, nextId, newProjectId } from "@/lib/projects";
import { BUILTIN_TEMPLATES } from "@/lib/stepHints";
import { runAI } from "@/lib/aiClient";
import { STEPS_INSTRUCTIONS, STEPS_SCHEMA } from "@/lib/aiPrompts";
import { CategoryIcon } from "@/components/CategoryIcon";
import { AiModelPicker } from "@/components/AiModelPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteWithUndo, showUndoToast } from "@/lib/undoDelete";
import { foldToBox, burnInPlace } from "@/lib/paperFx";
import {
  Plus, ChevronLeft, Play, Check, Trash2, Sparkles,
  BookmarkPlus, Library, Lock, Loader2, ListChecks, Repeat, Mic, MicOff, Pencil,
} from "lucide-react";

/** Кнопка голосового ввода: дописывает распознанный текст в поле описания. */
function VoiceButton({ onText, title }: { onText: (text: string) => void; title: string }) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const toggle = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { toast.error("Голосовой ввод не поддерживается в этом браузере"); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = "ru-RU";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) add += e.results[i][0].transcript + " ";
      onText(add.trim());
    };
    r.onerror = () => { setListening(false); toast.error("Не удалось распознать"); };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      className={cn(
        "shrink-0 p-2 rounded-md border",
        listening ? "bg-red-600/15 border-red-600/40 text-red-600 animate-pulse" : "bg-muted/60 border-border/50 text-muted-foreground"
      )}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}

/** Чипсы подкатегорий для выбранной категории. Выбор необязательный. */
function SubcategoryPicker({
  category, value, onChange,
}: { category: CategoryId; value: string; onChange: (v: string) => void }) {
  const customSubs = useMemo(() => getCustomSubcategoriesSync(), []);
  const list = useMemo(() => {
    const defaults = DEFAULT_SUBCATEGORIES[category] || [];
    const custom = (customSubs[String(category)] || []).filter((c) => !defaults.includes(c));
    return [...defaults, ...custom];
  }, [category, customSubs]);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(value === s ? "" : s)}
          className={cn(
            "text-xs px-2 py-1 rounded-full border",
            value === s ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-muted/50"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function ProjectsPanel() {
  const { tasks, setTasks, openTimer, completeTaskWithRecurrence, navigate } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newCat, setNewCat] = useState<CategoryId>(1);
  const [newSub, setNewSub] = useState("");
  const [newMode, setNewMode] = useState<"sequential" | "parallel">("sequential");
  const [suggestOnOpenId, setSuggestOnOpenId] = useState<number | null>(null);

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

  const createProject = async (suggestSteps = false) => {
    const title = newTitle.trim();
    if (!title) return;
    // Reload fresh list: "Разбор" may have added projects meanwhile.
    const fresh = await loadProjects();
    const usedIds = new Set(tasks.map((t) => t.projectId).filter(Boolean) as number[]);
    let id = newProjectId(fresh);
    while (usedIds.has(id)) id++;
    const p: Project = {
      id,
      title,
      description: newDetails.trim() || undefined,
      category: newCat,
      subcategory: newSub || undefined,
      mode: newMode,
      createdAt: Date.now(),
    };
    persist([...fresh, p]);
    setNewTitle("");
    setNewDetails("");
    setNewSub("");
    setCreating(false);
    setSuggestOnOpenId(suggestSteps ? p.id : null);
    setOpenId(p.id);
  };

  const deleteProject = (id: number) => {
    const projectIndex = projects.findIndex((p) => p.id === id);
    const removedProject = projects[projectIndex];
    const removedSteps = tasks.filter((t) => t.projectId === id);
    if (!removedProject) return;
    persist(projects.filter((p) => p.id !== id));
    setTasks((prev) => prev.filter((t) => t.projectId !== id));
    if (openId === id) setOpenId(null);
    showUndoToast("Проект удалён", () => {
      setProjects((current) => {
        if (current.some((p) => p.id === removedProject.id)) return current;
        const restored = [...current];
        restored.splice(Math.min(Math.max(projectIndex, 0), restored.length), 0, removedProject);
        saveProjects(restored);
        return restored;
      });
      setTasks((current) => {
        const existing = new Set(current.map((t) => t.id));
        return [...current, ...removedSteps.filter((t) => !existing.has(t.id))];
      });
    });
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
        suggestOnOpen={suggestOnOpenId === open.id}
        onSuggestionStarted={() => setSuggestOnOpenId(null)}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-2xl text-primary mb-1">🧩 Проекты</h2>
      <div className="mb-3 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs sm:text-sm text-muted-foreground">
        Список шагов к одной цели: дела, которые нельзя сделать за один раз, разложите на маленькие шаги.
        Если нужно повторение по расписанию — это{" "}
        <button
          onClick={() => navigate("templates")}
          className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 align-baseline"
        >
          <Repeat size={14} /> Повторяющиеся задачи
        </button>.
      </div>

      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
        >
          <Plus size={16} /> Новый проект
        </button>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/60 space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createProject(false); }}
            placeholder="Что хочется сделать?"
            className="w-full text-sm px-2.5 py-2 rounded-md border border-border bg-background outline-none"
            autoFocus
          />
          <div className="flex gap-2 items-start">
            <textarea
              value={newDetails}
              onChange={(e) => setNewDetails(e.target.value)}
              rows={3}
              placeholder="Любые мысли, важные условия или ограничения — AI учтёт их при составлении шагов"
              className="flex-1 text-sm px-2.5 py-2 rounded-md border border-border bg-background outline-none resize-y min-h-[68px]"
            />
            <VoiceButton
              title="Наговорить описание"
              onText={(t) => setNewDetails((prev) => (prev ? prev + " " : "") + t)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Чем подробнее описание, тем точнее нейросеть предложит шаги — она видит и название, и эти детали.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 5, 3, 4, 0] as CategoryId[]).map((c) => (
              <button
                key={c}
                onClick={() => { setNewCat(c); setNewSub(""); }}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border flex items-center gap-1",
                  newCat === c ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-muted/50"
                )}
              >
                <CategoryIcon category={c} size={12} /> {getCategoryDisplayName(c)}
              </button>
            ))}
          </div>
          <SubcategoryPicker category={newCat} value={newSub} onChange={setNewSub} />
          <div className="flex gap-1.5">
            {(["sequential", "parallel"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setNewMode(m)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border",
                  newMode === m ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-muted/50"
                )}
              >
                {m === "sequential" ? "По порядку" : "В любом порядке"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => createProject(false)} className="px-3 py-1.5 rounded-md bg-muted/60 text-sm border border-border/50">
              Создать
            </button>
            <button onClick={() => createProject(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">
              <Sparkles size={14} /> Создать и предложить шаги
            </button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-md bg-muted/60 text-sm border border-border/50">
              Отмена
            </button>
          </div>
          <AiModelPicker contextLabel="Кто предложит шаги" />
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
            <div key={p.id} className="p-3 rounded-lg bg-muted/50 border border-border/60">
              <button onClick={() => setOpenId(p.id)} className="w-full text-left">
                <div className="flex items-center gap-2">
                  <CategoryIcon category={p.category} size={16} />
                  <span className="font-semibold text-sm sm:text-base flex-1">
                    {p.title}
                    {p.subcategory && <span className="ml-1.5 font-normal text-xs text-muted-foreground">· {p.subcategory}</span>}
                  </span>
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
  suggestOnOpen: boolean;
  onSuggestionStarted: () => void;
}

function ProjectDetail({
  project, tasks, setTasks, openTimer, completeTask,
  checklists, onSaveChecklists, onBack, onDelete, onUpdate, suggestOnOpen, onSuggestionStarted,
}: DetailProps) {
  const [stepText, setStepText] = useState("");
  const [hints, setHints] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(project.description ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [editingCat, setEditingCat] = useState(false);

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (!t) { setTitleDraft(project.title); setEditingTitle(false); return; }
    onUpdate({ title: t });
    setEditingTitle(false);
  };

  /** Смена категории проекта: шаги переезжают вместе с ним. */
  const changeCategory = (c: CategoryId) => {
    onUpdate({ category: c, subcategory: undefined });
    setTasks((prev) => prev.map((t) => (t.projectId === project.id ? { ...t, category: c, subcategory: undefined } : t)));
  };
  const suggestionStartedRef = useRef(false);
  const descRef = useRef(project.description ?? "");
  descRef.current = project.description ?? "";

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
        subcategory: project.subcategory,
        completed: false,
        active: true,
        statusChangedAt: Date.now(),
        projectId: project.id,
        stepOrder: ++order,
      }));
      return [...prev, ...created];
    });
  };

  const removeStep = (id: number) => deleteWithUndo(setTasks, id);

  const toggleStep = (t: Task) => {
    if (t.completed) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: false, statusChangedAt: Date.now() } : x)));
    } else {
      completeTask(t.id);
    }
  };

  const askAi = async () => {
    setAiLoading(true);
    try {
      const details = descRef.current.trim().slice(0, 4000);
      const data = await runAI({
        instructions: STEPS_INSTRUCTIONS,
        input:
          (details ? `Дело: ${project.title}\n\nОписание и контекст:\n${details}` : `Дело: ${project.title}`) +
          "\n\nТребования к ответу: 5-8 проектных этапов, ведущих к результату всего дела. " +
          "Каждый этап — осмысленная часть плана (разобраться, выбрать, подготовить, договориться, сделать, проверить). " +
          "Не начинай с бытовых движений вроде «открыть холодильник», «взять помидор», «налить воды» — такие шаги недопустимы. " +
          "Учти ограничения и пожелания из описания в конкретных шагах.",
        schemaName: "steps",
        schema: STEPS_SCHEMA,
        fallback: { fn: "suggest-steps", body: { title: project.title, details } },
      });
      const list: string[] = Array.isArray(data?.steps)
        ? data.steps.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 10)
        : [];
      if (list.length === 0) throw new Error("AI не вернул шаги");
      setHints(list);
    } catch (e: any) {
      toast.error(e?.message || "Не получилось спросить AI — попробуйте офлайн-подсказки");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!suggestOnOpen || suggestionStartedRef.current) return;
    suggestionStartedRef.current = true;
    onSuggestionStarted();
    void askAi();
  }, [suggestOnOpen]);

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

      <div data-fx-row className="flex items-start gap-2 mb-1">
        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }}
            onBlur={saveTitle}
            autoFocus
            className="flex-1 font-display text-xl sm:text-2xl text-primary px-2 py-1 rounded-md border border-border bg-background outline-none"
          />
        ) : (
          <>
            <h2 className="font-display text-xl sm:text-2xl text-primary flex-1">{project.title}</h2>
            <button
              onClick={() => { setTitleDraft(project.title); setEditingTitle(true); }}
              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground"
              title="Переименовать проект"
            >
              <Pencil size={16} />
            </button>
          </>
        )}
        <button onClick={(e) => { burnInPlace(e.currentTarget, { text: project.title, category: 0 }); onDelete(); }} className="p-1.5 rounded hover:bg-muted/60 text-red-600" title="Удалить проект">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Категория и подкатегория */}
      <div className="mb-3">
        <button
          onClick={() => setEditingCat((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-muted/60 border border-border/50 text-muted-foreground"
          title="Сменить категорию или подкатегорию"
        >
          <CategoryIcon category={project.category} size={13} />
          <span className="text-foreground">{getCategoryDisplayName(project.category)}</span>
          {project.subcategory && <span>· {project.subcategory}</span>}
          <Pencil size={12} />
        </button>
        {editingCat && (
          <div className="mt-2 p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {([1, 2, 5, 3, 4, 0] as CategoryId[]).map((c) => (
                <button
                  key={c}
                  onClick={() => changeCategory(c)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-full border flex items-center gap-1",
                    project.category === c ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-muted/50"
                  )}
                >
                  <CategoryIcon category={c} size={12} /> {getCategoryDisplayName(c)}
                </button>
              ))}
            </div>
            <SubcategoryPicker
              category={project.category}
              value={project.subcategory ?? ""}
              onChange={(v) => {
                onUpdate({ subcategory: v || undefined });
                setTasks((prev) => prev.map((t) => (t.projectId === project.id ? { ...t, subcategory: v || undefined } : t)));
              }}
            />
          </div>
        )}
      </div>

      {/* Описание / контекст проекта */}
      <div className="mb-3">
        {editingDesc ? (
          <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 space-y-2">
            <div className="flex gap-2 items-start">
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Контекст, детали, ограничения и пожелания — их учтёт нейросеть, когда предложит шаги."
                className="flex-1 text-sm px-2.5 py-2 rounded-md border border-border bg-background outline-none resize-y min-h-[68px]"
              />
              <VoiceButton
                title="Наговорить описание"
                onText={(t) => setDescDraft((prev) => (prev ? prev + " " : "") + t)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onUpdate({ description: descDraft.trim() || undefined }); setEditingDesc(false); }}
                className="text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground"
              >
                Сохранить
              </button>
              <button
                onClick={() => { setDescDraft(project.description ?? ""); setEditingDesc(false); }}
                className="text-xs px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/50"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : project.description ? (
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-start gap-2">
            <p className="flex-1 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            <button
              onClick={() => { setDescDraft(project.description ?? ""); setEditingDesc(true); }}
              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground"
              title="Изменить описание"
            >
              <Pencil size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDescDraft(""); setEditingDesc(true); }}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/50 text-muted-foreground"
          >
            <Pencil size={13} /> Добавить контекст и детали
          </button>
        )}
      </div>


      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {(["sequential", "parallel"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onUpdate({ mode: m })}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border",
              project.mode === m ? "border-primary bg-primary/10 font-semibold" : "border-border/60 bg-muted/50"
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
          <p className="text-sm text-muted-foreground">Шагов пока нет. Добавьте вручную или воспользуйтесь подсказками ниже.</p>
        )}
        {steps.map((s, i) => {
          const blocked = project.mode === "sequential" && !s.completed && i > firstUndoneIdx && firstUndoneIdx !== -1;
          return (
            <div
              key={s.id}
              data-fx-row
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/50",
                s.completed && "opacity-60",
                blocked && "opacity-50"
              )}
            >
              <button
                onClick={(e) => { if (!s.completed) foldToBox(e.currentTarget, { text: s.text, category: s.category }); toggleStep(s); }}
                className={cn(
                  "w-5 h-5 shrink-0 rounded border flex items-center justify-center",
                  s.completed ? "bg-emerald-600/80 border-emerald-700 text-white" : "border-border bg-muted/70"
                )}
              >
                {s.completed && <Check size={12} />}
              </button>
              <span className={cn("flex-1 text-sm sm:text-base", s.completed && "line-through")}>{s.text}</span>
              {blocked && <Lock size={12} className="opacity-50" />}
              {!s.completed && (
                <button onClick={() => openTimer(s)} className="p-1.5 rounded hover:bg-muted/60" title="Таймер">
                  <Play size={14} />
                </button>
              )}
              <button onClick={(e) => { burnInPlace(e.currentTarget, { text: s.text, category: s.category }); removeStep(s.id); }} className="p-1.5 rounded hover:bg-muted/60 opacity-50" title="Убрать шаг">
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
          className="flex-1 text-sm px-2.5 py-2 rounded-md border border-border bg-muted/70 outline-none"
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
        <button
          onClick={askAi}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary/15 text-primary border border-primary/25 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Предложить шаги с AI
        </button>
        <button onClick={() => setShowLibrary(!showLibrary)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/50">
          <Library size={13} /> Библиотека чек-листов
        </button>
        {steps.length > 0 && (
          <button onClick={saveAsTemplate} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 border border-border/50">
            <BookmarkPlus size={13} /> Сохранить как чек-лист
          </button>
        )}
      </div>
      <AiModelPicker className="mb-3" contextLabel="Кто предложит шаги" />

      {hints && (
        <div className="mb-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
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
                className="text-xs px-2 py-1 rounded-full bg-muted/70 text-foreground border border-border/50 hover:border-primary/50"
              >
                + {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLibrary && (
        <div className="mb-3 p-2.5 rounded-lg bg-muted/50 border border-border/50 space-y-1.5">
          <span className="text-xs font-semibold opacity-70 flex items-center gap-1"><ListChecks size={12} /> Готовые чек-листы</span>
          {library.map((tpl) => (
            <div key={tpl.id} data-fx-row className="flex items-center gap-2">
              <span className="text-sm flex-1">{tpl.title} <span className="text-xs opacity-50">({tpl.steps.length})</span></span>
              <button
                onClick={() => { addSteps(tpl.steps); setShowLibrary(false); }}
                className="text-xs px-2 py-1 rounded bg-primary/15 text-primary border border-primary/25"
              >
                Взять
              </button>
              {!tpl.builtin && (
                <button
                  onClick={(e) => {
                    burnInPlace(e.currentTarget, { text: tpl.title, category: 0 });
                    const index = checklists.findIndex((c) => c.id === tpl.id);
                    const removed = checklists[index];
                    if (!removed) return;
                    onSaveChecklists(checklists.filter((c) => c.id !== tpl.id));
                    showUndoToast("Чек-лист удалён", () => {
                      const restored = [...checklists.filter((c) => c.id !== removed.id)];
                      restored.splice(Math.min(Math.max(index, 0), restored.length), 0, removed);
                      onSaveChecklists(restored);
                    });
                  }}
                  className="p-1 rounded hover:bg-muted/60 text-red-600"
                  title="Удалить чек-лист"
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
