import { generateObject, tool } from "ai";
import type { LanguageModel, ToolSet } from "ai";
import { z } from "zod";

const ANGLE_KINDS = [
  "founder",
  "engineer",
  "contrarian",
  "prediction",
  "framework",
  "case-study",
  "lessons-learned",
  "mistakes",
  "story",
  "question",
] as const;

const angleSchema = z.object({
  angles: z
    .array(
      z.object({
        kind: z.enum(ANGLE_KINDS),
        title: z.string().describe("Short, specific working title for this angle"),
        hook: z.string().describe("A punchy first line this angle could open with"),
        summary: z
          .string()
          .describe("2-3 sentences on what this angle argues and why it's genuinely distinct from the others"),
      }),
    )
    .min(3)
    .max(6),
});

/** Pure-reasoning tool: needs the resolved language model for the request, no external API. */
export function getAngleGeneratorTools(languageModel: LanguageModel): ToolSet {
  const generateAnglesTool = tool({
    description:
      "Generate several genuinely different angles (perspectives) on a topic, grounded in the research gathered so far. Call after discover_trends/collect_research, before writing. Do not produce superficial rewrites of the same idea — each angle must argue something distinct.",
    inputSchema: z.object({
      topic: z.string().min(1).describe("Topic to generate angles for"),
      context: z
        .string()
        .min(1)
        .describe(
          "A compact synthesis of the trends/research findings so far (a few sentences) — used to ground the angles in real information instead of generic takes.",
        ),
    }),
    execute: async ({ topic, context }) => {
      try {
        const { object } = await generateObject({
          model: languageModel,
          schema: angleSchema,
          system:
            "You generate sharp, genuinely distinct content angles for a writer. Avoid generic marketing takes. Each angle must have a different core argument, not just different phrasing of the same point.",
          prompt: `Topic: ${topic}\n\nResearch/context so far:\n${context}\n\nGenerate 4-5 distinct angles.`,
        });
        return { topic, angles: object.angles };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "Angle generation failed.",
        };
      }
    },
  });

  return { generate_angles: generateAnglesTool };
}
