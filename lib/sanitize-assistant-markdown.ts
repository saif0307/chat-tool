/**
 * Strip internal app paths and storage-ish phrases from assistant text before render.
 * Models often ignore prompt rules; this keeps user-facing copy clean.
 */
export function sanitizeAssistantMarkdown(content: string): string {
  let s = content;

  // Raw or backtick-wrapped internal download routes
  s = s.replace(/`?\/?api\/workspace\/[^`\s)\]]+`?/gi, "");
  // Any loose /api/workspace/... segments
  s = s.replace(/\/?api\/workspace\/[^\s)\]"']+/gi, "");

  // "N bytes written" style echoes from tool metadata
  s = s.replace(/\b\d[\d,]*\s*bytes?\s*written\b\.?/gi, "");
  s = s.replace(/,\s*(\d[\d,]*)\s*bytes?\s*written\b/gi, "");

  // Collapse awkward gaps left by removals
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
