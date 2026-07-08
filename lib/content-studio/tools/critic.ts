import { generateObject, tool } from "ai";
import type { LanguageModel, ToolSet } from "ai";
import { z } from "zod";

const FORMATS = [
  "linkedin",
  "x",
  "blog",
  "newsletter",
  "article",
  "carousel-outline",
  "video-script",
] as const;

const critiqueSchema = z.object({
  scores: z.object({
    hook: z.number().min(0).max(10),
    flow: z.number().min(0).max(10),
    authority: z.number().min(0).max(10),
    novelty: z.number().min(0).max(10),
    readability: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
  }),
  notes: z
    .array(z.string())
    .describe("Specific, concrete weaknesses found — not generic praise"),
  improvedDraft: z
    .string()
    .describe(
      "The full rewritten draft with the weak sections fixed. This is the final, ready-to-publish version.",
    ),
});

/** Pure-reasoning tool: needs the resolved language model for the request, no external API. */
export function getCriticTools(languageModel: LanguageModel): ToolSet {
  const critiqueDraftTool = tool({
    description:
      "Review a draft, score it on hook/flow/authority/novelty/readability/engagement (0-10 each), and rewrite the weak sections. Call this after write_content — its improved draft is the final deliverable, not the pre-critique version.",
    inputSchema: z.object({
      draft: z.string().min(1).describe("The full draft text to critique"),
      format: z.enum(FORMATS).optional(),
    }),
    execute: async ({ draft, format }) => {
      try {
        const { object } = await generateObject({
          model: languageModel,
          schema: critiqueSchema,
          system:
            "You are an exacting editor. Score honestly — a draft with real weaknesses should not get high scores across the board. Then rewrite it to actually fix those weaknesses, keeping the original voice and intent, avoiding AI cliches and corporate language.",
          prompt: `Format: ${format ?? "unspecified"}\n\nDraft:\n${draft}\n\nScore it and produce an improved version.`,
        });
        return {
          scores: object.scores,
          notes: object.notes,
          improvedDraft: object.improvedDraft,
        };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "Critique failed.",
        };
      }
    },
  });

  return { critique_draft: critiqueDraftTool };
}
