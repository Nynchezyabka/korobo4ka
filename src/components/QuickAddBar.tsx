import { useState, useRef } from "react";
import { Mic, Plus } from "lucide-react";
import { addNote } from "@/lib/notes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  inTimer?: boolean;
}

/** Быстрый карман: всё, что записано здесь, ждёт в «Разборе». */
export function QuickAddBar({ inTimer }: Props) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const save = (value: string) => {
    const v = value.trim();
    if (!v) return;
    addNote(v);
    toast.success("Записано — ждёт в «Разборе»");
    setText("");
  };

  const handleVoice = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      toast.error("Голосовой ввод не поддерживается в этом браузере");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = "ru-RU";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => save(e.results[0][0].transcript);
    r.onerror = () => { setListening(false); toast.error("Не удалось распознать"); };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const containerCls = inTimer
    ? "fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] w-[min(560px,calc(100%-1rem))]"
    : "fixed bottom-5 left-[calc(3rem+0.5rem)] right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(560px,calc(100%-4rem))] z-[90]";

  return (
    <div className={containerCls}>
      <div className="quick-add-bar flex items-center gap-1 sm:gap-1.5 rounded-2xl bg-background border border-border shadow-lg p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(text); }}
          placeholder="Записать мысль…"
          className="flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-xl bg-transparent text-base sm:text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={handleVoice}
          className={cn("flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-md border shrink-0", listening ? "bg-red-500/15 border-red-400 text-red-600 animate-pulse" : "border-border text-muted-foreground hover:bg-muted")}
          title={listening ? "Идёт запись — нажмите, чтобы остановить" : "Надиктовать"}
        >
          {listening ? <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> : <Mic size={16} />}
        </button>
        <button
          onClick={() => save(text)}
          disabled={!text.trim()}
          className="flex items-center justify-center w-11 h-11 sm:w-10 sm:h-9 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-all shrink-0"
          title="Записать"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
