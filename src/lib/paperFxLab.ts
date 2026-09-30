import type { CategoryId } from "@/types";

/**
 * Песочница бумажных эффектов: варианты «сложить» и «сжечь».
 * Только для тестового экрана — здесь ничего не удаляется по-настоящему.
 */

export type FoldVariant = "envelope" | "crumple" | "flight";
export type BurnVariant = "smolder" | "flash" | "dust";

// Выше окна «Тест анимаций» (z 10400), иначе бумажки летят под ним и не видны
const GHOST_Z = 10600;

const CATEGORY_BG: Record<CategoryId, string> = {
  0: "bg-cat-0-bg",
  1: "bg-cat-1-bg",
  2: "bg-cat-2-bg",
  3: "bg-cat-3-bg",
  4: "bg-cat-4-bg",
  5: "bg-cat-5-bg",
};

interface Opts {
  text: string;
  category?: CategoryId;
  /** Куда летит бумажка при «сложить». */
  target?: Element | null;
}

function makeGhost(row: Element, { text, category = 0 }: Opts): HTMLElement | null {
  const rect = row.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.className = `paper-ghost ${CATEGORY_BG[category] ?? CATEGORY_BG[0]}`;
  ghost.textContent = text;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.zIndex = String(GHOST_Z);
  document.body.appendChild(ghost);
  return ghost;
}

function run(ghost: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
  const anim = ghost.animate(frames, options);
  const done = () => ghost.remove();
  anim.finished.then(done).catch(done);
}

function particle(className: string, x: number, y: number) {
  const el = document.createElement("span");
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.zIndex = String(GHOST_Z);
  document.body.appendChild(el);
  return el;
}

function fly(el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
  const anim = el.animate(frames, options);
  const done = () => el.remove();
  anim.finished.then(done).catch(done);
}

