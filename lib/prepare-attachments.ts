import { extensionFromFilename } from "@/lib/attachment-allowlist";

/**
 * OpenAI Chat / Responses only accept file parts as images, audio, or PDF.
 * Anthropic accepts images, PDF, and text/plain documents — not HTML/JSON/etc. as native file parts.
 *
 * Document-like files are read as UTF-8 and passed in `metadata.inlinedForModel` for the API route
 * (short `displayText` in the visible message only).
 */

export type InlinedAttachmentPayload = { filename: string; content: string };

function passesAsBinaryFileAttachment(file: File): boolean {
  const t = file.type.trim().toLowerCase();
  if (t.startsWith("image/")) return true;
  if (t === "application/pdf") return true;
  if (!t || t === "application/octet-stream") {
    const ext = extensionFromFilename(file.name);
    if (
      ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "avif", "ico"].includes(ext)
    ) {
      return true;
    }
    if (ext === "pdf") return true;
  }
  return false;
}

function isBinarySpreadsheetWorkbook(file: File): boolean {
  const t = file.type.trim().toLowerCase();
  if (
    t === "application/vnd.ms-excel" ||
    t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    t === "application/vnd.ms-excel.sheet.macroenabled.12" ||
    t === "application/vnd.ms-excel.sheet.binary.macroenabled.12" ||
    t === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return true;
  }
  const ext = extensionFromFilename(file.name);
  return ["xlsx", "xls", "xlsm", "ods"].includes(ext);
}

export async function prepareAttachmentsForModel(
  files: File[],
  userLine: string,
): Promise<{
  displayText: string;
  inlinedForModel: InlinedAttachmentPayload[];
  files: File[];
  error?: string;
}> {
  const binaryOut: File[] = [];
  const inlinedForModel: InlinedAttachmentPayload[] = [];

  for (const file of files) {
    if (isBinarySpreadsheetWorkbook(file)) {
      return {
        displayText: userLine,
        inlinedForModel: [],
        files: [],
        error: `"${file.name}" is a binary spreadsheet. Model APIs here don’t accept .xlsx/.xls directly — export the sheet as CSV (or PDF) and attach that instead.`,
      };
    }

    if (passesAsBinaryFileAttachment(file)) {
      binaryOut.push(file);
      continue;
    }

    try {
      const content = await file.text();
      const filename = file.name.trim() || "attachment";
      inlinedForModel.push({ filename, content });
    } catch {
      return {
        displayText: userLine,
        inlinedForModel: [],
        files: [],
        error: `Could not read "${file.name}" as text.`,
      };
    }
  }

  const userTrim = userLine.trim();

  /** Visible message text only — filenames are shown via `metadata.inlinedForModel` + file cards in the UI. */
  let displayText: string;
  if (userTrim) {
    displayText = userTrim;
  } else if (inlinedForModel.length > 0 || binaryOut.length > 0) {
    displayText = "";
  } else {
    displayText = "(attached files)";
  }

  return { displayText, inlinedForModel, files: binaryOut };
}
