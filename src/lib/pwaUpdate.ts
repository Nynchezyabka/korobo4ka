// PWA update manager: registers SW, exposes manual check + apply.
import { registerSW } from "virtual:pwa-register";

type Listener = (state: { needRefresh: boolean; checking: boolean }) => void;

let needRefresh = false;
let checking = false;
const listeners = new Set<Listener>();

let updateSWFn: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;

function emit() {
  listeners.forEach((l) => l({ needRefresh, checking }));
}

function setNeedRefresh(v: boolean) {
  if (needRefresh === v) return;
  needRefresh = v;
  emit();
}

function isPreviewOrIframe(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

/** Есть ли уже готовая (ожидающая) новая версия */
function hasWaiting(reg: ServiceWorkerRegistration | null): boolean {
  if (!reg) return false;
  if (reg.waiting) return true;
  if (reg.installing && reg.installing.state === "installed") return true;
  return false;
}

function watchRegistration(reg: ServiceWorkerRegistration) {
  registration = reg;
  if (hasWaiting(reg)) setNeedRefresh(true);

  reg.addEventListener("updatefound", () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener("statechange", () => {
      // Новая версия установлена и ждёт активации (контроллер уже есть = это обновление, а не первая установка)
      if (sw.state === "installed" && navigator.serviceWorker.controller) {
        setNeedRefresh(true);
      }
    });
  });
}

export function initPwaUpdates() {
  if (typeof window === "undefined") return;
  if (isPreviewOrIframe()) return; // не регистрируем SW внутри редактора Lovable
  if (!("serviceWorker" in navigator)) return;

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      setNeedRefresh(true);
    },
    onOfflineReady() {
      // no-op
    },
    onRegisteredSW(_url, reg) {
      if (reg) watchRegistration(reg);
    },
  });

  // Тихая периодическая проверка
  const silentCheck = () => {
    (registration ?? null)?.update().catch(() => {});
  };
  setInterval(silentCheck, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") silentCheck();
  });
}

export function subscribeUpdates(l: Listener) {
  listeners.add(l);
  l({ needRefresh, checking });
  return () => listeners.delete(l);
}

export async function checkForUpdates(): Promise<"unavailable" | "current" | "available"> {
  if (isPreviewOrIframe() || !("serviceWorker" in navigator)) return "unavailable";
  checking = true;
  emit();
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? null;
    if (!reg) return "unavailable";
    registration = reg;
    await reg.update();
    // Дать новой версии время установиться
    for (let i = 0; i < 12; i++) {
      if (hasWaiting(reg) || needRefresh) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (hasWaiting(reg)) setNeedRefresh(true);
    return needRefresh ? "available" : "current";
  } catch {
    return "unavailable";
  } finally {
    checking = false;
    emit();
  }
}

export async function applyUpdate() {
  const reg = registration;
  if (reg?.waiting) {
    // Перезагрузить страницу, когда новый SW возьмёт управление
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true }
    );
  }
  if (updateSWFn) {
    await updateSWFn(true); // skipWaiting + перезагрузка
    return;
  }
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  window.location.reload();
}

export function isUpdateSupported() {
  return !isPreviewOrIframe() && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}
