import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { firecrawlSearch, getFirecrawlApiKey } from "@/lib/firecrawl/client";

const SOURCE_QUERY: Record<string, (topic: string) => string> = {
  "hacker-news": (t) => `${t} site:news.ycombinator.com`,
  "product-hunt": (t) => `${t} site:producthunt.com`,
  "github-trending": (t) => `${t} trending site:github.com`,
  reddit: (t) => `${t} site:reddit.com discussion`,
  x: (t) => `${t} site:x.com OR site:twitter.com`,
  linkedin: (t) => `${t} site:linkedin.com/posts`,
  "ai-news": (t) => `${t} AI news`,
  "startup-news": (t) => `${t} startup news launch`,
  "engineering-discussions": (t) => `${t} engineering blog`,
};

const SOURCE_ENUM = Object.keys(SOURCE_QUERY) as [string, ...string[]];

/** Kept small — each source is its own Firecrawl call; more sources means more latency. */
const DEFAULT_SOURCES = ["hacker-news", "product-hunt", "reddit", "ai-news"];
const MAX_SOURCES = 4;

const discoverTrendsTool = tool({
  description:
    "Discover what's currently being said, launched, or discussed about a topic — across Hacker News, Product Hunt, GitHub trending, Reddit, X, LinkedIn, AI news, startup news, and engineering discussions. Call this first, before writing anything, to ground the piece in what's actually happening right now.",
  inputSchema: z.object({
    topic: z.string().min(1).describe("Subject to scan for trends, e.g. 'AI coding agents'"),
    sources: z
      .array(z.enum(SOURCE_ENUM))
      .max(MAX_SOURCES)
      .optional()
      .describe(`Which sources to scan (max ${MAX_SOURCES}). Omit to use a sensible default mix.`),
  }),
  execute: async ({ topic, sources }) => {
    if (!getFirecrawlApiKey()) {
      return { error: "Trend discovery is not configured (missing FIRECRAWL_API_KEY)." };
    }

    const chosen = (sources && sources.length > 0 ? sources : DEFAULT_SOURCES).slice(
      0,
      MAX_SOURCES,
    );

    const groups = await Promise.all(
      chosen.map(async (source) => {
        const buildQuery = SOURCE_QUERY[source];
        try {
          const results = await firecrawlSearch(buildQuery(topic), { limit: 4 });
          return { source, results };
        } catch (e) {
          return {
            source,
            results: [],
            error: e instanceof Error ? e.message : "Search failed.",
          };
        }
      }),
    );

    const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
    if (totalResults === 0) {
      return {
        topic,
        groups,
        message: "No live results found for this topic right now — reason from general knowledge instead.",
      };
    }

    return { topic, groups };
  },
});

export function getTrendDiscoveryTools(): ToolSet {
  return { discover_trends: discoverTrendsTool };
}
