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

/** Бумажка улетает в коробочку (иконка «Главная» в боковой панели). */
export function foldToBox(source: Element | null | undefined, options: FxOptions) {
  const ghost = createGhost(source, options);
  if (!ghost) return;

  const from = ghost.getBoundingClientRect();
  const target = document.querySelector(BOX_TARGET_SELECTOR)?.getBoundingClientRect();
  const toX = target ? target.left + target.width / 2 : from.left + 24;
  const toY = target ? target.top + target.height / 2 : from.top + 24;
  const dx = toX - (from.left + from.width / 2);
  const dy = toY - (from.top + from.height / 2);
  const tilt = dx >= 0 ? 1 : -1;

  play(
    ghost,
    [
      { transform: "translate(0px, 0px) rotate(0deg) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 18}px) rotate(${tilt * 7}deg) scale(0.85)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) rotate(${tilt * 16}deg) scale(0.2)`, opacity: 0.1 },
    ],
    { duration: 480, easing: "cubic-bezier(.4,.05,.35,1)", fill: "forwards" }
  );
}

/** Бумажка вспыхивает и осыпается на месте. */
export function burnInPlace(source: Element | null | undefined, options: FxOptions) {
  const ghost = createGhost(source, options);
  if (!ghost) return;

  const rect = ghost.getBoundingClientRect();

  // Тлеющие угольки поднимаются вверх.
  for (let i = 0; i < 3; i += 1) {
    const ember = document.createElement("span");
    ember.className = "paper-ember";
    ember.style.left = `${rect.left + rect.width * (0.25 + i * 0.25)}px`;
    ember.style.top = `${rect.top + rect.height * 0.7}px`;
    ember.style.zIndex = String(GHOST_Z);
    document.body.appendChild(ember);
    ember
      .animate(
        [
          { transform: "translate(0px, 0px) scale(1)", opacity: 0.9 },
          { transform: `translate(${(i - 1) * 6}px, -34px) scale(0.4)`, opacity: 0 },
        ],
        { duration: 420 + i * 60, delay: 60 + i * 40, easing: "ease-out", fill: "forwards" }
      )
      .finished.then(() => ember.remove())
      .catch(() => ember.remove());
  }

  play(
    ghost,
    [
      { clipPath: "inset(0 0 0 0)", filter: "brightness(1)", opacity: 1, transform: "translateY(0px)" },
      {
        clipPath: "inset(0 0 55% 0)",
        filter: "brightness(1.55) saturate(1.25)",
        opacity: 1,
        transform: "translateY(-2px)",
        offset: 0.4,
      },
      { clipPath: "inset(0 0 100% 0)", filter: "brightness(1.1)", opacity: 0.85, transform: "translateY(-5px)" },
    ],
    { duration: 400, easing: "ease-in", fill: "forwards" }
  );
}
