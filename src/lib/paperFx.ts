import type { CategoryId } from "@/types";

/**
 * Бумажные эффекты: «сложить в коробочку» и «сжечь».
 *
 * Работает по принципу «призрака»: в момент нажатия создаётся независимая
 * копия строки, которая и анимируется, а настоящие данные меняются сразу.
 * Анимация поэтому не может сломать удаление, отмену или перетаскивание.
 */

interface FxOptions {
  text: string;
  category?: CategoryId;
}

const BOX_TARGET_SELECTOR = '[data-paper-target="box"]';
const ROW_SELECTOR = "[data-fx-row]";
const GHOST_Z = 9990;

// Список держим литеральным, чтобы классы точно попали в стили.
const CATEGORY_BG: Record<CategoryId, string> = {
  0: "bg-cat-0-bg",
  1: "bg-cat-1-bg",
  2: "bg-cat-2-bg",
  3: "bg-cat-3-bg",
  4: "bg-cat-4-bg",
  5: "bg-cat-5-bg",
};

let activeGhost: HTMLElement | null = null;

function motionDisabled(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Строка, к которой относится кнопка (для «сжечь» горит вся строка, а не кнопка). */
function resolveRow(el: Element | null | undefined): Element | null {
  if (!el) return null;
  return el.closest(ROW_SELECTOR) ?? el;
}

function createGhost(source: Element | null | undefined, { text, category = 0 }: FxOptions): HTMLElement | null {
  const row = resolveRow(source);
  if (!row || motionDisabled()) return null;

  const rect = row.getBoundingClientRect();
  // Скрытая или улетевшая за экран строка — эффекта не играем.
  if (!rect.width || !rect.height) return null;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null;

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

  // Одна летящая бумажка за раз — на слабом телефоне не будет тормозов.
  activeGhost?.remove();
  activeGhost = ghost;
  return ghost;
}

function play(ghost: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const animation = ghost.animate(keyframes, options);
  const done = () => {
    ghost.remove();
    if (activeGhost === ghost) activeGhost = null;
  };
  animation.finished.then(done).catch(done);
}

/** Бумажка складывается конвертиком и улетает в коробочку. */
export function foldToBox(source: Element | null | undefined, options: FxOptions) {
  const ghost = createGhost(source, options);
  if (!ghost) return;

  const from = ghost.getBoundingClientRect();
  const target = document.querySelector(BOX_TARGET_SELECTOR)?.getBoundingClientRect();
  const toX = target ? target.left + target.width / 2 : from.left + 24;
  const toY = target ? target.top + target.height / 2 : from.top + 24;
  const dx = toX - (from.left + from.width / 2);
  const dy = toY - (from.top + from.height / 2);
  ghost.style.transformOrigin = "center center";

  play(
    ghost,
    [
      { transform: "translate(0px, 0px) scaleX(1) scaleY(1)", opacity: 1 },
      {
        transform: "translate(0px, 0px) scaleX(1) scaleY(0.5)",
        opacity: 1,
        offset: 0.3,
      },
      {
        transform: "translate(0px, 0px) scaleX(0.6) scaleY(0.25)",
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scaleX(0.3) scaleY(0.12)`,
        opacity: 0.15,
      },
    ],
    { duration: 700, easing: "cubic-bezier(.35,.02,.3,1)", fill: "forwards" }
  );
}

/** Бумажка рассыпается в пыль на месте. */
export function burnInPlace(source: Element | null | undefined, options: FxOptions) {
  const ghost = createGhost(source, options);
  if (!ghost) return;

  const rect = ghost.getBoundingClientRect();

  for (let i = 0; i < 14; i += 1) {
    const dust = document.createElement("span");
    dust.className = "paper-dust";
    dust.style.left = `${rect.left + rect.width * Math.random()}px`;
    dust.style.top = `${rect.top + rect.height * Math.random()}px`;
    dust.style.zIndex = String(GHOST_Z);
    document.body.appendChild(dust);
    dust
      .animate(
        [
          { transform: "translate(0px, 0px) scale(1)", opacity: 0.9 },
          {
            transform: `translate(${(Math.random() - 0.5) * 50}px, ${-14 - Math.random() * 40}px) scale(0.3)`,
            opacity: 0,
          },
        ],
        {
          duration: 700 + Math.random() * 300,
          delay: Math.random() * 180,
          easing: "ease-out",
          fill: "forwards",
        }
      )
      .finished.then(() => dust.remove())
      .catch(() => dust.remove());
  }

  play(
    ghost,
    [
      { filter: "blur(0px)", transform: "scale(1)", opacity: 1 },
      { filter: "blur(1.5px)", transform: "scale(1.02)", opacity: 0.6, offset: 0.5 },
      { filter: "blur(5px)", transform: "scale(1.05)", opacity: 0 },
    ],
    { duration: 760, easing: "ease-out", fill: "forwards" }
  );
}
