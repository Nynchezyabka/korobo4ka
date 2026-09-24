import { toast } from "sonner";
import type { Task } from "@/types";

type SetTasks = (fn: (prev: Task[]) => Task[]) => void;

/** Удаляет задачу сразу и показывает «Отменить» на несколько секунд. */
export function deleteWithUndo(setTasks: SetTasks, id: number, onFinal?: () => void) {
  let removed: Task | undefined;
  let index = -1;
  setTasks((prev) => {
    index = prev.findIndex((t) => t.id === id);
    removed = prev[index];
    return prev.filter((t) => t.id !== id);
  });
  let undone = false;
  toast("Задача удалена", {
    duration: 5000,
    action: {
      label: "Отменить",
      onClick: () => {
        undone = true;
        if (!removed) return;
        const t = removed;
        setTasks((prev) => {
          if (prev.some((x) => x.id === t.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(index, 0), next.length), 0, t);
          return next;
        });
      },
    },
    onAutoClose: () => { if (!undone) onFinal?.(); },
    onDismiss: () => { if (!undone) onFinal?.(); },
  });
}
