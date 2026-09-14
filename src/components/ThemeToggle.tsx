import { Box, Sun, Moon } from "lucide-react";

export type VisualMode = "light" | "dark" | "3d";

interface Props {
  mode: VisualMode;
  onChange: (mode: VisualMode) => void;
}

export function ThemeToggle({ mode, onChange }: Props) {
  const options = [
    { mode: "light" as const, label: "Светлая тема", icon: <Sun size={16} /> },
    { mode: "dark" as const, label: "Тёмная тема", icon: <Moon size={16} /> },
    { mode: "3d" as const, label: "3D-режим", icon: <Box size={16} /> },
  ];
  const currentIndex = options.findIndex((option) => option.mode === mode);
  const current = options[currentIndex] ?? options[0];
  const next = options[(currentIndex + 1) % options.length] ?? options[0];

  return (
    <button
      onClick={() => onChange(next.mode)}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-primary text-primary-foreground shadow-sm backdrop-blur transition-all hover:bg-primary/90"
      title={`${current.label}. Переключить на: ${next.label}`}
      aria-label={`${current.label}. Переключить на: ${next.label}`}
    >
      {current.icon}
    </button>
  );
}
