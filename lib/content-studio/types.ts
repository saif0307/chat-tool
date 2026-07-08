import type { UIMessage } from "ai";

/**
 * Real, tool-evidenced stages — each one (after `discover`) corresponds to a tool that has
 * actually been called in the conversation. See `lib/content-studio/workflow.ts`.
 */
export type WorkflowStage = "discover" | "research" | "angles" | "generate" | "complete";

export type WorkflowStageInfo = {
  id: WorkflowStage;
  label: string;
  description: string;
};

export const WORKFLOW_STAGES: WorkflowStageInfo[] = [
  { id: "discover", label: "Discover", description: "Starting point — no research yet" },
  { id: "research", label: "Research", description: "Trends and supporting facts gathered" },
  { id: "angles", label: "Angles", description: "Distinct perspectives generated" },
  { id: "generate", label: "Generate", description: "A draft has been written" },
  { id: "complete", label: "Complete", description: "Critiqued and polished into a final version" },
];

export type AngleKind =
  | "founder"
  | "engineer"
  | "contrarian"
  | "prediction"
  | "framework"
  | "case-study"
  | "lessons-learned"
  | "mistakes"
  | "story"
  | "question";

export type Angle = {
  kind: AngleKind;
  title: string;
  hook: string;
  summary: string;
};

export type ContentFormat =
  | "linkedin"
  | "x"
  | "blog"
  | "newsletter"
  | "article"
  | "carousel-outline"
  | "video-script";

export type CritiqueScores = {
  hook: number;
  flow: number;
  authority: number;
  novelty: number;
  readability: number;
  engagement: number;
};

export type ContentProject = {
  id: string;
  title: string;
  /** When `manual`, auto title from the first message does not overwrite `title`. */
  titleMode?: "auto" | "manual";
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
};
