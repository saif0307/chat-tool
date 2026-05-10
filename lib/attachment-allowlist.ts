/** Attachments restricted to images, common text formats, PDF, and spreadsheets. */

const ALLOWED_TEXT_AND_DATA_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/sql",
  "application/x-sql",
  "application/x-yaml",
  "application/yaml",
  "text/yaml",
  "text/x-yaml",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** When `File.type` is empty, infer from extension (clipboard / OS quirks). */
const ALLOWED_EXTENSIONS = new Set([
  // images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
  "heic",
  "avif",
  // text / code-ish
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "yml",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  "sql",
  "log",
  "rst",
  "tex",
  "tsx",
  "jsx",
  "vue",
  "sh",
  "bash",
  "zsh",
  "env",
  "toml",
  "ini",
  "cfg",
  "conf",
  // pdf + spreadsheets
  "pdf",
  "xls",
  "xlsx",
  "xlsm",
  "ods",
  // common plain-text / source (not exhaustive)
  "py",
  "pyw",
  "pyi",
  "rb",
  "gemspec",
  "go",
  "rs",
  "java",
  "c",
  "cc",
  "cxx",
  "cpp",
  "h",
  "hh",
  "hpp",
  "cs",
  "fs",
  "fsx",
  "vb",
  "php",
  "phtml",
  "kt",
  "kts",
  "swift",
  "r",
  "pl",
  "pm",
  "scala",
  "sc",
  "sbt",
  "clj",
  "cljs",
  "edn",
  "hs",
  "lhs",
  "ml",
  "mli",
  "erl",
  "hrl",
  "ex",
  "exs",
  "nim",
  "dart",
  "lua",
  "ps1",
  "psc",
  "gradle",
  "properties",
  "proto",
  "graphql",
  "gql",
  "prisma",
  "mdx",
  "bib",
  "adoc",
  "asciidoc",
]);

/** Lowercase basename only — extensionless project files that are text. */
const ALLOWED_BASE_NAMES = new Set([
  "dockerfile",
  "makefile",
  "gemfile",
  "rakefile",
  "rakefile.rb",
  "procfile",
  "jenkinsfile",
  "snakefile",
  "containerfile",
]);

export function extensionFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function isAllowedAttachment(file: File): boolean {
  const rawType = file.type.trim().toLowerCase();
  if (rawType.startsWith("image/")) return true;
  if (rawType && ALLOWED_TEXT_AND_DATA_TYPES.has(rawType)) return true;

  const base =
    file.name.split(/[/\\]/).pop()?.toLowerCase().trim() ?? "";
  if (base && ALLOWED_BASE_NAMES.has(base)) return true;

  const ext = extensionFromFilename(file.name);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;

  return false;
}

/** For `<input type="file" accept="…">` — hints only; always validate with `isAllowedAttachment`. */
export const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.txt,.md,.markdown,.json,.csv,.tsv,.xml,.yaml,.yml,.html,.htm,.css,.sql,.log,.xlsx,.xls,.xlsm,.ods,.py,.go,.rs,.java,.c,.cpp,.h,.cs,.php,.kt,.swift,.rb,.scala,.dart,.graphql,.proto";
