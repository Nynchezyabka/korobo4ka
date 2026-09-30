import { toast } from "sonner";
import type { Task } from "@/types";

type SetTasks = (fn: (prev: Task[]) => Task[]) => void;

/** Единое уведомление об удалении с безопасным однократным завершением. */
export function showUndoToast(message: string, onUndo: () => void, onFinal?: () => void) {
  let undone = false;
  let finalized = false;
  const finalize = () => {
    if (undone || finalized) return;
    finalized = true;
    onFinal?.();
  };

  toast(message, {
    duration: 5000,
    action: {
      label: "Отменить",
      onClick: () => {
        if (undone) return;
        undone = true;
        onUndo();
      },
    },
    onAutoClose: finalize,
    onDismiss: finalize,
  });
}

/** Удаляет задачу сразу и показывает «Отменить» на несколько секунд. */
export function deleteWithUndo(setTasks: SetTasks, id: number, onFinal?: () => void) {
  let removed: Task | undefined;
  let index = -1;
  setTasks((prev) => {
    index = prev.findIndex((t) => t.id === id);
    removed = prev[index];
    return prev.filter((t) => t.id !== id);
  });
  showUndoToast("Задача удалена", () => {
    if (!removed) return;
    const t = removed;
    setTasks((prev) => {
      if (prev.some((x) => x.id === t.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(Math.max(index, 0), next.length), 0, t);
      return next;
    });
  }, onFinal);
}
