import { useState } from "react";
import { CategoryId, CATEGORIES, Task } from "@/types";
import { CategoryIcon } from "@/components/CategoryIcon";
import { getNextId } from "@/lib/taskStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Undo2, SkipForward, X } from "lucide-react";

const CAT_CLS: Record<CategoryId, string> = {
  0: "bg-cat-0-bg border-l-cat-0",
  1: "bg-cat-1-bg border-l-cat-1",
  2: "bg-cat-2-bg border-l-cat-2",
  3: "bg-cat-3-bg border-l-cat-3",
  4: "bg-cat-4-bg border-l-cat-4",
  5: "bg-cat-5-bg border-l-cat-5",
};
const SORT_CATS: CategoryId[] = [1, 2, 5, 3, 4, 0];

/** Ручное раскладывание: по одной строке за раз, одно касание — отделение. */
export function ManualSort({ lines, setTasks, onDone }: {
  lines: string[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
  onDone: (leftover: string[]) => void;
}) {
  const [i, setI] = useState(0);
  const [history, setHistory] = useState<{ taskId: number | null }[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const line = lines[i];

  const finish = (added: number, left: string[]) => {
    if (added) toast.success(`Разложено задач: ${added}`);
    onDone(left);
  };

  const place = (category: CategoryId) => {
    let newId = 0;
    setTasks((prev) => {
      newId = getNextId(prev);
      return [...prev, { id: newId, text: line, category, completed: false, active: true, statusChangedAt: Date.now() }];
    });
    const h = [...history, { taskId: newId }];
    setHistory(h);
    next(h, skipped);
  };

  const skip = () => {
    const s = [...skipped, line];
    setSkipped(s);
    const h = [...history, { taskId: null }];
    setHistory(h);
    next(h, s);
  };

  const next = (h: typeof history, s: string[]) => {
    if (i + 1 >= lines.length) finish(h.filter((x) => x.taskId !== null).length, s);
    else setI(i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.taskId !== null) setTasks((prev) => prev.filter((t) => t.id !== last.taskId));
    else setSkipped((s) => s.slice(0, -1));
    setHistory(history.slice(0, -1));
    setI(i - 1);
  };

  if (!line) return null;

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Куда это положить?</span>
        <button
          onClick={() => finish(history.filter((x) => x.taskId !== null).length, [...skipped, ...lines.slice(i)])}
          className="p-1 rounded hover:bg-muted"
          title="Закончить"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-lg font-medium leading-snug min-h-[3rem]">{line}</p>
      <div className="grid grid-cols-2 gap-2">
        {SORT_CATS.map((c) => (
          <button
            key={c}
            onClick={() => place(c)}
            className={cn(
              "flex items-center gap-2 text-left text-xs sm:text-sm px-2.5 py-2.5 rounded-lg border-l-4 border border-border active:scale-95 transition-all",
              CAT_CLS[c]
            )}
          >
            <CategoryIcon category={c} size={16} />
            <span className="leading-tight">{c === 0 ? "Пока не знаю" : CATEGORIES[c].name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border disabled:opacity-30 active:scale-95"
        >
          <Undo2 size={13} /> Назад
        </button>
        <button onClick={skip} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border active:scale-95">
          <SkipForward size={13} /> Не задача
        </button>
      </div>
    </div>
  );
}
