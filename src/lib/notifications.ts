import { Task } from "@/types";

/**
 * Push notifications module using the Notification API + timers
 */

export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  // Use Service Worker if available for persistent notifications
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    });
  } else {
    new Notification(title, options);
  }
}

// Timer-based reminders
const activeReminders = new Map<number, number>(); // taskId -> timeoutId

export function setTaskReminder(
  taskId: number,
  taskText: string,
  delayMinutes: number
): void {
  clearTaskReminder(taskId);

  const timeoutId = window.setTimeout(() => {
    sendNotification("⏰ Напоминание", {
      body: taskText,
      tag: `task-${taskId}`,
    });
    activeReminders.delete(taskId);
  }, delayMinutes * 60 * 1000);

  activeReminders.set(taskId, timeoutId);
}

export function clearTaskReminder(taskId: number): void {
  const tid = activeReminders.get(taskId);
  if (tid !== undefined) {
    clearTimeout(tid);
    activeReminders.delete(taskId);
  }
}

export function hasActiveReminder(taskId: number): boolean {
  return activeReminders.has(taskId);
}
