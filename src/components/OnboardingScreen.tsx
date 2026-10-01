import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Boxes, Wand2, MousePointerClick, Puzzle } from "lucide-react";

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: <Boxes size={48} className="text-primary" />,
    title: "Дела не бывают одинаковыми",
    text: "В Коробочке пять отделений по типу ресурса: обязательные дела, безопасность, простые радости, эго-радости и доступность радостей. Не «срочно/важно» — а что даёт силы и что их забирает.",
  },
  {
    icon: <Wand2 size={48} className="text-primary" />,
    title: "Сваливай всё в кучу",
    text: "Голосом или текстом в «Разбор» — можно просто поговорить. Решать, куда что положить, не нужно: это самое сложное, и это делает Коробочка.",
  },
  {
    icon: <MousePointerClick size={48} className="text-primary" />,
    title: "Жми на коробочку",
    text: "Одна случайная задача за раз, с таймером. Не нужно решать всё сразу — просто вытяни одно дело.",
  },
  {
    icon: <Puzzle size={48} className="text-primary" />,
    title: "Большие цели — не страшно",
    text: "Опиши проект своими словами, и ИИ разложит его на спокойные понятные шаги.",
  },
];

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 text-center animate-fade-in">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-8 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-8" key={step}>
          <div className="flex justify-center mb-4 animate-scale-in">
            {current.icon}
          </div>
          <h2 className="font-display text-2xl text-primary mb-3 animate-fade-in">
            {current.title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed animate-fade-in">
            {current.text}
          </p>
          {isLast && (
            <p className="mt-6 font-display text-lg text-foreground animate-fade-in">
              Дела — по коробочкам. В голове — тишина.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-lg bg-muted text-muted-foreground font-medium active:scale-[0.98] transition-all"
            >
              Назад
            </button>
          )}
          <button
            onClick={() => {
              if (isLast) {
                localStorage.setItem("onboarding_done", "1");
                onComplete();
              } else {
                setStep(step + 1);
              }
            }}
            className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isLast ? "Начать!" : "Далее"}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={() => {
              localStorage.setItem("onboarding_done", "1");
              onComplete();
            }}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
