import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Dices, ListChecks, Plus } from "lucide-react";
import { useApp } from "@/App";
import type { CategoryId, Task } from "@/types";
import { BOXES } from "@/lib/three/categories";
import { Scene } from "@/components/three/Scene";
import bgLandscape from "@/assets/bg-landscape.webp.asset.json";
import bgPortrait from "@/assets/bg-portrait-desk.png.asset.json";

interface Props {
  onRandomTask: (categories: CategoryId[]) => void;
  onViewTasks: (categories?: CategoryId[]) => void;
}

export function ThreeDashboard({ onRandomTask, onViewTasks }: Props) {
  const { tasks, openTimer, openAddModal } = useApp();
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [stacked, setStacked] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const updateLayout = () => setStacked(window.innerHeight > window.innerWidth || window.innerWidth < 768);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => { if (active) setFontsReady(true); });
    return () => { active = false; };
  }, []);

  const visibleTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((task) => !task.completed && (!task.scheduledFor || task.scheduledFor <= now));
  }, [tasks]);
  const selected = BOXES.find((box) => box.id === selectedBox);

  const openPaper = (task: Task) => openTimer(task);

  return (
    <main className="three-home fixed inset-y-0 left-12 right-0 overflow-hidden" aria-label="Трёхмерная главная">
      <div
        className="three-home-bg absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${stacked ? bgPortrait.url : bgLandscape.url})` }}
      />
      <div className="three-home-shade absolute inset-0 pointer-events-none" />

      <Canvas
        className="absolute inset-0"
        shadows
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.7, 4.2], fov: 42 }}
      >
        <Suspense fallback={null}>
          <Scene
            tasks={visibleTasks}
            stacked={stacked}
            openBox={selectedBox}
            onSelectBox={setSelectedBox}
            onPaper={openPaper}
            fontsReady={fontsReady}
          />
        </Suspense>
      </Canvas>

      {selected && (
        <div className="three-actions absolute left-1/2 z-20 -translate-x-1/2 rounded-xl border px-2 py-2 shadow-xl backdrop-blur-md">
          <p className="max-w-52 truncate px-2 pb-1 text-center text-xs font-semibold">{selected.label.replace("\n", " ")}</p>
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => onRandomTask(selected.categories)} className="three-action-button" title="Случайная задача" aria-label="Выбрать случайную задачу">
              <Dices size={18} />
            </button>
            <button onClick={() => onViewTasks(selected.categories)} className="three-action-button" title="Посмотреть задачи" aria-label="Посмотреть задачи этой группы">
              <ListChecks size={18} />
            </button>
            <button onClick={() => openAddModal(selected.categories[0], selected.categories)} className="three-action-button" title="Добавить задачу" aria-label="Добавить задачу в эту группу">
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}