export function playFold(row: Element, variant: FoldVariant, opts: Opts) {
  const ghost = makeGhost(row, opts);
  if (!ghost) return;
  const from = ghost.getBoundingClientRect();
  const t = opts.target?.getBoundingClientRect();
  const toX = t ? t.left + t.width / 2 : from.left + from.width / 2;
  const toY = t ? t.top + t.height / 2 : from.top - 60;
  const dx = toX - (from.left + from.width / 2);
  const dy = toY - (from.top + from.height / 2);

  if (variant === "envelope") {
    ghost.style.transformOrigin = "center center";
    run(
      ghost,
      [
        { transform: "scaleY(1) scaleX(1) translate(0,0)", opacity: 1 },
        { transform: "scaleY(0.5) scaleX(1) translate(0,0)", opacity: 1, offset: 0.3 },
        { transform: "scaleY(0.25) scaleX(0.6) translate(0,0)", opacity: 1, offset: 0.55 },
        {
          transform: `translate(${dx}px, ${dy}px) scaleY(0.12) scaleX(0.3)`,
          opacity: 0.15,
        },
      ],
      { duration: 700, easing: "cubic-bezier(.35,.02,.3,1)", fill: "forwards" }
    );
    return;
  }

  if (variant === "crumple") {
    run(
      ghost,
      [
        { transform: "scale(1) rotate(0deg)", borderRadius: "0.375rem", opacity: 1 },
        { transform: "scale(0.8) rotate(-6deg) skewX(4deg)", borderRadius: "35%", opacity: 1, offset: 0.25 },
        { transform: "scale(0.45) rotate(9deg) skewX(-6deg)", borderRadius: "50%", opacity: 1, offset: 0.5 },
        { transform: "scale(0.26) rotate(-4deg)", borderRadius: "50%", opacity: 1, offset: 0.62 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.1) rotate(200deg)`,
          borderRadius: "50%",
          opacity: 0.2,
        },
      ],
      { duration: 760, easing: "cubic-bezier(.5,.05,.3,1)", fill: "forwards" }
    );
    return;
  }

  // flight — дуга с наклоном, как сейчас в приложении, но подлиннее
  const tilt = dx >= 0 ? 1 : -1;
  run(
    ghost,
    [
      { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) rotate(${tilt * 10}deg) scale(0.8)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `translate(${dx}px, ${dy}px) rotate(${tilt * 22}deg) scale(0.15)`, opacity: 0.1 },
    ],
    { duration: 620, easing: "cubic-bezier(.4,.05,.35,1)", fill: "forwards" }
  );
}

export function playBurn(row: Element, variant: BurnVariant, opts: Opts) {
  const ghost = makeGhost(row, opts);
  if (!ghost) return;
  const r = ghost.getBoundingClientRect();

  if (variant === "smolder") {
    for (let i = 0; i < 5; i += 1) {
      const smoke = particle("paper-smoke", r.left + r.width * (0.15 + i * 0.18), r.top + r.height * 0.6);
      fly(
        smoke,
        [
          { transform: "translate(0,0) scale(0.6)", opacity: 0.5 },
          { transform: `translate(${(i - 2) * 10}px, -60px) scale(2.2)`, opacity: 0 },
        ],
        { duration: 900 + i * 80, delay: i * 90, easing: "ease-out", fill: "forwards" }
      );
    }
    run(
      ghost,
      [
        { clipPath: "inset(0 0 0 0)", filter: "sepia(0)", opacity: 1 },
        { clipPath: "inset(0 0 30% 0)", filter: "sepia(0.5) brightness(0.9)", opacity: 1, offset: 0.45 },
        { clipPath: "inset(0 0 70% 0)", filter: "sepia(0.8) brightness(0.8)", opacity: 0.9, offset: 0.75 },
        { clipPath: "inset(0 0 100% 0)", filter: "sepia(1) brightness(0.7)", opacity: 0.7 },
      ],
      { duration: 1100, easing: "ease-in", fill: "forwards" }
    );
    return;
  }

  if (variant === "flash") {
    for (let i = 0; i < 10; i += 1) {
      const spark = particle("paper-ember", r.left + r.width * (0.08 + i * 0.09), r.top + r.height * 0.5);
      const ang = (i / 10) * Math.PI * 2;
      fly(
        spark,
        [
          { transform: "translate(0,0) scale(1.4)", opacity: 1 },
          {
            transform: `translate(${Math.cos(ang) * 46}px, ${Math.sin(ang) * 30 - 24}px) scale(0.2)`,
            opacity: 0,
          },
        ],
        { duration: 480, delay: 60 + i * 12, easing: "ease-out", fill: "forwards" }
      );
    }
    run(
      ghost,
      [
        { filter: "brightness(1)", transform: "scale(1)", opacity: 1 },
        { filter: "brightness(3) saturate(2)", transform: "scale(1.06)", opacity: 1, offset: 0.22 },
        { filter: "brightness(2)", transform: "scale(0.96)", opacity: 0.8, offset: 0.5 },
        { filter: "brightness(1.2)", transform: "scale(0.85)", opacity: 0 },
      ],
      { duration: 520, easing: "ease-out", fill: "forwards" }
    );
    return;
  }

  // dust — распад на пылинки, без огня
  for (let i = 0; i < 14; i += 1) {
    const dust = particle("paper-dust", r.left + r.width * Math.random(), r.top + r.height * Math.random());
    fly(
      dust,
      [
        { transform: "translate(0,0) scale(1)", opacity: 0.9 },
        {
          transform: `translate(${(Math.random() - 0.5) * 50}px, ${-14 - Math.random() * 40}px) scale(0.3)`,
          opacity: 0,
        },
      ],
      { duration: 700 + Math.random() * 300, delay: Math.random() * 180, easing: "ease-out", fill: "forwards" }
    );
  }
  run(
    ghost,
    [
      { filter: "blur(0px)", transform: "scale(1)", opacity: 1 },
      { filter: "blur(1.5px)", transform: "scale(1.02)", opacity: 0.6, offset: 0.5 },
      { filter: "blur(5px)", transform: "scale(1.05)", opacity: 0 },
    ],
    { duration: 760, easing: "ease-out", fill: "forwards" }
  );
}
