import { LOCATIONS, setCurrentLocation, useCurrentLocation } from "@/lib/location";
import { cn } from "@/lib/utils";

/** «Где я сейчас?» — случайная задача берёт только подходящие дела */
export function LocationToggle({ className }: { className?: string }) {
  const current = useCurrentLocation();
  return (
    <div className={cn("flex items-center justify-center gap-1.5 flex-wrap", className)}>
      <span className="text-xs text-muted-foreground mr-0.5">Где я сейчас?</span>
      {LOCATIONS.map((l) => (
        <button
          key={l.id}
          onClick={() => setCurrentLocation(l.id)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95",
            current === l.id
              ? "border-primary/40 bg-primary/10 text-foreground font-semibold"
              : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
          )}
        >
          {l.emoji} {l.label}
        </button>
      ))}
    </div>
  );
}
