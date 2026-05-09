import path from "path";

/** Default cap for a single write (bytes). */
export const WORKSPACE_FILE_MAX_BYTES = 512 * 1024;

export function getWorkspaceRoot(): string {
  const raw = process.env.WORKSPACE_FILES_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.resolve(process.cwd(), "generated");
}

/**
 * Validates a relative workspace path and returns POSIX-style segments.
 * Rejects traversal and unsafe characters.
 */
export function parseSafeRelativePath(input: string): string[] {
  const normalized = input.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/")) {
    throw new Error("Path must be relative with no leading slash.");
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) throw new Error("Empty path.");
  if (segments.length > 12) throw new Error("Path has too many segments.");
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      throw new Error("Invalid path segment.");
    }
    if (!/^[\w.\- ]+$/.test(seg) || seg.length > 180) {
      throw new Error(`Invalid or too-long segment: ${seg.slice(0, 40)}`);
    }
  }
  return segments;
}

/** Resolves a safe relative path to an absolute path inside the workspace root. */
export function resolveWorkspaceAbsolute(rel: string): string {
  const segments = parseSafeRelativePath(rel);
  const root = path.resolve(getWorkspaceRoot());
  const target = path.resolve(root, ...segments);
  const relFromRoot = path.relative(root, target);
  if (
    relFromRoot.startsWith("..") ||
    path.isAbsolute(relFromRoot) ||
    relFromRoot === ""
  ) {
    throw new Error("Path escapes workspace.");
  }
  return target;
}
