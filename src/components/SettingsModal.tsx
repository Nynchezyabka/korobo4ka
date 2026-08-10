import { useEffect, useState } from "react";
import {
  X, Bell, BellOff, BellRing, Type, RefreshCw, Download, Upload,
  Archive, Info, Palette, Sparkles, Pencil as PencilIcon, ChevronUp, ChevronDown,
} from "lucide-react";
import { APP_VERSION } from "@/lib/changelog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

const REMINDERS_KEY = "daily_reminders";
const FONT_SIZE_KEY = "app_font_scale";
const SKIN_KEY = "app_skin";
const PRIVATE_NOTE_KEY = "my_private_note";

function loadPrivateNote(): string { return localStorage.getItem(PRIVATE_NOTE_KEY) || ""; }
function savePrivateNote(text: string) { localStorage.setItem(PRIVATE_NOTE_KEY, text); }

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

const FONT_SIZES = [
  { label: "S", value: 0.9 },
  { label: "M", value: 1.0 },
  { label: "L", value: 1.15 },
  { label: "XL", value: 1.3 },
];

export function applySkin(skin: string) {
  document.documentElement.classList.toggle("skin-strict", skin === "strict");
}
export function loadSkin(): string {
  return localStorage.getItem(SKIN_KEY) || "box";
}

interface Props {
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onOpenArchive: () => void;
  onOpenInfo: () => void;
  onOpenWhatsNew: () => void;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-3 border-b border-border/60 last:border-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
        <span className="text-primary">{icon}</span> {title}
      </h3>
      {children}
    </section>
  );
}

