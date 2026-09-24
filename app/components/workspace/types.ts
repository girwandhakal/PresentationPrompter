import type { ScriptDocument } from "./script-types";

export type CueType = "Pause" | "Emphasize" | "Gesture" | "Look up";

export type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  script?: ScriptDocument;
  cue: string;
  cueType: CueType;
  duration: string;
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

export type AppView = "project" | "new" | "editor";
