/**
 * Normalize plain-text exports: collapse runaway newlines (common from LLM output)
 * so PDF/DOCX don't render huge vertical gaps.
 */
export function normalizeProseForExport(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const trimmedLines = lines.map((l) => l.trimEnd());
  let joined = trimmedLines.join("\n");
  joined = joined.replace(/\n{3,}/g, "\n\n");
  return joined.trim();
}
