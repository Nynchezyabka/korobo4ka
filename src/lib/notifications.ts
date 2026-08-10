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

/** Schedule reminders for all tasks with a future scheduledFor date.
 *  Clears any existing per-task reminders first. */
export function scheduleTaskReminders(tasks: Task[]): void {
  // Clear all existing task reminders
  activeReminders.forEach((tid) => clearTimeout(tid));
  activeReminders.clear();

  const now = Date.now();
  tasks.forEach((task) => {
    if (!task.scheduledFor || task.completed || task.scheduledFor <= now) return;
    const delayMs = task.scheduledFor - now;
    setTaskReminder(task.id, task.text, Math.ceil(delayMs / (60 * 1000)));
  });
}

export function updateTaskReminder(task: Task): void {
  clearTaskReminder(task.id);
  if (!task.scheduledFor || task.completed || task.scheduledFor <= Date.now()) return;
  const delayMs = task.scheduledFor - Date.now();
  setTaskReminder(task.id, task.text, Math.ceil(delayMs / (60 * 1000)));
}
