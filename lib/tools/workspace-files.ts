import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { writeWorkspaceFile } from "@/lib/workspace-persistence";

const writeWorkspaceFileTool = tool({
  description:
    "Create a user-requested downloadable file only when they clearly asked for an export/file or confirmed after you offered one—not for normal chat answers. Extensions: .md/.txt UTF-8; .xml UTF-8; .pdf and .docx from readable plain text (paragraphs separated by blank lines; optional short title on its own block); .xlsx builds a sheet from CSV/TSV-style rows or from prose as one column of paragraphs. Use .docx for Word. After success, never paste URLs or paths to the user.",
  inputSchema: z.object({
    relativePath: z
      .string()
      .describe(
        'Relative path with extension, e.g. "deliverables/spec.xml", "report.pdf", "notes.docx". Forward slashes; letters, numbers, spaces, dot, underscore, hyphen.',
      ),
    content: z
      .string()
      .describe(
        "Source text: for PDF/DOCX this is plain text (line breaks preserved); for XML/md/txt the full file body.",
      ),
  }),
  execute: async ({ relativePath, content }) => {
    try {
      return await writeWorkspaceFile(relativePath, content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Write failed.";
      return { error: msg };
    }
  },
});

export function getWorkspaceFileTools(): ToolSet {
  return { write_workspace_file: writeWorkspaceFileTool };
}