export function SettingsModal({ onClose, onExport, onImport, onOpenArchive, onOpenInfo, onOpenWhatsNew }: Props) {
  // Reminders
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [cfg, setCfg] = useState<DailyReminders>(loadReminders);
  const [newTime, setNewTime] = useState("09:00");

  // Font scale
  const [scale, setScale] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem(FONT_SIZE_KEY) || "1");
    return isNaN(saved) ? 1 : saved;
  });
  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 100}%`;
    localStorage.setItem(FONT_SIZE_KEY, String(scale));
  }, [scale]);

  // Skin
  const [skin, setSkin] = useState<string>(loadSkin);
  useEffect(() => {
    localStorage.setItem(SKIN_KEY, skin);
    applySkin(skin);
  }, [skin]);

  // Private note
  const [privateNote, setPrivateNote] = useState<string>(loadPrivateNote);
  const [noteOpen, setNoteOpen] = useState(false);

  // Updates
  const [needRefresh, setNeedRefresh] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const unsub = subscribeUpdates(({ needRefresh, checking }) => {
      setNeedRefresh(needRefresh);
      setChecking(checking);
    });
    return () => { unsub; };
  }, []);

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
    if (!/^\d{2}:\d{2}$/.test(newTime) || cfg.times.includes(newTime)) return;
    const next = { ...cfg, times: [...cfg.times, newTime].sort() };
    setCfg(next); saveReminders(next);
  };
  const removeTime = (t: string) => {
    const next = { ...cfg, times: cfg.times.filter((x) => x !== t) };
    setCfg(next); saveReminders(next);
  };

  const handleUpdateClick = async () => {
    if (needRefresh) { await applyUpdate(); return; }
    if (!isUpdateSupported()) {
      toast.info("Обновления доступны только в установленном приложении");
      return;
    }
    const res = await checkForUpdates();
    if (res === "available") toast.success("Доступна новая версия — нажмите ещё раз, чтобы обновить");
    else if (res === "current") toast.success("У вас актуальная версия");
    else toast.info("Проверка обновлений недоступна в этом режиме");
  };

  const BellIcon = cfg.enabled && permission === "granted" ? BellRing : permission === "denied" ? BellOff : Bell;

  return (
    <div className="fixed inset-0 z-[10300] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[88vh] overflow-auto bg-background rounded-t-2xl sm:rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-display text-xl sm:text-2xl text-primary flex-1">Настройки</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {isNotificationSupported() && (
          <Section title="Напоминания" icon={<BellIcon size={16} />}>
            <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input type="checkbox" checked={cfg.enabled} onChange={toggleEnabled} />
              <span>Присылать список дел в указанное время</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cfg.times.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                  {t}
                  <button onClick={() => removeTime(t)} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="text-sm px-2 py-1.5 rounded border border-border bg-background flex-1"
              />
              <button onClick={addTime} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground">
                Добавить
              </button>
            </div>
            <button
              onClick={() => sendNotification("🎁 КОРОБОЧКА", { body: "Уведомления работают!" })}
              className="mt-2 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"
            >
              Проверить уведомление
            </button>
          </Section>
        )}

        <Section title="Вид" icon={<Palette size={16} />}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Type size={14} /> Размер шрифта
          </div>
          <div className="flex gap-1 mb-3">
            {FONT_SIZES.map((s) => (
              <button
                key={s.label}
                onClick={() => setScale(s.value)}
                className={cn(
                  "flex-1 py-1.5 rounded-md text-sm font-semibold border transition-all",
                  scale === s.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground mb-1.5">Оформление</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSkin("box")}
              className={cn(
                "flex-1 py-2 rounded-md border text-sm font-display",
                skin === "box" ? "bg-primary/10 border-primary font-semibold" : "border-border text-muted-foreground"
              )}
            >
              Коробочка
            </button>
            <button
              onClick={() => setSkin("strict")}
              className={cn(
                "flex-1 py-2 rounded-md border text-sm",
                skin === "strict" ? "bg-primary/10 border-primary font-semibold" : "border-border text-muted-foreground"
              )}
            >
              Строгий
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            «Коробочка» — привычный рукописный шрифт. «Строгий» — обычный шрифт, если читать тяжело.
          </p>
        </Section>

        <Section title="Данные" icon={<Download size={16} />}>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => { onOpenArchive(); onClose(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 text-left"
            >
              <Archive size={16} /> Архив выполненных
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 text-left"
            >
              <Download size={16} /> Скачать задачи в файл
            </button>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 cursor-pointer">
              <Upload size={16} /> Загрузить из файла
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
          </div>
        </Section>

        <Section title="Моя заметка" icon={<PencilIcon size={16} />}>
          <p className="text-xs text-muted-foreground mb-2">
            Личная заметка видна только вам на этом устройстве. Можно записать, что обычно мешает начать дело.
          </p>
          <button
            onClick={() => setNoteOpen(!noteOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 text-left w-full"
          >
            {noteOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {noteOpen ? "Скрыть заметку" : "Показать / изменить заметку"}
          </button>
          {noteOpen && (
            <textarea
              value={privateNote}
              onChange={(e) => { setPrivateNote(e.target.value); savePrivateNote(e.target.value); }}
              placeholder="Например: не понимаю, что делать; слишком большой объём; неприятно; страшно; устала; нет условий; нужно решение; боюсь оценки; задача превратилась в «теперь я должна»..."
              className="mt-2 w-full h-32 text-sm p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          )}
        </Section>

        <Section title="О приложении" icon={<Info size={16} />}>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => { onOpenInfo(); onClose(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 text-left"
            >
              <Info size={16} /> Как работает Коробочка
            </button>
            <button
              onClick={handleUpdateClick}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-muted/60",
                needRefresh && "text-primary"
              )}
            >
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              {checking ? "Проверка…" : needRefresh ? "Обновить сейчас" : "Проверить обновления"}
            </button>
            <button
              onClick={() => { onOpenWhatsNew(); onClose(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 text-left"
            >
              <Sparkles size={16} /> Что нового
            </button>
            <div className="px-3 pt-1 text-[11px] text-muted-foreground">Версия {APP_VERSION}</div>
          </div>
        </Section>
      </div>
    </div>
  );
}
