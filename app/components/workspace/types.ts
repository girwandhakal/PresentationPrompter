import type { ScriptDocument } from "./script-types";

export type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  script: ScriptDocument;
  marker: string;
  accent: "blue" | "petal" | "ink";
};

export type Presentation = {
  id: string;
  title: string;
  updated: string;
  goal: string;
  audience: string;
  durationMinutes: number;
  progress: number;
  slides: Slide[];
};
