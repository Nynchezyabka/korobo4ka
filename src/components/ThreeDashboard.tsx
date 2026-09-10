import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useApp } from "@/App";
import type { CategoryId, Task } from "@/types";
import { Scene } from "@/components/three/Scene";
import bgLandscape from "@/assets/bg-landscape.webp.asset.json";
import bgPortrait from "@/assets/bg-portrait-desk.png.asset.json";

interface Props {
  onRandomTask: (categories: CategoryId[]) => void;
  onViewTasks: (categories?: CategoryId[]) => void;
}

export function ThreeDashboard({ onRandomTask, onViewTasks }: Props) {
  const { tasks, openTimer, openAddModal } = useApp();
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
            onRandom={(box) => onRandomTask(box.categories)}
            onViewTasks={(box) => onViewTasks(box.categories)}
            onAdd={(box) => openAddModal(box.categories[0], box.categories)}
            onPaper={openPaper}
            fontsReady={fontsReady}
          />
        </Suspense>
      </Canvas>
    </main>
  );
}