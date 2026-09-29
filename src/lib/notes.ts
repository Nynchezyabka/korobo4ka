import { useEffect, useState } from "react";
import { dbGetMeta, dbSetMeta } from "@/lib/db";

/** Заметка — просто текст. Не попадает в вытягивание, списки и напоминания. */
export interface Note {
  id: string;
  text: string;
  createdAt: number;
  processed?: boolean;
}

let notes: Note[] = [];
let loaded = false;
const listeners = new Set<(n: Note[]) => void>();

function emit() {
  listeners.forEach((l) => l(notes));
}

function persist() {
  dbSetMeta("notes", notes).catch(() => {});
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  const saved = await dbGetMeta<Note[]>("notes");
  if (Array.isArray(saved)) {
    notes = saved;
    emit();
  }
}

export function addNote(text: string) {
  const t = text.trim();
  if (!t) return;
  notes = [...notes, { id: crypto.randomUUID(), text: t.slice(0, 2000), createdAt: Date.now() }];
  persist();
  emit();
}

export function markNotesProcessed(ids: string[]) {
  const set = new Set(ids);
  notes = notes.map((n) => (set.has(n.id) ? { ...n, processed: true } : n));
  persist();
  emit();
}

export function removeNote(id: string) {
  notes = notes.filter((n) => n.id !== id);
  persist();
  emit();
}

export function useNotes(): Note[] {
  const [state, setState] = useState<Note[]>(notes);
  useEffect(() => {
    listeners.add(setState);
    ensureLoaded();
    setState(notes);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}

export function usePendingNotesCount(): number {
  return useNotes().filter((n) => !n.processed).length;
}
