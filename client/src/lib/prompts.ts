// ─── CBT Prompt Engine ───────────────────────────────────────────────────────
// Implements the prompt families from the spec.
// Returns a varied prompt for each CBT stage to avoid sounding scripted.

export type CbtStage =
  | "opening"
  | "situation"
  | "thought"
  | "emotion"
  | "evidence-for"
  | "evidence-against"
  | "alternative"
  | "action"
  | "closing";

export interface RecapContext {
  lastSituation?: string | null;
  lastThought?: string | null;
  lastAction?: string | null;
  topTag?: string | null;
  unfinishedAction?: string | null;
}

const openingPrompts = [
  "What's the one situation you want to zoom in on today?",
  "What happened that's most worth unpacking right now?",
  "What moment from today or yesterday is still sitting with you?",
  "What's been most on your mind during the drive?",
  "What do you want to put on the table today?",
];

const thoughtPrompts = [
  "What did your brain say in that moment?",
  "If you put a subtitle on that scene, what would it be?",
  "What did that seem to mean — about you, or them, or the situation?",
  "What was the story your mind was telling you?",
  "What was the instant thought that showed up first?",
];

const emotionPrompts = [
  "What was the feeling underneath that? Name it if you can.",
  "How did that land in your body?",
  "One word for the emotion — what is it?",
  "What's the intensity of that feeling, roughly 0 to 10?",
];

const evidenceForPrompts = [
  "What facts actually support that thought?",
  "What evidence is your brain leaning on there?",
  "What makes that thought feel convincing?",
];

const evidenceAgainstPrompts = [
  "What facts push against that thought?",
  "Where might your brain be overstating the case?",
  "What would someone who cares about you say back to that thought?",
  "What does the evidence not support?",
];

const alternativePrompts = [
  "What's a more balanced version of that thought?",
  "What would you say to a friend in exactly this situation?",
  "What's a thought that fits the facts without being brutal about it?",
  "If you had to be fair to yourself here, what would you say?",
];

const actionPrompts = [
  "What's one small thing you could actually do this week that fits that thought?",
  "If you had to pick one concrete next step, what would it be?",
  "What's something small that would test whether the balanced thought is true?",
  "One action — what is it?",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getPrompt(stage: CbtStage): string {
  switch (stage) {
    case "opening":
    case "situation":
      return pick(openingPrompts);
    case "thought":
      return pick(thoughtPrompts);
    case "emotion":
      return pick(emotionPrompts);
    case "evidence-for":
      return pick(evidenceForPrompts);
    case "evidence-against":
      return pick(evidenceAgainstPrompts);
    case "alternative":
      return pick(alternativePrompts);
    case "action":
      return pick(actionPrompts);
    case "closing":
      return "That's a solid place to land. I've saved a summary. Same time next drive?";
    default:
      return pick(openingPrompts);
  }
}

export function buildRecapText(ctx: RecapContext): string {
  const parts: string[] = [];
  if (ctx.lastSituation) {
    parts.push(`Last time you focused on: ${ctx.lastSituation}.`);
  }
  if (ctx.lastThought) {
    parts.push(`The main thought was: "${ctx.lastThought}".`);
  }
  if (ctx.unfinishedAction) {
    parts.push(`You planned to: ${ctx.unfinishedAction} — that's still open.`);
  } else if (ctx.lastAction) {
    parts.push(`You planned to: ${ctx.lastAction}.`);
  }
  if (ctx.topTag && !ctx.lastSituation) {
    parts.push(`A recurring theme for you is ${ctx.topTag}.`);
  }
  parts.push(getPrompt("opening"));
  return parts.join(" ");
}

export const CBT_STAGES: CbtStage[] = [
  "situation",
  "thought",
  "emotion",
  "evidence-for",
  "evidence-against",
  "alternative",
  "action",
];

// Drive mode uses the same stages — alias for clarity
export const DRIVE_STAGES = CBT_STAGES;

export const STAGE_LABELS: Record<CbtStage, string> = {
  opening: "Opening",
  situation: "Situation",
  thought: "Thought",
  emotion: "Emotion",
  "evidence-for": "Evidence for",
  "evidence-against": "Evidence against",
  alternative: "Alternative",
  action: "Action",
  closing: "Closing",
};

export const COGNITIVE_PATTERNS = [
  "Catastrophising",
  "Mind-reading",
  "All-or-nothing",
  "Emotional reasoning",
  "Personalisation",
  "Should statements",
  "Overgeneralisation",
  "Discounting positives",
  "Labelling",
  "Fortune-telling",
];

export const SESSION_TAGS = [
  "work",
  "health",
  "sleep",
  "relationships",
  "self-criticism",
  "masking",
  "family",
  "finance",
  "identity",
  "parenting",
];
