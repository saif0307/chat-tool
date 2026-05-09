/**
 * ConvertAPI v2 — JSON + base64 input (reliable in Node vs multipart quirks).
 * @see https://docs.convertapi.com/docs/conversion-using-json
 * @see https://docs.convertapi.com/docs/authentication
 *
 * Env: CONVERTAPI_KEY — API token for `Authorization: Bearer …`
 */

import { normalizeProseForExport } from "@/lib/export-normalize";

const DEFAULT_BASE = "https://v2.convertapi.com";

type ConvertApiSuccessJson = {
  ConversionCost?: number;
  Files?: Array<{
    FileName?: string;
    FileExt?: string;
    FileSize?: number;
    FileData?: string;
    Url?: string;
  }>;
};

type ConvertApiErrorJson = {
  Code?: number;
  Message?: string;
};

/** Prefer CONVERTAPI_KEY; CONVERTAPI_TOKEN is an alias. Value must be an API token from the dashboard (Bearer), not the JWT signing secret alone. */
export function getConvertApiKey(): string | undefined {
  const k =
    process.env.CONVERTAPI_KEY?.trim() ||
    process.env.CONVERTAPI_TOKEN?.trim();
  return k || undefined;
}

function convertApiBase(): string {
  const raw = process.env.CONVERTAPI_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_BASE;
}

function decodeBase64FileData(b64: string): Buffer {
  const cleaned = b64.replace(/\s/g, "");
  return Buffer.from(cleaned, "base64");
}

async function bufferFromSuccessJson(json: ConvertApiSuccessJson): Promise<Buffer> {
  const file = json.Files?.[0];
  if (!file) {
    throw new Error("ConvertAPI returned no Files.");
  }

  if (file.FileData && file.FileData.length > 0) {
    return decodeBase64FileData(file.FileData);
  }

  if (file.Url) {
    const r = await fetch(file.Url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) {
      throw new Error(`ConvertAPI file URL fetch failed (${r.status}).`);
    }
    return Buffer.from(await r.arrayBuffer());
  }

  throw new Error("ConvertAPI returned no FileData or Url.");
}

/** ConvertAPI accepts File entries plus optional scalar parameters in one array. */
export type JsonParam =
  | { Name: string; FileValue: { Name: string; Data: string } }
  | { Name: string; Value: string | number | boolean };

async function postJsonConversion(path: string, parameters: JsonParam[]): Promise<Buffer> {
  const secret = getConvertApiKey();
  if (!secret) {
    throw new Error("CONVERTAPI_KEY is not set.");
  }

  const url = `${convertApiBase()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ Parameters: parameters }),
    signal: AbortSignal.timeout(120_000),
  });

  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let detail = res.statusText;
    if (ct.includes("application/json")) {
      try {
        const err = (await res.json()) as ConvertApiErrorJson;
        if (err.Message) detail = `${err.Code ?? res.status}: ${err.Message}`;
      } catch {
        /* ignore */
      }
    }
    throw new Error(`ConvertAPI error (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as ConvertApiSuccessJson;
  return bufferFromSuccessJson(json);
}

/** Serif body text, Letter paper, readable margins (mm). */
function txtToPdfParameters(base64Txt: string): JsonParam[] {
  return [
    {
      Name: "File",
      FileValue: {
        Name: "input.txt",
        Data: base64Txt,
      },
    },
    { Name: "FontName", Value: "TimesNewRoman" },
    { Name: "FontSize", Value: 12 },
    { Name: "PageSize", Value: "letter" },
    { Name: "PageOrientation", Value: "portrait" },
    { Name: "MarginTop", Value: 22 },
    { Name: "MarginBottom", Value: 22 },
    { Name: "MarginLeft", Value: 24 },
    { Name: "MarginRight", Value: 24 },
  ];
}

/** Plain text → PDF via HTML (Chromium): serif fonts, headings — avoids TXT→PDF monospace/Courier output. */
export async function convertApiPlainTextToPdf(text: string): Promise<Buffer> {
  const html = plainTextToStructuredHtml(text);
  const data = Buffer.from(html, "utf8").toString("base64");
  return postJsonConversion("/convert/html/to/pdf", htmlToPdfParameters(data));
}

/** @deprecated TXT converter often renders monospace; prefer convertApiPlainTextToPdf. */
export async function convertApiTxtToPdf(text: string): Promise<Buffer> {
  const normalized = normalizeProseForExport(text);
  const data = Buffer.from(normalized, "utf8").toString("base64");
  return postJsonConversion("/convert/txt/to/pdf", txtToPdfParameters(data));
}

function htmlToPdfParameters(base64Html: string): JsonParam[] {
  return [
    {
      Name: "File",
      FileValue: {
        Name: "document.html",
        Data: base64Html,
      },
    },
    { Name: "PageSize", Value: "letter" },
    { Name: "PageOrientation", Value: "portrait" },
    { Name: "MarginTop", Value: 20 },
    { Name: "MarginBottom", Value: 20 },
    { Name: "MarginLeft", Value: 22 },
    { Name: "MarginRight", Value: 22 },
    /** Percentage — boosts readability at 100% zoom when Chrome PDF uses a wide viewport. */
    { Name: "Scale", Value: 118 },
    { Name: "ConversionDelay", Value: 0 },
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML for html→docx: semantic blocks, Georgia serif, justified body (when preserved by converter).
 */
export function plainTextToStructuredHtml(text: string): string {
  const body = normalizeProseForExport(text);
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const parts: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const lines = block.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    const single = lines.length === 1 ? lines[0]! : null;
    const wordCount = single ? single.split(/\s+/).filter(Boolean).length : 999;
    /** First block: short opening line or title (including single-sentence story openers). */
    const isLikelyTitle =
      i === 0 &&
      single &&
      single.length <= 160 &&
      wordCount <= 22;

    if (isLikelyTitle) {
      parts.push(
        `<h1 style="text-align:center;font-family:'Times New Roman',Times,Georgia,serif;font-size:30pt;font-weight:700;margin:0 0 22pt 0;line-height:1.2;">${escapeHtml(single)}</h1>`,
      );
      continue;
    }

    const inner = lines.map((l) => escapeHtml(l)).join("<br/>");
    parts.push(
      `<p style="font-family:'Times New Roman',Times,Georgia,serif;font-size:16pt;line-height:1.65;margin:0 0 13pt 0;text-align:justify;color:#111;">${inner}</p>`,
    );
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Document</title><style>
    html{font-size:16pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    body{font-family:'Times New Roman',Times,Georgia,serif;font-size:16pt;line-height:1.65;margin:0 auto;padding:0;color:#111;background:#fff;max-width:36rem;}
  </style></head><body>${parts.join("")}</body></html>`;
}

/** Plain text → DOCX via HTML converter. */
export async function convertApiPlainTextToDocx(text: string): Promise<Buffer> {
  const html = plainTextToStructuredHtml(text);
  const data = Buffer.from(html, "utf8").toString("base64");
  return postJsonConversion("/convert/html/to/docx", [
    {
      Name: "File",
      FileValue: {
        Name: "input.html",
        Data: data,
      },
    },
  ]);
}
