import { Box, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <div className="flex items-center rounded-lg border border-border/70 bg-background/80 p-0.5 shadow-sm backdrop-blur" role="group" aria-label="Оформление">
      {options.map((option) => (
        <button
          key={option.mode}
          onClick={() => onChange(option.mode)}
          className={cn("flex h-8 w-8 items-center justify-center rounded-md transition-all", mode === option.mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
          title={option.label}
          aria-label={option.label}
          aria-pressed={mode === option.mode}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
