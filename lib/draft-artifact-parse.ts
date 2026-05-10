export type DraftArtifactFormat = "email" | "markdown" | "plain";

export type SplitDraftArtifactResult = {
  intro: string;
  draft: {
    body: string;
    format: DraftArtifactFormat;
    closed: boolean;
  } | null;
};

function normalizeFormat(token: string | undefined): DraftArtifactFormat {
  if (!token) return "plain";
  const t = token.toLowerCase();
  if (t === "email") return "email";
  if (t === "markdown" || t === "md") return "markdown";
  if (t === "plain") return "plain";
  return "plain";
}

/**
 * Splits assistant text into chat intro + optional fenced draft for the artifact viewer.
 * Markers: [[[BEGIN DRAFT]]] or [[[BEGIN DRAFT email]]] … [[[END DRAFT]]]
 */
export function splitDraftArtifact(raw: string): SplitDraftArtifactResult {
  const HEADER =
    /\[\[\[BEGIN DRAFT(?:\s+(email|markdown|md|plain))?\s*\]\]\]/;
  const FOOTER = /\[\[\[END DRAFT\]\]\]/;

  const match = HEADER.exec(raw);
  if (!match) {
    return { intro: raw, draft: null };
  }

  const intro = raw.slice(0, match.index).trimEnd();
  const format = normalizeFormat(match[1]);
  const afterHeader = raw.slice(match.index + match[0].length);

  const endExec = FOOTER.exec(afterHeader);
  if (endExec) {
    const body = afterHeader.slice(0, endExec.index).trim();
    return {
      intro,
      draft: { body, format, closed: true },
    };
  }

  return {
    intro,
    draft: {
      body: afterHeader.trimEnd(),
      format,
      closed: false,
    },
  };
}
