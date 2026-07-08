import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { firecrawlSearch, getFirecrawlApiKey } from "@/lib/firecrawl/client";

/** Custom web search via Firecrawl when `WEB_SEARCH_BACKEND=firecrawl`. */
const firecrawlWebSearchTool = tool({
  description:
    "Search the public web at most once per user message. Use one query that covers the full question (e.g. include both Brent and WTI if the user asks about oil prices). Answer from results; do not search again in the same turn unless results were empty.",
  inputSchema: z.object({
    query: z.string().describe("Concise web search query"),
  }),
  execute: async ({ query }) => {
    if (!getFirecrawlApiKey()) {
      return { error: "Web search is not configured (missing FIRECRAWL_API_KEY)." };
    }
    try {
      const results = await firecrawlSearch(query, { limit: 6 });
      return { query, results };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Web search failed.";
      return { error: msg };
    }
  },
});

export function getFirecrawlWebSearchTools(): ToolSet {
  if (!getFirecrawlApiKey()) return {};
  return { web_search: firecrawlWebSearchTool };
}
