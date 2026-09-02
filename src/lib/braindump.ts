import { Task, TaskTemplate, CategoryId, Project, RecurrenceType } from "@/types";
import { getNextId } from "@/lib/taskStore";
import { loadProjects, saveProjects, nextId as nextProjectId } from "@/lib/projects";

export type DraftKind = "task" | "event" | "project" | "recurring" | "not_task";

export interface DraftItem {
  /** local id for UI */
  uid: string;
  kind: DraftKind;
  text: string;
  category: CategoryId;
  /** "YYYY-MM-DDTHH:MM" or null */
  scheduledFor: string | null;
  steps: string[];
  recurrence: RecurrenceType | null;
  recurrenceDay: number | null;
  recurrenceHour: number | null;
  selected: boolean;
}

const KINDS: DraftKind[] = ["task", "event", "project", "recurring", "not_task"];

function toCategory(v: unknown): CategoryId {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return (n >= 0 && n <= 5 ? n : 0) as CategoryId;
}

export function normalizeItems(raw: any[]): DraftItem[] {
  return raw
    .filter((r) => r && typeof r.text === "string" && r.text.trim())
    .slice(0, 12)
    .map((r, i) => {
      const kind: DraftKind = KINDS.includes(r.kind) ? r.kind : "task";
      const scheduledFor = typeof r.scheduledFor === "string" && r.scheduledFor.length >= 10
        ? r.scheduledFor.slice(0, 16)
        : null;
      return {
        uid: `${Date.now()}-${i}`,
        kind,
        text: String(r.text).trim().slice(0, 200),
        category: toCategory(r.category),
        scheduledFor,
        steps: Array.isArray(r.steps)
          ? r.steps.filter((s: unknown) => typeof s === "string" && s.trim()).slice(0, 8)
          : [],
        recurrence: ["daily", "weekly", "monthly"].includes(r.recurrence) ? r.recurrence : null,
        recurrenceDay: typeof r.recurrenceDay === "number" ? r.recurrenceDay : null,
        recurrenceHour: typeof r.recurrenceHour === "number" ? r.recurrenceHour : 9,
        // по умолчанию отмечено только то, что привязано ко времени
        selected: kind !== "not_task" && !!scheduledFor,
      };
    });
}

export function parseLocalDate(s: string | null): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return undefined;
  const d = new Date(
    parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
    m[4] ? parseInt(m[4]) : 12, m[5] ? parseInt(m[5]) : 0, 0, 0
  );
  return d.getTime();
}

export interface ApplyResult {
  tasks: number;
  projects: number;
  recurring: number;
}

interface ApplyCtx {
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
  templates: TaskTemplate[];
  saveTemplates: (t: TaskTemplate[]) => void;
}

/** Creates tasks / projects / recurring templates from the confirmed draft. */
export async function applyDraft(items: DraftItem[], ctx: ApplyCtx): Promise<ApplyResult> {
  const chosen = items.filter((i) => i.selected && i.kind !== "not_task");
  const result: ApplyResult = { tasks: 0, projects: 0, recurring: 0 };
  if (chosen.length === 0) return result;

  // --- projects ---
  const projectItems = chosen.filter((i) => i.kind === "project");
  const createdProjects: { item: DraftItem; project: Project }[] = [];
  if (projectItems.length) {
    const existing = await loadProjects();
    let pid = nextProjectId(existing);
    const list = [...existing];
    for (const it of projectItems) {
      const project: Project = {
        id: pid++,
        title: it.text,
        category: it.category,
        mode: "sequential",
        createdAt: Date.now(),
      };
      list.push(project);
      createdProjects.push({ item: it, project });
    }
    await saveProjects(list);
    result.projects = createdProjects.length;
  }

  // --- recurring templates ---
  const recurItems = chosen.filter((i) => i.kind === "recurring");
  if (recurItems.length) {
    let tid = ctx.templates.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    const newTpls: TaskTemplate[] = recurItems.map((it) => ({
      id: tid++,
      text: it.text,
      category: it.category,
      recurrence: (it.recurrence ?? "weekly") as RecurrenceType,
      recurrenceHour: it.recurrenceHour ?? 9,
      recurrenceDay: it.recurrence === "daily" ? undefined : (it.recurrenceDay ?? 1),
      active: true,
    }));
    ctx.saveTemplates([...ctx.templates, ...newTpls]);
    result.recurring = newTpls.length;
  }

  // --- plain tasks, events, and project steps ---
  const simple = chosen.filter((i) => i.kind === "task" || i.kind === "event");
  const stepCount = createdProjects.reduce((m, p) => m + p.item.steps.length, 0);
  if (simple.length || stepCount) {
    ctx.setTasks((prev) => {
      let id = getNextId(prev);
      const created: Task[] = [];
      for (const it of simple) {
        const t: Task = {
          id: id++,
          text: it.text,
          category: it.category,
          completed: false,
          active: true,
          statusChangedAt: Date.now(),
        };
        const ts = parseLocalDate(it.scheduledFor);
        if (ts) t.scheduledFor = ts;
        created.push(t);
      }
      for (const { item, project } of createdProjects) {
        item.steps.forEach((step, idx) => {
          created.push({
            id: id++,
            text: step,
            category: project.category,
            completed: false,
            active: true,
            statusChangedAt: Date.now(),
            projectId: project.id,
            stepOrder: idx,
          });
        });
      }
      return [...prev, ...created];
    });
    result.tasks = simple.length;
  }

  return result;
}
