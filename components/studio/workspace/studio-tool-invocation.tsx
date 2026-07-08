"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

export type StudioToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_LABELS: Record<string, string> = {
  discover_trends: "Trend Discovery",
  collect_research: "Research",
  generate_angles: "Angle Generator",
  write_content: "Writing",
  critique_draft: "Critic",
};

const SOURCE_LABELS: Record<string, string> = {
  "hacker-news": "Hacker News",
  "product-hunt": "Product Hunt",
  "github-trending": "GitHub Trending",
  reddit: "Reddit",
  x: "X",
  linkedin: "LinkedIn",
  "ai-news": "AI News",
  "startup-news": "Startup News",
  "engineering-discussions": "Engineering Discussions",
};

const ANGLE_KIND_LABELS: Record<string, string> = {
  founder: "Founder",
  engineer: "Engineer",
  contrarian: "Contrarian",
  prediction: "Prediction",
  framework: "Framework",
  "case-study": "Case Study",
  "lessons-learned": "Lessons Learned",
  mistakes: "Mistakes",
  story: "Story",
  question: "Question",
};

const SCORE_LABELS: Record<string, string> = {
  hook: "Hook",
  flow: "Flow",
  authority: "Authority",
  novelty: "Novelty",
  readability: "Readability",
  engagement: "Engagement",
};

function labelForType(type: string): string {
  const key = type.startsWith("tool-") ? type.slice(5) : type;
  return TOOL_LABELS[key] ?? key.replace(/_/g, " ");
}

function toolNameForType(type: string): string {
  return type.startsWith("tool-") ? type.slice(5) : type;
}

function Spinner() {
  return (
    <span
      className="border-foreground/25 border-t-cs-accent mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2"
      aria-hidden
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="text-foreground/60 hover:bg-foreground/10 hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CardShell({
  accent = "neutral",
  title,
  children,
}: {
  accent?: "neutral" | "accent" | "error";
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 overflow-hidden rounded-xl border text-sm shadow-sm",
        accent === "accent" && "border-cs-accent/25 bg-cs-accent/5",
        accent === "error" && "border-red-500/30 bg-red-500/10",
        accent === "neutral" && "border-foreground/10 bg-cs-surface",
      )}
    >
      <div
        className={cn(
          "border-b px-3.5 py-2 text-xs font-semibold uppercase tracking-wide",
          accent === "accent" && "border-cs-accent/15 text-cs-accent",
          accent === "error" && "border-red-500/20 text-red-700 dark:text-red-300",
          accent === "neutral" && "border-foreground/10 text-foreground/60",
        )}
      >
        {title}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );
}

type DiscoverTrendsOutput = {
  topic?: string;
  message?: string;
  error?: string;
  groups?: Array<{
    source: string;
    results: Array<{ title: string; url: string; snippet: string }>;
    error?: string;
  }>;
};

type CollectResearchOutput = {
  topic?: string;
  message?: string;
  error?: string;
  results?: Array<{ title: string; url: string; snippet: string }>;
};

type GenerateAnglesOutput = {
  topic?: string;
  error?: string;
  angles?: Array<{ kind: string; title: string; hook: string; summary: string }>;
};

type WriteContentOutput = {
  format?: string;
  title?: string;
  body?: string;
  error?: string;
};

type CritiqueDraftOutput = {
  scores?: Record<string, number>;
  notes?: string[];
  improvedDraft?: string;
  error?: string;
};

