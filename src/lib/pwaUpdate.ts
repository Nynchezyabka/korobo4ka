// PWA update manager: guarded registration, auto-update, manual check, hard reset.
import { registerSW } from "virtual:pwa-register";

type Listener = (state: { needRefresh: boolean; checking: boolean }) => void;

let needRefresh = false;
let checking = false;
const listeners = new Set<Listener>();
let registration: ServiceWorkerRegistration | null = null;

function emit() {
  listeners.forEach((l) => l({ needRefresh, checking }));
}

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppSw() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith("/sw.js"))
      .map((r) => r.unregister())
  );
}

export function initPwaUpdates() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    unregisterAppSw().catch(() => {});
    return;
  }

  // Новая версия активируется сама и страница перезагружается
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("sw_reloaded")) return;
    sessionStorage.setItem("sw_reloaded", "1");
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (reg) registration = reg;
    },
  });

  const silentCheck = () => registration?.update().catch(() => {});
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
  if (isRefusedContext() || !("serviceWorker" in navigator)) return "unavailable";
  checking = true;
  emit();
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? null;
    if (!reg) return "unavailable";
    registration = reg;
    await reg.update();
    // Ждём до 15 с: если новая версия скачивается — она сама применится и перезагрузит страницу
    for (let i = 0; i < 60; i++) {
      if (reg.installing || reg.waiting) {
        needRefresh = true;
        emit();
      }
      if (i >= 8 && !reg.installing && !reg.waiting) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    return needRefresh ? "available" : "current";
  } catch {
    return "unavailable";
  } finally {
    checking = false;
    emit();
  }
}

export async function applyUpdate() {
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  setTimeout(() => window.location.reload(), 1500);
}

/** Начисто: удалить кэш файлов и служебный обработчик. Задачи (IndexedDB) и настройки не трогаются. */
export async function hardReload() {
  try {
    await unregisterAppSw();
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.allSettled(names.map((n) => caches.delete(n)));
    }
  } finally {
    sessionStorage.removeItem("sw_reloaded");
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  }
}

export function isUpdateSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && !isRefusedContext();
}
