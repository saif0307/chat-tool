import { getToolName, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/content-studio/types";

/** Maps each real tool to the stage it represents having reached. */
const STAGE_FOR_TOOL: Record<string, WorkflowStage> = {
  discover_trends: "research",
  collect_research: "research",
  generate_angles: "angles",
  write_content: "generate",
  critique_draft: "complete",
};

const STAGE_ORDER = WORKFLOW_STAGES.map((s) => s.id);

/**
 * Derives the project's current stage purely from which tools have actually succeeded in the
 * conversation so far — never a manually-set flag that could drift from reality.
 */
export function inferWorkflowStage(messages: UIMessage[]): WorkflowStage {
  let bestIndex = 0;

  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;
      if (part.state !== "output-available") continue;
      const output = part.output as { error?: unknown } | undefined;
      if (output && typeof output === "object" && "error" in output && output.error) continue;

      const toolName = getToolName(part);
      const stage = STAGE_FOR_TOOL[toolName];
      if (!stage) continue;
      const idx = STAGE_ORDER.indexOf(stage);
      if (idx > bestIndex) bestIndex = idx;
    }
  }

  return STAGE_ORDER[bestIndex];
}