function DiscoverTrendsResult({ output }: { output: DiscoverTrendsOutput }) {
  const groups = (output.groups ?? []).filter((g) => g.results.length > 0);
  if (groups.length === 0) {
    return <p className="text-foreground/55">{output.message ?? "No live results found."}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.source}>
          <p className="text-foreground/50 mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
            {SOURCE_LABELS[g.source] ?? g.source}
          </p>
          <ul className="flex flex-col gap-1.5">
            {g.results.slice(0, 3).map((r, i) => (
              <li key={`${r.url}-${i}`} className="text-[13px] leading-snug">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-cs-accent font-medium underline underline-offset-2"
                >
                  {r.title}
                </a>
                {r.snippet ? <p className="text-foreground/60 mt-0.5">{r.snippet}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CollectResearchResult({ output }: { output: CollectResearchOutput }) {
  const results = output.results ?? [];
  if (results.length === 0) {
    return <p className="text-foreground/55">{output.message ?? "No findings."}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {results.slice(0, 6).map((r, i) => (
        <li key={`${r.url}-${i}`} className="text-[13px] leading-snug">
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-cs-accent font-medium underline underline-offset-2"
          >
            {r.title}
          </a>
          {r.snippet ? <p className="text-foreground/60 mt-0.5">{r.snippet}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function GenerateAnglesResult({
  output,
  onSelectAngle,
}: {
  output: GenerateAnglesOutput;
  onSelectAngle?: (text: string) => void;
}) {
  const angles = output.angles ?? [];
  if (angles.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {angles.map((a, i) => (
        <div
          key={i}
          className="border-foreground/10 bg-background flex flex-col gap-1.5 rounded-lg border p-3"
        >
          <span className="bg-cs-accent/15 text-cs-accent w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {ANGLE_KIND_LABELS[a.kind] ?? a.kind}
          </span>
          <p className="text-foreground text-sm font-semibold">{a.title}</p>
          <p className="text-foreground/60 text-[13px] italic">&ldquo;{a.hook}&rdquo;</p>
          <p className="text-foreground/70 text-[13px] leading-relaxed">{a.summary}</p>
          {onSelectAngle ? (
            <button
              type="button"
              onClick={() => onSelectAngle(`Let's go with the "${a.title}" (${ANGLE_KIND_LABELS[a.kind] ?? a.kind}) angle.`)}
              className="bg-foreground/8 hover:bg-foreground/15 text-foreground mt-1 self-start rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            >
              Use this angle
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WriteContentResult({ output }: { output: WriteContentOutput }) {
  if (!output.body) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-foreground/50 text-[11px] font-semibold uppercase tracking-wide">
          {output.format ?? "Draft"}
        </span>
        <CopyButton text={output.body} />
      </div>
      <div className="text-foreground border-foreground/10 bg-background whitespace-pre-wrap rounded-lg border p-3 text-[14px] leading-relaxed">
        {output.body}
      </div>
    </div>
  );
}

function CritiqueDraftResult({ output }: { output: CritiqueDraftOutput }) {
  if (!output.scores || !output.improvedDraft) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Object.entries(output.scores).map(([key, value]) => (
          <div key={key} className="border-foreground/10 bg-background rounded-lg border p-2 text-center">
            <p className="text-foreground text-base font-semibold tabular-nums">{value}</p>
            <p className="text-foreground/45 text-[10px] font-medium uppercase tracking-wide">
              {SCORE_LABELS[key] ?? key}
            </p>
          </div>
        ))}
      </div>

      {output.notes && output.notes.length > 0 ? (
        <ul className="text-foreground/65 flex flex-col gap-1 text-[13px] leading-relaxed">
          {output.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-foreground/30" aria-hidden>
                •
              </span>
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-foreground/50 text-[11px] font-semibold uppercase tracking-wide">
            Final version
          </span>
          <CopyButton text={output.improvedDraft} />
        </div>
        <div className="text-foreground border-foreground/10 bg-background whitespace-pre-wrap rounded-lg border p-3 text-[14px] leading-relaxed">
          {output.improvedDraft}
        </div>
      </div>
    </div>
  );
}

/** Content-Studio-styled tool call rendering — separate from the chatbot's `tool-invocation.tsx`. */
export function StudioToolInvocationCard({
  part,
  onSelectAngle,
}: {
  part: StudioToolPart;
  onSelectAngle?: (text: string) => void;
}) {
  const label = labelForType(part.type);
  const toolName = toolNameForType(part.type);

  if (part.state === "output-error" || part.errorText) {
    return (
      <CardShell accent="error" title={label}>
        <p className="text-red-800 dark:text-red-200">{part.errorText ?? "Tool failed"}</p>
      </CardShell>
    );
  }

  const isPending =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    (Boolean(part.state) && part.state !== "output-available" && part.state !== "output-error");

  if (isPending) {
    return (
      <div className="border-cs-accent/25 bg-cs-accent/6 mb-3 flex gap-3 rounded-xl border px-3.5 py-3 text-sm">
        <Spinner />
        <div className="min-w-0">
          <div className="text-foreground font-medium">{label} running…</div>
          <div className="text-foreground/55 mt-0.5 text-xs">This may take a moment.</div>
        </div>
      </div>
    );
  }

  if (part.state === "output-available" && part.output) {
    const out = part.output as { error?: string };
    if (out.error) {
      return (
        <CardShell accent="error" title={label}>
          <p className="text-red-800 dark:text-red-200">{out.error}</p>
        </CardShell>
      );
    }

    switch (toolName) {
      case "discover_trends":
        return (
          <CardShell title={label}>
            <DiscoverTrendsResult output={part.output as DiscoverTrendsOutput} />
          </CardShell>
        );
      case "collect_research":
        return (
          <CardShell title={label}>
            <CollectResearchResult output={part.output as CollectResearchOutput} />
          </CardShell>
        );
      case "generate_angles":
        return (
          <CardShell accent="accent" title={label}>
            <GenerateAnglesResult
              output={part.output as GenerateAnglesOutput}
              onSelectAngle={onSelectAngle}
            />
          </CardShell>
        );
      case "write_content":
        return (
          <CardShell accent="accent" title={label}>
            <WriteContentResult output={part.output as WriteContentOutput} />
          </CardShell>
        );
      case "critique_draft":
        return (
          <CardShell accent="accent" title={label}>
            <CritiqueDraftResult output={part.output as CritiqueDraftOutput} />
          </CardShell>
        );
      default:
        return null;
    }
  }

  return (
    <div className="border-foreground/12 bg-foreground/3 text-foreground/75 mb-3 flex gap-2 rounded-xl border px-3.5 py-2.5 text-sm">
      <Spinner />
      <span>
        <span className="font-medium">{label}</span> — starting…
      </span>
    </div>
  );
}
