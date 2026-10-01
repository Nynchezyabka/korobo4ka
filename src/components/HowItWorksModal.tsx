import { createPortal } from "react-dom";
import { X, Boxes, Wand2, MousePointerClick, Puzzle, Play, Lightbulb } from "lucide-react";
import { CATEGORIES, CategoryId } from "@/types";
import { CategoryIcon } from "@/components/CategoryIcon";

interface Props {
  onClose: () => void;
}

const CATEGORY_EXAMPLES: Record<CategoryId, string> = {
  0: "Пока не разобрано — попадёт на своё место после «Разбора»",
  1: "Записаться к врачу, оплатить счёт, ответить на письмо",
  2: "Финансовая подушка, документы, здоровье, навыки",
  3: "Прогулка, чай, музыка, творчество — то, что кормит душу",
  4: "Карьера, достижения, признание, большие проекты",
  5: "Время, деньги, энергия, пространство — то, что делает радости возможными",
};

const CATEGORY_ORDER: CategoryId[] = [1, 2, 3, 4, 5];

const CARDS = [
  {
    icon: <Boxes size={22} className="text-primary" />,
    title: "Дела не бывают одинаковыми",
    text: "Пять отделений — по источникам мотивации, а не по «срочно/важно».",
  },
  {
    icon: <Wand2 size={22} className="text-primary" />,
    title: "Сваливай всё в кучу",
    text: "Голосом или текстом в «Разбор». Решать, куда что положить, не нужно — это делает Коробочка.",
  },
  {
    icon: <MousePointerClick size={22} className="text-primary" />,
    title: "Жми на коробочку",
    text: "Одна случайная задача за раз, с таймером. Просто вытяни одно дело.",
  },
  {
    icon: <Puzzle size={22} className="text-primary" />,
    title: "Большие цели — не страшно",
    text: "Опиши проект своими словами — ИИ разложит его на спокойные шаги.",
  },
  {
    icon: <Lightbulb size={22} className="text-primary" />,
    title: "Застряла — не страшно",
    text: "Кнопка «С чего начать?» подскажет самый маленький шаг на минуту, когда зависла над делом.",
  },
];

export function HowItWorksModal({ onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[10400] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[88vh] overflow-auto bg-background rounded-t-2xl sm:rounded-2xl p-4 shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-display text-xl sm:text-2xl text-primary flex-1">Как устроена Коробочка</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          В основе — система мотивационной гигиены Виолетты Макеевой: дела делятся не по «срочно/важно»,
          а по источникам мотивации. Сортировать самой не нужно — Коробочка раскладывает сама.
        </p>

        {/* Пять отделений */}
        <div className="space-y-1.5 mb-4">
          {CATEGORY_ORDER.map((id) => (
            <div key={id} className="flex items-start gap-2.5 rounded-lg border border-border/60 px-3 py-2">
              <span className="mt-0.5 shrink-0"><CategoryIcon category={id} size={16} /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{CATEGORIES[id].name}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{CATEGORY_EXAMPLES[id]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Карточки-принципы */}
        <div className="grid grid-cols-1 gap-1.5 mb-4">
          {CARDS.map((c) => (
            <div key={c.title} className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
              <span className="mt-0.5 shrink-0">{c.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{c.title}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Видео */}
        <div className="rounded-xl border border-dashed border-border overflow-hidden">
          <div className="aspect-video flex flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground">
            <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Play size={20} className="ml-0.5" />
            </span>
            <span className="text-xs">Видео-инструкция скоро появится</span>
          </div>
        </div>

        <p className="mt-5 mb-1 text-center font-display text-lg sm:text-xl text-foreground/90">
          Дела — по коробочкам. В голове — тишина.
        </p>
      </div>
    </div>,
    document.body
  );
}
