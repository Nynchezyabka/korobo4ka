import { useState } from "react";
import { currentAiLabel, fetchDemoStatus } from "@/lib/aiClient";
import {
  AiSource,
  AiStore,
  hasOwnerCode,
  loadAiSource,
  loadAiStore,
  saveAiSource,
  setActiveConnection,
  updateConnection,
} from "@/lib/aiProviders";
import { cn } from "@/lib/utils";

interface AiModelPickerProps {
  contextLabel?: string;
  demoLeft?: number | null;
  onDemoStatusChange?: (left: number | null) => void;
  className?: string;
}

export function AiModelPicker({
  contextLabel = "Кто предлагает шаги",
  demoLeft,
  onDemoStatusChange,
  className,
}: AiModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<AiStore>(() => loadAiStore());
  const [source, setSource] = useState<AiSource>(() => loadAiSource());
  const [owner, setOwner] = useState(false);

  const toggle = () => {
    setStore(loadAiStore());
    setSource(loadAiSource());
    setOwner(hasOwnerCode());
    setOpen((value) => !value);
  };

  const chooseConnection = (id: string) => {
    setActiveConnection(id);
    setStore(loadAiStore());
    onDemoStatusChange?.(null);
  };

  const chooseSource = (nextSource: AiSource) => {
    setActiveConnection(null);
    saveAiSource(nextSource);
    setSource(nextSource);
    setStore(loadAiStore());
    if (nextSource === "demo") {
      fetchDemoStatus().then((status) => onDemoStatusChange?.(status?.left ?? null));
    } else {
      onDemoStatusChange?.(null);
    }
  };

  const chooseModel = (id: string, model: string) => {
    updateConnection(id, { model });
    setStore(loadAiStore());
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={toggle}
        className="block ml-auto text-[11px] text-muted-foreground text-right hover:text-foreground underline-offset-2 hover:underline transition-colors"
        title="Сменить модель"
        type="button"
      >
        {currentAiLabel()}
        {demoLeft !== null && demoLeft !== undefined && ` · осталось бесплатных запросов: ${demoLeft}`}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[10150]" onClick={() => setOpen(false)} />
          <div className="absolute z-[10200] top-full right-0 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background shadow-lg p-2 space-y-1.5 animate-scale-in">
            <p className="text-[11px] text-muted-foreground px-1.5">{contextLabel}</p>
            <button
              type="button"
              onClick={() => chooseSource("demo")}
              className={cn(
                "w-full text-left rounded-md border px-2 py-1.5 text-sm transition-colors",
                !store.activeId && source === "demo" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
              )}
            >
              Демо
              <span className="block text-[11px] text-muted-foreground">Без настроек</span>
            </button>
            {store.connections.map((connection) => (
              <div key={connection.id}>
                <button
                  type="button"
                  onClick={() => chooseConnection(connection.id)}
                  className={cn(
                    "w-full text-left rounded-md border px-2 py-1.5 text-sm transition-colors",
                    store.activeId === connection.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                  )}
                >
                  Мой ключ · {connection.providerName}
                  <span className="block text-[11px] text-muted-foreground truncate">{connection.model}</span>
                </button>
                {store.activeId === connection.id && connection.models.length > 1 && (
                  <select
                    value={connection.model}
                    onChange={(event) => chooseModel(connection.id, event.target.value)}
                    className="mt-1 w-full text-sm px-2 py-1.5 rounded-md border border-border bg-background"
                  >
                    {connection.models.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {owner && (
              <button
                type="button"
                onClick={() => chooseSource("builtin")}
                className={cn(
                  "w-full text-left rounded-md border px-2 py-1.5 text-sm transition-colors",
                  !store.activeId && source === "builtin" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                )}
              >
                Встроенный
                <span className="block text-[11px] text-muted-foreground">Только для владельца приложения</span>
              </button>
            )}
            <p className="text-[10px] text-muted-foreground px-1.5 pt-0.5">Добавить ключ — в Настройках</p>
          </div>
        </>
      )}
    </div>
  );
}