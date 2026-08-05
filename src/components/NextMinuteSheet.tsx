import { useEffect, useState } from "react";
import { BLOCKERS, BlockerId, MicroStep, Task } from "@/types";
import { loadMicroSteps, saveMicroSteps, addBlockerEntry, nextId } from "@/lib/projects";
import { suggestStepsOffline } from "@/lib/stepHints";
import { cn } from "@/lib/utils";
import { X, Plus, Check, Lightbulb, HelpCircle } from "lucide-react";

interface Props {
  task: Task;
  onClose: () => void;
}

/** «Метод следующей минуты» — записываем микро-шаги на 1 минуту и ловим прокрастинацию */
export function NextMinuteSheet({ task, onClose }: Props) {
  const [all, setAll] = useState<MicroStep[]>([]);
  const [text, setText] = useState("");
  const [showBlockers, setShowBlockers] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[] | null>(null);

  useEffect(() => { loadMicroSteps().then(setAll); }, []);

  const persist = (list: MicroStep[]) => {
    setAll(list);
    saveMicroSteps(list);
  };

  const mine = all.filter((m) => m.taskId === task.id);

  const add = (value: string) => {
    const v = value.trim();
    if (!v) return;
    persist([...all, { id: nextId(all), taskId: task.id, text: v, createdAt: Date.now(), done: false }]);
    setText("");
  };

  const toggle = (id: number) =>
    persist(all.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));

  const pickBlocker = (b: BlockerId) => {
    const info = BLOCKERS.find((x) => x.id === b)!;
    addBlockerEntry({ taskId: task.id, taskText: task.text, blocker: b, at: Date.now() });
    setHint(info.hint);
    setShowBlockers(false);
  };

  const suggest = () => setIdeas(suggestStepsOffline(task.text).steps);

  return (
    <div className="fixed inset-0 z-[11000] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-auto bg-background rounded-t-2xl sm:rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg sm:text-xl text-primary">С чего начать?</h3>
            <p className="text-xs sm:text-sm text-foreground/80 truncate">{task.text}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted shrink-0"><X size={18} /></button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3">
          Что можно сделать прямо сейчас за одну минуту? Например «открыть ноутбук».
          Это не задачи в коробочке — просто раскачка, чтобы начать.
        </p>

        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Шаг на одну минуту</p>

        <div className="flex gap-2 mb-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(text); }}
            placeholder="Шаг на одну минуту..."
            className="flex-1 text-sm px-2.5 py-2 rounded-md border border-border bg-muted/40 outline-none"
            autoFocus
          />
          <button onClick={() => add(text)} className="px-3 rounded-md bg-primary text-primary-foreground">
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1.5 mb-3">
          {mine.map((m) => (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className="w-full flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/30 text-left"
            >
              <span className={cn(
                "w-5 h-5 shrink-0 rounded border flex items-center justify-center",
                m.done ? "bg-emerald-600/80 border-emerald-700 text-white" : "border-border"
              )}>
                {m.done && <Check size={12} />}
              </span>
              <span className={cn("text-sm flex-1", m.done && "line-through opacity-60")}>{m.text}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={suggest} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted border border-border/50">
            <Lightbulb size={13} /> Подсказать
          </button>
          <button
            onClick={() => setShowBlockers(!showBlockers)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
          >
            <HelpCircle size={13} /> Застряла
          </button>
        </div>

        {ideas && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ideas.map((i) => (
              <button
                key={i}
                onClick={() => add(i)}
                className="text-xs px-2 py-1 rounded-full bg-muted border border-border/50 hover:border-primary/50"
              >
                + {i}
              </button>
            ))}
          </div>
        )}

        {showBlockers && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {BLOCKERS.map((b) => (
              <button
                key={b.id}
                onClick={() => pickBlocker(b.id)}
                className="text-xs px-2 py-1 rounded-full bg-muted border border-border/50"
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        {hint && (
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-sm">
            💡 {hint}
          </div>
        )}
      </div>
    </div>
  );
}
