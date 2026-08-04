import { Project, MicroStep, ChecklistTemplate, BlockerId } from "@/types";
import { dbGetMeta, dbSetMeta } from "@/lib/db";

const PROJECTS_KEY = "projects";
const MICROSTEPS_KEY = "microSteps";
const CHECKLISTS_KEY = "checklistTemplates";
const BLOCKERS_KEY = "blockerLog";

export interface BlockerEntry {
  id: number;
  taskId: number;
  taskText: string;
  blocker: BlockerId;
  at: number;
}

export async function loadProjects(): Promise<Project[]> {
  return (await dbGetMeta<Project[]>(PROJECTS_KEY)) ?? [];
}
export async function saveProjects(list: Project[]) {
  await dbSetMeta(PROJECTS_KEY, list);
}

export async function loadMicroSteps(): Promise<MicroStep[]> {
  return (await dbGetMeta<MicroStep[]>(MICROSTEPS_KEY)) ?? [];
}
export async function saveMicroSteps(list: MicroStep[]) {
  await dbSetMeta(MICROSTEPS_KEY, list);
}

export async function loadChecklists(): Promise<ChecklistTemplate[]> {
  return (await dbGetMeta<ChecklistTemplate[]>(CHECKLISTS_KEY)) ?? [];
}
export async function saveChecklists(list: ChecklistTemplate[]) {
  await dbSetMeta(CHECKLISTS_KEY, list);
}

export async function loadBlockerLog(): Promise<BlockerEntry[]> {
  return (await dbGetMeta<BlockerEntry[]>(BLOCKERS_KEY)) ?? [];
}
export async function addBlockerEntry(entry: Omit<BlockerEntry, "id">) {
  const list = await loadBlockerLog();
  const next = [...list, { ...entry, id: Date.now() }];
  await dbSetMeta(BLOCKERS_KEY, next.slice(-500));
}

export function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
}
