/**
 * Shared Firecrawl search client — used by the chatbot's `web_search` tool and by Content
 * Studio's `discover_trends` / `collect_research` tools. Extracted so neither reimplements the
 * Firecrawl fetch call.
 * @see https://docs.firecrawl.dev/features/search
 */

export type FirecrawlResult = {
  rank: number;
  title: string;
  url: string;
  snippet: string;
};

/** Accepts either env var name — `.env` in this project uses `FIRECRAWL_API`. */
export function getFirecrawlApiKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API;
}

export async function firecrawlSearch(
  query: string,
  opts?: { limit?: number },
): Promise<FirecrawlResult[]> {
  const key = getFirecrawlApiKey();
  if (!key) {
    throw new Error("Firecrawl is not configured (missing FIRECRAWL_API_KEY).");
  }

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      limit: opts?.limit ?? 6,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firecrawl search failed (${res.status}): ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      web?: Array<{ title?: string; url?: string; description?: string; position?: number }>;
    };
  };

  const web = json.data?.web ?? [];
  return web.map((r, i) => ({
    rank: r.position ?? i + 1,
    title: r.title ?? "Untitled",
    url: r.url ?? "",
    snippet: (r.description ?? "").slice(0, 450),
  }));
}
