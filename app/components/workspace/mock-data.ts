import type { ScriptDocument } from "./script-types";
import type { Presentation, Slide } from "./types";

type LegacySlide = Omit<Slide, "script"> & { body: string; cue: string };

// Builds each mock slide's ScriptDocument by hand with ids derived from the slide's own id,
// rather than via the makeId()-based parser — that generates a random id per call, which would
// differ between the server and client module instances and produce a hydration mismatch for
// data that's supposed to be identical (static, hardcoded) in both environments.
function slide(legacy: LegacySlide): Slide {
  const { body, cue, ...rest } = legacy;
  const script: ScriptDocument = {
    version: 1,
    paragraphs: [
      { id: `${legacy.id}-p1`, children: [{ type: "text", text: body }] },
      { id: `${legacy.id}-p2`, children: [{ type: "cue", id: `${legacy.id}-cue`, label: cue }] },
    ],
  };
  return { ...rest, script };
}

export const initialPresentations: Presentation[] = [
  {
    id: "quiet-launch",
    title: "Quiet launch strategy",
    updated: "12 min ago",
    goal: "Align the product team around a focused launch plan.",
    audience: "Product and go-to-market leads",
    durationMinutes: 8,
    progress: 86,
    slides: [
      slide({
        id: "q1",
        eyebrow: "OPENING",
        title: "A quieter way to launch",
        body: "Most launches compete for attention. Ours is designed to earn trust. Today, I’ll walk through a focused plan that starts with our strongest users, learns quickly, and scales only when the signal is clear.",
        cue: "Pause after ‘earn trust.’ Let the contrast land.",
        marker: "Calm opening",
        accent: "petal",
      }),
      slide({
        id: "q2",
        eyebrow: "THE SIGNAL",
        title: "Clarity is already compounding",
        body: "In the last six weeks, activation moved from sixty-one to seventy-four percent. The change was not driven by more traffic. It came from making the first ten minutes of the product easier to understand.",
        cue: "Point to 74%, then return your attention to the room.",
        marker: "Anchor the metric",
        accent: "blue",
      }),
      slide({
        id: "q3",
        eyebrow: "THE PLAN",
        title: "Three deliberate moves",
        body: "The plan is intentionally small. First, invite the users who already feel the problem most sharply. Second, give them a guided first week. Third, use what we learn to shape the public story.",
        cue: "Count the three moves on your fingers—slowly.",
        marker: "Three beats",
        accent: "ink",
      }),
      slide({
        id: "q4",
        eyebrow: "CLOSE",
        title: "The ask",
        body: "I’m asking for one focused month, one shared measure of success, and permission to learn before we amplify. If we protect that focus, the public launch will have a stronger story because it will be true.",
        cue: "Look up for the final sentence. Do not rush the ask.",
        marker: "Direct close",
        accent: "petal",
      }),
    ],
  },
  {
    id: "research-review",
    title: "Research review",
    updated: "Yesterday",
    goal: "Explain the research findings without losing the non-technical audience.",
    audience: "Faculty partners and program leads",
    durationMinutes: 12,
    progress: 54,
    slides: [
      slide({
        id: "r1",
        eyebrow: "CONTEXT",
        title: "What we wanted to understand",
        body: "We started with one practical question: what helps a new learner stay engaged after the first moment of difficulty? The data points toward a surprisingly human answer—timely reassurance matters as much as instructional clarity.",
        cue: "Slow down on the research question.",
        marker: "Frame the question",
        accent: "blue",
      }),
      slide({
        id: "r2",
        eyebrow: "FINDING",
        title: "Support changes persistence",
        body: "Participants who received a short reassurance cue were more likely to attempt the task again. This does not prove causation on its own, but it gives us a strong direction for the next study.",
        cue: "Emphasize the limitation before the conclusion.",
        marker: "State uncertainty",
        accent: "ink",
      }),
    ],
  },
  {
    id: "team-update",
    title: "August team update",
    updated: "Aug 24",
    goal: "Give the team a clear view of progress and the next decision.",
    audience: "Internal team",
    durationMinutes: 6,
    progress: 28,
    slides: [
      slide({
        id: "t1",
        eyebrow: "THIS MONTH",
        title: "Momentum, with one constraint",
        body: "We made meaningful progress this month, especially in onboarding. The constraint is capacity, so the next decision is not what we can add—it is what we can protect.",
        cue: "Pause before naming the constraint.",
        marker: "Set the tension",
        accent: "petal",
      }),
    ],
  },
];
