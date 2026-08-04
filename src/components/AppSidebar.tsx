import { useState, useEffect } from "react";
import {
  Home, List, Archive, CalendarDays, Repeat, Download, Upload,
  ChevronLeft, ChevronRight, Info, Bell, BellOff, BellRing, Type,
  RefreshCw, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";
import {
  isUpdateSupported,
  checkForUpdates,
  applyUpdate,
  subscribeUpdates,
} from "@/lib/pwaUpdate";
import { toast } from "sonner";

function UpdateControl({ expanded }: { expanded: boolean }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsub = subscribeUpdates(({ needRefresh, checking }) => {
      setNeedRefresh(needRefresh);
      setChecking(checking);
    });
    return () => { unsub; };
  }, []);

  const supported = isUpdateSupported();

  const handleClick = async () => {
    if (needRefresh) {
      await applyUpdate();
      return;
    }
    if (!supported) {
      toast.info("Обновления доступны только в установленном приложении (korobo4ka.lovable.app)");
      return;
    }
    const res = await checkForUpdates();
    if (res === "available") toast.success("Доступна новая версия — нажмите ещё раз, чтобы обновить");
    else if (res === "current") toast.success("У вас актуальная версия");
    else toast.info("Проверка обновлений недоступна в этом режиме");
  };

  const label = needRefresh ? "Обновить сейчас" : "Проверить обновления";
  const Icon = RefreshCw;

  if (!expanded) {
    return (
      <button
        onClick={handleClick}
        title={label}
        className={cn(
          "flex items-center justify-center py-2.5 px-0 rounded-lg text-sm font-medium transition-all",
          needRefresh
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <Icon size={20} className={checking ? "animate-spin" : ""} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        needRefresh
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon size={18} className={checking ? "animate-spin shrink-0" : "shrink-0"} />
      <span className="truncate">{checking ? "Проверка…" : label}</span>
    </button>
  );
}

export type PageId = "home" | "tasks" | "projects" | "archive" | "history" | "templates" | "info";

interface Props {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  
}

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Главная", icon: <Home size={20} /> },
  { id: "tasks", label: "Все задачи", icon: <List size={20} /> },
  { id: "projects", label: "Проекты", icon: <ListChecks size={20} /> },
  { id: "archive", label: "Архив", icon: <Archive size={20} /> },
  { id: "history", label: "Календарь", icon: <CalendarDays size={20} /> },
  { id: "templates", label: "Шаблоны", icon: <Repeat size={20} /> },
];


const REMINDERS_KEY = "daily_reminders";

interface DailyReminders { enabled: boolean; times: string[] }

function loadReminders(): DailyReminders {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, times: ["09:00"] };
}

function saveReminders(cfg: DailyReminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(cfg));
}

function NotificationSidebarButton({ expanded }: { expanded: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<DailyReminders>(loadReminders);
  const [newTime, setNewTime] = useState("09:00");

  if (!isNotificationSupported()) return null;

  const ensurePermission = async () => {
    if (permission === "granted") return true;
    if (permission === "denied") {
      toast.error("Уведомления заблокированы в настройках браузера");
      return false;
    }
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
    return granted;
  };

  const toggleEnabled = async () => {
    if (!cfg.enabled) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    const next = { ...cfg, enabled: !cfg.enabled };
    setCfg(next); saveReminders(next);
    if (next.enabled) toast.success("Напоминания включены");
  };

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    if (cfg.times.includes(newTime)) return;
    const next = { ...cfg, times: [...cfg.times, newTime].sort() };
    setCfg(next); saveReminders(next);
  };

  const removeTime = (t: string) => {
    const next = { ...cfg, times: cfg.times.filter((x) => x !== t) };
    setCfg(next); saveReminders(next);
  };

  const Icon = cfg.enabled && permission === "granted" ? BellRing : permission === "denied" ? BellOff : Bell;
  const label = "Напоминания";

  if (!expanded) {
    return (
      <button
        onClick={() => sendNotification("🎁 КОРОБОЧКА", { body: "Уведомления работают!" })}
        title={label}
        className={cn("flex items-center justify-center py-2.5 px-0 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all")}
      >
        <Icon size={20} />
      </button>
    );
  }

  return (
    <div className="px-2 py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon size={18} /> {label}
      </button>
      {open && (
        <div className="mt-1 px-1">
          <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer">
            <input type="checkbox" checked={cfg.enabled} onChange={toggleEnabled} />
            <span>Список дел в указанное время</span>
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {cfg.times.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
                {t}
                <button onClick={() => removeTime(t)} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="text-xs px-1.5 py-1 rounded border border-border bg-background flex-1"
            />
            <button onClick={addTime} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">+</button>
          </div>
        </div>
      )}
    </div>
  );
}

const FONT_SIZE_KEY = "app_font_scale";
const FONT_SIZES = [
  { label: "S", value: 0.9 },
  { label: "M", value: 1.0 },
  { label: "L", value: 1.15 },
  { label: "XL", value: 1.3 },
];

function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = `${scale * 100}%`;
}

