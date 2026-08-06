import { useState } from "react";
import {
  Home, List, CalendarDays, Repeat, ChevronLeft, ChevronRight, Settings, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PageId = "home" | "tasks" | "projects" | "archive" | "history" | "templates" | "info";

interface Props {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Главная", icon: <Home size={20} /> },
  { id: "tasks", label: "Все задачи", icon: <List size={20} /> },
  { id: "projects", label: "Проекты", icon: <ListChecks size={20} /> },
  { id: "history", label: "Календарь", icon: <CalendarDays size={20} /> },
  { id: "templates", label: "Повторяющиеся задачи", icon: <Repeat size={20} /> },
];

export function AppSidebar({ currentPage, onNavigate, onOpenSettings }: Props) {
  const [expanded, setExpanded] = useState(false);

  const itemClass = (active: boolean) =>
    cn(
      "relative rounded-lg transition-all text-sm font-medium",
      expanded ? "flex items-center gap-3 px-3 py-2.5" : "flex items-center justify-center py-2.5 px-0",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-[100] flex flex-col bg-background border-r border-border shadow-lg transition-all duration-300 ease-in-out",
        expanded ? "w-52" : "w-12"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center h-12 hover:bg-muted/60 transition-colors shrink-0 border-b border-border"
        aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
      >
        {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-1 pt-2">
        {NAV_ITEMS.map((item) => {
          const active = currentPage === item.id || (item.id === "tasks" && currentPage === "archive");
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={!expanded ? item.label : undefined}
              className={itemClass(active)}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-primary" />
              )}
              <span className="shrink-0">{item.icon}</span>
              {expanded && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        <div className="border-t border-border my-2" />

        <button
          onClick={onOpenSettings}
          title={!expanded ? "Настройки" : undefined}
          className={itemClass(false)}
        >
          <span className="shrink-0"><Settings size={20} /></span>
          {expanded && <span className="truncate">Настройки</span>}
        </button>
      </nav>
    </aside>
  );
}
