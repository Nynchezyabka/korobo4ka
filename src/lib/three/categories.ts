import type { CategoryId } from "@/types";

export interface BoxDef {
  id: number;
  label: string;
  labelColor: string;
  labelTextColor: string;
  categories: CategoryId[];
}

export const PAPER_COLORS: Record<CategoryId, string> = {
  0: "#9e9e9e",
  1: "#ffd54f",
  2: "#64b5f6",
  3: "#81c784",
  4: "#e57373",
  5: "#9575cd",
};

export const BOXES: BoxDef[] = [
  {
    id: 1,
    label: "обязательные дела",
    labelColor: "#f7c948",
    labelTextColor: "#4a3a10",
    categories: [1],
  },
  {
    id: 2,
    label: "система безопасности\nи доступность простых радостей",
    labelColor: "#bca7e0",
    labelTextColor: "#33254d",
    categories: [2, 5],
  },
  {
    id: 3,
    label: "простые и эго-радости",
    labelColor: "#a8c97f",
    labelTextColor: "#2c3d18",
    categories: [3, 4],
  },
];