import { get, put } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import {
  getWorkspaceRoot,
  parseSafeRelativePath,
  resolveWorkspaceAbsolute,
  WORKSPACE_FILE_MAX_BYTES,
} from "@/lib/workspace-files";
import { encodeWorkspaceContent } from "@/lib/workspace-encode";

/** Prefix inside the Blob store (path segments, no leading/trailing slash). */
const BLOB_PATH_PREFIX = "nexa-workspace";

export function isWorkspaceBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}

function contentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".md" || ext === ".markdown")
    return "text/markdown; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".html" || ext === ".htm") return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}

/** Blob pathname used by `put` / `get` (validated relative path under prefix). */
export function workspaceRelativeToBlobPathname(relJoined: string): string {
  const segments = parseSafeRelativePath(relJoined);
  return `${BLOB_PATH_PREFIX}/${segments.join("/")}`;
}

export type WriteWorkspaceResult = {
  relativePath: string;
  bytesWritten: number;
  downloadUrlPath: string;
};

/**
 * Saves workspace content: Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set (serverless-safe),
 * otherwise local disk under `generated/` (development).
 */
export async function writeWorkspaceFile(
  relativePath: string,
  content: string,
): Promise<WriteWorkspaceResult> {
  const segments = parseSafeRelativePath(relativePath);
  const relOut = segments.join("/");
  const name = segments[segments.length - 1] ?? "file";

  let buf: Buffer;
  try {
    buf = await encodeWorkspaceContent(name, content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encoding failed.";
    throw new Error(msg);
  }

  if (buf.length > WORKSPACE_FILE_MAX_BYTES) {
    throw new Error(
      `Encoded file exceeds maximum size (${WORKSPACE_FILE_MAX_BYTES} bytes).`,
    );
  }

  if (isWorkspaceBlobStorage()) {
    const pathname = workspaceRelativeToBlobPathname(relOut);
    await put(pathname, buf, {
      access: "private",
      allowOverwrite: true,
      contentType: contentTypeFromFilename(name),
    });
    const urlPath = segments.map((s) => encodeURIComponent(s)).join("/");
    return {
      relativePath: relOut,
      bytesWritten: buf.length,
      downloadUrlPath: `/api/workspace/${urlPath}`,
    };
  }

  if (isVercelDeployment()) {
    throw new Error(
      "Workspace files on Vercel require BLOB_READ_WRITE_TOKEN (create a Blob store and add the token to the project).",
    );
  }

  const abs = resolveWorkspaceAbsolute(relOut);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
  const root = getWorkspaceRoot();
  const displayRel = path.relative(root, abs).replace(/\\/g, "/");
  const urlPath = displayRel
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return {
    relativePath: displayRel,
    bytesWritten: buf.length,
    downloadUrlPath: `/api/workspace/${urlPath}`,
  };
}

export type ReadWorkspaceOk = {
  body: Buffer;
  contentType: string;
  filename: string;
};

export async function readWorkspaceFile(
  relativeJoined: string,
): Promise<ReadWorkspaceOk | null> {
  let segments: string[];
  try {
    segments = parseSafeRelativePath(relativeJoined);
  } catch {
    return null;
  }
  const relOut = segments.join("/");
  const filename = segments[segments.length - 1] ?? "file";
  /** Prefer extension-based MIME so PDF/DOCX are never mislabeled by Blob metadata. */
  const mime = contentTypeFromFilename(filename);

  if (isWorkspaceBlobStorage()) {
    const pathname = workspaceRelativeToBlobPathname(relOut);
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }
    const ab = await new Response(result.stream).arrayBuffer();
    const body = Buffer.from(ab);
    return {
      body,
      contentType: mime,
      filename,
    };
  }

  if (isVercelDeployment()) {
    return null;
  }

  try {
    const abs = resolveWorkspaceAbsolute(relOut);
    const body = await fs.readFile(abs);
    return {
      body,
      contentType: mime,
      filename,
    };
  } catch {
    return null;
  }
}