function FontSizeControl({ expanded }: { expanded: boolean }) {
  const [scale, setScale] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem(FONT_SIZE_KEY) || "1");
    return isNaN(saved) ? 1 : saved;
  });

  useEffect(() => {
    applyFontScale(scale);
    localStorage.setItem(FONT_SIZE_KEY, String(scale));
  }, [scale]);

  if (!expanded) {
    return (
      <button
        onClick={() => {
          const idx = FONT_SIZES.findIndex((s) => s.value === scale);
          const next = FONT_SIZES[(idx + 1) % FONT_SIZES.length];
          setScale(next.value);
        }}
        title="Размер шрифта"
        className="flex items-center justify-center py-2.5 px-0 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all"
      >
        <Type size={20} />
      </button>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
        <Type size={14} />
        <span>Размер шрифта</span>
      </div>
      <div className="flex gap-1">
        {FONT_SIZES.map((s) => (
          <button
            key={s.label}
            onClick={() => setScale(s.value)}
            className={cn(
              "flex-1 py-1 rounded-md text-xs font-semibold border transition-all",
              scale === s.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted/60"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppSidebar({ currentPage, onNavigate, onExport, onImport }: Props) {
  const [expanded, setExpanded] = useState(false);

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
      <nav className="flex-1 flex flex-col gap-0.5 p-1 pt-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={!expanded ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg transition-all text-sm font-medium",
              expanded ? "px-3 py-2.5" : "justify-center py-2.5 px-0",
              currentPage === item.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            {expanded && <span className="truncate">{item.label}</span>}
          </button>
        ))}

        <div className="border-t border-border my-2" />

        {/* Export */}
        <button
          onClick={onExport}
          title={!expanded ? "Скачать задачи" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            expanded ? "px-3 py-2.5" : "justify-center py-2.5 px-0"
          )}
        >
          <span className="shrink-0"><Download size={20} /></span>
          {expanded && <span className="truncate">Скачать задачи</span>}
        </button>

        {/* Import */}
        <label
          title={!expanded ? "Загрузить из файла" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer",
            expanded ? "px-3 py-2.5" : "justify-center py-2.5 px-0"
          )}
        >
          <span className="shrink-0"><Upload size={20} /></span>
          {expanded && <span className="truncate">Загрузить из файла</span>}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </label>

        <div className="border-t border-border my-2" />

        {/* Info - as nav item */}
        <button
          onClick={() => onNavigate("info")}
          title={!expanded ? "О приложении" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg transition-all text-sm font-medium",
            expanded ? "px-3 py-2.5" : "justify-center py-2.5 px-0",
            currentPage === "info"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="shrink-0"><Info size={20} /></span>
          {expanded && <span className="truncate">О приложении</span>}
        </button>

        {/* Notifications */}
        <NotificationSidebarButton expanded={expanded} />

        <div className="border-t border-border my-2" />

        {/* Update check */}
        <UpdateControl expanded={expanded} />

        {/* Font size */}
        <FontSizeControl expanded={expanded} />
      </nav>
    </aside>
  );
}
