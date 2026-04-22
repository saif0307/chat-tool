import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";

/**
 * Custom web search via Firecrawl `/v2/search` when `WEB_SEARCH_BACKEND=firecrawl`.
 * @see https://docs.firecrawl.dev/features/search
 */
const firecrawlWebSearchTool = tool({
  description:
    "Search the public web at most once per user message. Use one query that covers the full question (e.g. include both Brent and WTI if the user asks about oil prices). Answer from results; do not search again in the same turn unless results were empty.",
  inputSchema: z.object({
    query: z.string().describe("Concise web search query"),
  }),
  execute: async ({ query }) => {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) {
      return { error: "Web search is not configured (missing FIRECRAWL_API_KEY)." };
    }

    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        limit: 6,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { error: `Firecrawl search failed (${res.status}): ${errText.slice(0, 400)}` };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        web?: Array<{ title?: string; url?: string; description?: string; position?: number }>;
      };
    };

    const web = json.data?.web ?? [];
    const results = web.map((r, i) => ({
      rank: r.position ?? i + 1,
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      snippet: (r.description ?? "").slice(0, 450),
    }));

    return { query, results };
  },
});

export function getFirecrawlWebSearchTools(): ToolSet {
  if (!process.env.FIRECRAWL_API_KEY) return {};
  return { web_search: firecrawlWebSearchTool };
}
