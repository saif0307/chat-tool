"use client";

export type LooseToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function labelFromType(type: string): string {
  return type.startsWith("tool-")
    ? type.slice(5).replace(/_/g, " ")
    : "tool";
}

function Spinner() {
  return (
    <span
      className="border-foreground/30 mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-sky-500"
      aria-hidden
    />
  );
}

export function ToolInvocationCard({ part }: { part: LooseToolPart }) {
  const title = labelFromType(part.type);
  const query =
    part.input && typeof part.input === "object" && part.input !== null && "query" in part.input
      ? String((part.input as { query?: unknown }).query ?? "")
      : "";

  const isWebSearch =
    part.type.includes("web_search") || part.type === "tool-web_search";

  if (part.state === "output-error" || part.errorText) {
    return (
      <div className="border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200 mb-2 rounded-lg border px-3 py-2 text-sm">
        <span className="font-medium">{title}</span>: {part.errorText ?? "Tool failed"}
      </div>
    );
  }

  if (
    part.state === "output-available" &&
    part.output &&
    typeof part.output === "object" &&
    part.output !== null &&
    "error" in part.output
  ) {
    const err = String((part.output as { error?: unknown }).error ?? "");
    return (
      <div className="border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100 mb-2 rounded-lg border px-3 py-2 text-sm">
        <span className="font-medium">{title}</span>: {err}
      </div>
    );
  }

  /** In-flight tool — show realtime feedback before results land */
  if (part.state === "input-streaming" || part.state === "input-available") {
    const phase =
      part.state === "input-streaming"
        ? isWebSearch
          ? "Preparing web search…"
          : `Preparing ${title}…`
        : isWebSearch
          ? "Searching the web…"
          : `Calling ${title}…`;
    return (
      <div className="border-sky-500/30 bg-sky-500/[0.07] mb-3 flex gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-sm">
        <Spinner />
        <div className="min-w-0">
          <div className="text-foreground font-medium">{phase}</div>
          {query ? (
            <div className="text-foreground/65 mt-1 font-mono text-xs leading-snug">
              Query: “{query}”
            </div>
          ) : (
            <div className="text-foreground/55 mt-0.5 animate-pulse text-xs">Gathering arguments…</div>
          )}
        </div>
      </div>
    );
  }

  if (part.state === "output-available" && part.output) {
    const out = part.output as {
      query?: string;
      results?: Array<{ rank?: number; title?: string; url?: string; snippet?: string }>;
    };
    const rows = out.results ?? [];
    if (rows.length > 0) {
      return (
        <div className="border-foreground/12 bg-foreground/[0.03] mb-3 rounded-lg border px-3 py-2 text-sm">
          <div className="text-foreground/65 mb-1 flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-wide">
            Web search
            {query || out.query ? (
              <span className="text-foreground/85 font-normal normal-case">
                “{query || out.query}”
              </span>
            ) : null}
          </div>
          <ul className="border-foreground/10 mt-2 space-y-2 border-t pt-2">
            {rows.slice(0, 6).map((r, i) => (
              <li key={`${r.url}-${i}`} className="text-[13px] leading-snug">
                <span className="text-foreground/55 mr-2 font-mono text-[11px]">{r.rank ?? i + 1}</span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {r.title ?? "Link"}
                </a>
                {r.snippet ? (
                  <p className="text-foreground/70 mt-0.5 pl-7">{r.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    /** Provider-native search often returns structured blobs instead of `results`. */
    return (
      <details className="border-foreground/12 bg-foreground/[0.03] mb-3 rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-foreground/65">
          Web search (details)
        </summary>
        <pre className="text-foreground/75 mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
          {JSON.stringify(out, null, 2).slice(0, 8000)}
        </pre>
      </details>
    );
  }

  /** Tool running — unknown intermediate state */
  if (
    part.state &&
    part.state !== "output-available" &&
    part.state !== "output-error" &&
    part.state !== "output-denied"
  ) {
    return (
      <div className="border-foreground/15 bg-foreground/[0.04] mb-3 flex gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <Spinner />
        <div className="min-w-0">
          <div className="text-foreground font-medium">
            {isWebSearch ? "Fetching web results…" : `${title}…`}
          </div>
          {query ? (
            <div className="text-foreground/65 mt-1 text-xs">“{query}”</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="border-foreground/12 bg-foreground/[0.03] text-foreground/75 mb-2 flex gap-2 rounded-lg border px-3 py-2 text-sm">
      <Spinner />
      <span>
        <span className="font-medium">{isWebSearch ? "Web search" : title}</span>
        {query ? ` · “${query}”` : null} — starting…
      </span>
    </div>
  );
}
