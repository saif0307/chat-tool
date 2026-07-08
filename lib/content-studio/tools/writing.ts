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

const draftSchema = z.object({
  title: z.string().describe("Internal short label for this draft — not shown to readers"),
  body: z.string().describe("The full, ready-to-publish content body"),
});

const WRITING_STYLE_GUIDE = [
  "Write like a specific, sharp person talking to peers — not a marketing bot.",
  "Never open with throat-clearing like 'In today's fast-paced world', 'I'm excited to announce', or 'Let's dive in'.",
  "No corporate speak, no hashtags unless explicitly asked, no more than one emoji total (and only if the platform/tone calls for it).",
  "Be concrete: specific numbers, specific examples, a real opinion — not vague platitudes.",
  "Short sentences and short paragraphs. Line breaks do a lot of work on LinkedIn/X specifically.",
  "End with something earned (a real insight, a question, a call to think) — not a generic engagement-bait CTA.",
].join("\n");

/** Pure-reasoning tool: needs the resolved language model for the request, no external API. */
export function getWritingTools(languageModel: LanguageModel): ToolSet {
  const writeContentTool = tool({
    description:
      "Write a finished, ready-to-publish piece of content for a specific chosen angle. Only call this once research exists and an angle has been chosen (by you or the user) — never as the first step.",
    inputSchema: z.object({
      format: z.enum(FORMATS).describe("Target format/platform"),
      angleTitle: z.string().min(1).describe("The chosen angle this piece is built around"),
      brief: z
        .string()
        .min(1)
        .describe("Key points, research findings, and tone to incorporate into the piece"),
    }),
    execute: async ({ format, angleTitle, brief }) => {
      try {
        const { object } = await generateObject({
          model: languageModel,
          schema: draftSchema,
          system: `You are a skilled writer producing a ${format} post.\n\n${WRITING_STYLE_GUIDE}`,
          prompt: `Angle: ${angleTitle}\n\nBrief (research, tone, key points):\n${brief}\n\nWrite the full ${format} piece now.`,
        });
        return { format, title: object.title, body: object.body };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "Writing failed.",
        };
      }
    },
  });

  return { write_content: writeContentTool };
}
