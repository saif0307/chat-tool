import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import path from "path";
import * as XLSX from "xlsx";
import {
  convertApiPlainTextToDocx,
  convertApiPlainTextToPdf,
  getConvertApiKey,
} from "@/lib/convertapi";
import { normalizeProseForExport } from "@/lib/export-normalize";

/** Strip control characters that break PDF/XML/DOCX binary pipelines or OOXML. */
function sanitizeDocumentText(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
}

function assertPdfMagic(buf: Buffer): void {
  if (buf.length < 8 || buf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("PDF output is not a valid PDF.");
  }
}

/** DOCX/XLSX are ZIP (`PK`). */
function assertZipMagic(buf: Buffer, label: string): void {
  if (buf.length < 4 || buf.readUInt16LE(0) !== 0x4b50) {
    throw new Error(`${label} output is not a valid Office/ZIP document.`);
  }
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Returns a rectangular grid when input looks like CSV/TSV (multiple columns). */
function tryParseDelimitedGrid(text: string): string[][] | null {
  const norm = text.replace(/\r\n/g, "\n").trim();
  if (!norm) return null;
  const lines = norm.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  for (const delim of [",", "\t"] as const) {
    const rows =
      delim === ","
        ? lines.map((line) => splitCsvRow(line))
        : lines.map((line) => line.split("\t").map((c) => c.trim()));
    const counts = rows.map((r) => r.length);
    const maxC = Math.max(...counts);
    if (maxC < 2) continue;
    const multi = counts.filter((c) => c >= 2).length;
    if (multi < Math.ceil(lines.length * 0.5)) continue;
    const width = maxC;
    return rows.map((r) => {
      const padded = [...r];
      while (padded.length < width) padded.push("");
      return padded.slice(0, width);
    });
  }
  return null;
}

function proseToSingleColumnRows(text: string): string[][] {
  const body = normalizeProseForExport(text);
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((b) => [b.replace(/\n/g, " ")]);
}

async function encodeXlsx(text: string): Promise<Buffer> {
  const sanitized = sanitizeDocumentText(text);
  const grid = tryParseDelimitedGrid(sanitized);
  const aoa = grid ?? proseToSingleColumnRows(sanitized);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }) as Buffer;
  assertZipMagic(out, "XLSX");
  return out;
}

/** Encode user-supplied text into bytes based on the output filename extension. */
export async function encodeWorkspaceContent(
  filename: string,
  content: string,
): Promise<Buffer> {
  const ext = path.extname(filename).toLowerCase();
  const sanitized = sanitizeDocumentText(content);

  switch (ext) {
    case ".pdf":
      if (getConvertApiKey()) {
        const buf = await convertApiPlainTextToPdf(sanitized);
        assertPdfMagic(buf);
        return buf;
      }
      return encodePdfPdfLib(sanitized);
    case ".docx":
      if (getConvertApiKey()) {
        const buf = await convertApiPlainTextToDocx(sanitized);
        assertZipMagic(buf, "DOCX");
        return buf;
      }
      return encodeDocxLocal(sanitized);
    case ".xlsx":
      return encodeXlsx(sanitized);
    case ".xml":
    default:
      return Buffer.from(content, "utf8");
  }
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
/** Match readable HTML→PDF exports (~16pt body / ~30pt title there). */
const FONT_SIZE = 15;
const TITLE_FONT_SIZE = 24;
const LINE_HEIGHT = FONT_SIZE * 1.45;
const PARA_GAP = LINE_HEIGHT * 0.35;

function wrapParagraphLines(
  paragraph: string,
  measure: (s: string) => number,
  maxWidth: number,
): string[] {
  if (paragraph === "") return [""];

  const lines: string[] = [];
  const words = paragraph.split(/\s+/).filter(Boolean);

  let current = "";
  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (measure(trial) <= maxWidth) {
      current = trial;
      continue;
    }
    flush();
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    let rest = word;
    while (rest.length > 0) {
      let lo = 1;
      let hi = rest.length;
      let fit = 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const pref = rest.slice(0, mid);
        if (measure(pref) <= maxWidth) {
          fit = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (fit < 1) fit = 1;
      lines.push(rest.slice(0, fit));
      rest = rest.slice(fit);
    }
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

function titleHeuristicFirstBlock(block: string): boolean {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length !== 1) return false;
  const line = lines[0]!;
  const wc = line.split(/\s+/).filter(Boolean).length;
  return line.length <= 120 && wc <= 14 && !line.endsWith(".");
}

/** Fallback when CONVERTAPI_KEY is not set — pure JS via pdf-lib. */
async function encodePdfPdfLib(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const measureReg = (s: string) => fontRegular.widthOfTextAtSize(s, FONT_SIZE);
  const measureBold = (s: string) =>
    fontBold.widthOfTextAtSize(s, TITLE_FONT_SIZE);
  const contentWidth = PAGE_W - 2 * MARGIN;

  const normalized = normalizeProseForExport(text);
  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]!;
    const asTitle = bi === 0 && titleHeuristicFirstBlock(block);
    const para = block.replace(/\n/g, " ").trim();

    if (asTitle) {
      const tw = measureBold(para);
      if (y < MARGIN + TITLE_FONT_SIZE + PARA_GAP) newPage();
      page.drawText(para, {
        x: (PAGE_W - tw) / 2,
        y: y - TITLE_FONT_SIZE,
        size: TITLE_FONT_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      y -= TITLE_FONT_SIZE + PARA_GAP * 1.2;
      continue;
    }

    const rows = wrapParagraphLines(para, measureReg, contentWidth);
    for (const row of rows) {
      if (y < MARGIN + LINE_HEIGHT) newPage();
      page.drawText(row.length ? row : " ", {
        x: MARGIN,
        y: y - FONT_SIZE,
        size: FONT_SIZE,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT;
    }
    if (bi < blocks.length - 1) y -= PARA_GAP;
  }

  const bytes = await pdfDoc.save();
  const buf = Buffer.from(bytes);
  assertPdfMagic(buf);
  return buf;
}

async function encodeDocxLocal(text: string): Promise<Buffer> {
  const body = normalizeProseForExport(text);
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const children: Paragraph[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const single = lines.length === 1 ? lines[0]! : null;
    const wc = single ? single.split(/\s+/).filter(Boolean).length : 999;
    const isLikelyTitle =
      i === 0 &&
      single &&
      single.length <= 120 &&
      wc <= 14 &&
      !single.endsWith(".");

    if (isLikelyTitle) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: single, bold: true })],
        }),
      );
      continue;
    }

    const merged = lines.join(" ");
    children.push(
      new Paragraph({
        children: [new TextRun(merged)],
      }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const out = await Packer.toBuffer(doc);
  const buf = Buffer.from(out);
  assertZipMagic(buf, "DOCX");
  return buf;
}
