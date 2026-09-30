import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { X, Package, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { playFold, playBurn, type FoldVariant, type BurnVariant } from "@/lib/paperFxLab";

const FOLDS: { id: FoldVariant; title: string; hint: string }[] = [
  { id: "envelope", title: "Сложить конвертиком", hint: "Бумажка складывается пополам и уходит в коробочку" },
  { id: "crumple", title: "Смять в шарик", hint: "Скручивается комочком и залетает внутрь" },
  { id: "flight", title: "Улететь по дуге", hint: "Как сейчас в приложении, только заметнее" },
];

const BURNS: { id: BurnVariant; title: string; hint: string }[] = [
  { id: "smolder", title: "Тихо истлеть", hint: "Медленно темнеет, вверх идёт дымок" },
  { id: "flash", title: "Вспышка с искрами", hint: "Короткая яркая вспышка и разлетающиеся искры" },
  { id: "dust", title: "Рассыпаться в пыль", hint: "Спокойно распадается на пылинки, без огня" },
];

const SAMPLE = "Полить цветы и заказать корм коту";

export function AnimationLab({ onClose }: { onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState<string | null>(null);

  const row = (key: string) => document.querySelector(`[data-lab-row="${key}"]`);

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-xl mx-auto p-4 pb-16">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-display font-bold">Тест анимаций</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Здесь ничего не удаляется — нажимайте любой вариант сколько хотите и скажите, какой нравится.
        </p>

        <div
          ref={boxRef}
          className="mb-5 mx-auto w-20 h-20 rounded-xl border-2 border-dashed border-primary/50 flex flex-col items-center justify-center text-primary"
        >
          <Package size={24} />
          <span className="text-[10px] mt-0.5">коробочка</span>
        </div>

        <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
          <Package size={15} className="text-primary" /> Задача выполнена
        </h3>
        <div className="flex flex-col gap-3 mb-6">
          {FOLDS.map((v) => (
            <div key={v.id} className="rounded-lg border border-border p-2.5">
              <div
                data-lab-row={`fold-${v.id}`}
                className="bg-cat-3-bg rounded-md border-l-4 border-foreground/20 px-2.5 py-2 text-sm mb-2"
              >
                {SAMPLE}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{v.title}</div>
                  <div className="text-[11px] text-muted-foreground">{v.hint}</div>
                </div>
                <button
                  onClick={() => {
                    const el = row(`fold-${v.id}`);
                    if (el) playFold(el, v.id, { text: SAMPLE, category: 3, target: boxRef.current });
                    setLast(v.title);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-transform"
                >
                  Показать
                </button>
              </div>
            </div>
          ))}
        </div>

        <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
          <Flame size={15} className="text-primary" /> Задача удалена
        </h3>
        <div className="flex flex-col gap-3">
          {BURNS.map((v) => (
            <div key={v.id} className="rounded-lg border border-border p-2.5">
              <div
                data-lab-row={`burn-${v.id}`}
                className="bg-cat-1-bg rounded-md border-l-4 border-foreground/20 px-2.5 py-2 text-sm mb-2"
              >
                {SAMPLE}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{v.title}</div>
                  <div className="text-[11px] text-muted-foreground">{v.hint}</div>
                </div>
                <button
                  onClick={() => {
                    const el = row(`burn-${v.id}`);
                    if (el) playBurn(el, v.id, { text: SAMPLE, category: 1 });
                    setLast(v.title);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-transform"
                >
                  Показать
                </button>
              </div>
            </div>
          ))}
        </div>

        {last && (
          <p className="mt-5 text-xs text-muted-foreground">
            Последний показанный вариант: <span className="text-foreground font-medium">{last}</span>
          </p>
        )}
      </div>
    </div>
  );
}
