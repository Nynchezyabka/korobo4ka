import { useEffect, useState } from "react";
import type { Task, TaskLocation } from "@/types";

const KEY = "current_location";
const EVENT = "korobochka:location";

export const LOCATIONS: { id: TaskLocation; label: string; emoji: string }[] = [
  { id: "home", label: "Дома", emoji: "🏠" },
  { id: "work", label: "На работе", emoji: "💼" },
  { id: "any", label: "Где угодно", emoji: "🌍" },
];

export function getCurrentLocation(): TaskLocation {
  const v = localStorage.getItem(KEY);
  return v === "home" || v === "work" ? v : "any";
}

export function setCurrentLocation(loc: TaskLocation) {
  localStorage.setItem(KEY, loc);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useCurrentLocation(): TaskLocation {
  const [loc, setLoc] = useState(getCurrentLocation);
  useEffect(() => {
    const h = () => setLoc(getCurrentLocation());
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return loc;
}

/** Подходит ли задача к текущему месту. Задачи без места подходят везде. */
export function fitsLocation(task: Task, current: TaskLocation): boolean {
  if (current === "any") return true;
  const l = task.location ?? "any";
  return l === "any" || l === current;
}
