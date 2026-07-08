import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { firecrawlSearch, getFirecrawlApiKey } from "@/lib/firecrawl/client";

const FOCUS_QUERY: Record<string, (topic: string) => string> = {
  statistic: (t) => `${t} statistics data`,
  benchmark: (t) => `${t} benchmark comparison`,
  example: (t) => `${t} examples case study`,
  quote: (t) => `${t} quote said interview`,
  launch: (t) => `${t} launch announcement`,
  pricing: (t) => `${t} pricing cost`,
  fact: (t) => `${t} facts explained`,
};

const FOCUS_ENUM = Object.keys(FOCUS_QUERY) as [string, ...string[]];
const MAX_QUERIES = 3;

const collectResearchTool = tool({
  description:
    "Collect statistics, benchmarks, examples, quotes, launch details, pricing, and facts about a topic so writing is grounded in evidence instead of general impressions. Call after discover_trends, before generating angles.",
  inputSchema: z.object({
    topic: z.string().min(1).describe("What to research"),
    focus: z
      .array(z.enum(FOCUS_ENUM))
      .max(MAX_QUERIES)
      .optional()
      .describe(`Kinds of findings to prioritize (max ${MAX_QUERIES}). Omit for a broad mix.`),
  }),
  execute: async ({ topic, focus }) => {
    if (!getFirecrawlApiKey()) {
      return { error: "Research is not configured (missing FIRECRAWL_API_KEY)." };
    }

    const chosenFocus = (focus && focus.length > 0 ? focus : ["statistic", "example", "fact"]).slice(
      0,
      MAX_QUERIES,
    );

    const resultSets = await Promise.all(
      chosenFocus.map(async (f) => {
        const buildQuery = FOCUS_QUERY[f];
        try {
          return await firecrawlSearch(buildQuery(topic), { limit: 5 });
        } catch {
          return [];
        }
      }),
    );

    const seen = new Set<string>();
    const results = resultSets.flat().filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (results.length === 0) {
      return {
        topic,
        results: [],
        message: "No live research found for this topic right now — reason from general knowledge instead.",
      };
    }

    return { topic, results };
  },
});

export function getResearchTools(): ToolSet {
  return { collect_research: collectResearchTool };
}
