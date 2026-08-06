import { X, Sparkles } from "lucide-react";
import { CHANGELOG, ChangelogEntry, markVersionSeen } from "@/lib/changelog";

interface Props {
  entries?: ChangelogEntry[];
  onClose: () => void;
}

export function WhatsNewModal({ entries, onClose }: Props) {
  const list = entries && entries.length ? entries : CHANGELOG.slice(0, 1);

  const close = () => {
    markVersionSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10400] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={close}
    >
      <div
        className="w-full sm:max-w-md max-h-[88vh] overflow-auto bg-background rounded-t-2xl sm:rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-primary shrink-0" />
          <h2 className="font-display text-xl sm:text-2xl text-primary flex-1">Что нового</h2>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-muted" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {list.map((e) => (
          <section key={e.version} className="mb-4">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-sm font-semibold text-primary">Версия {e.version}</span>
              <span className="text-[11px] text-muted-foreground">{e.date}</span>
            </div>
            <p className="text-sm font-medium mb-2">{e.title}</p>
            <ul className="flex flex-col gap-1.5">
              {e.items.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary shrink-0">•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <button
          onClick={close}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
