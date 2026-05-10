"use client";

import {
  isValidElement,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Tooltip } from "@/components/tooltip";

function textFromChildren(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number")
    return String(node);
  if (Array.isArray(node)) return node.map(textFromChildren).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props.children != null) return textFromChildren(props.children);
  }
  return "";
}

function languageFromChildren(children: ReactNode): string | undefined {
  if (Array.isArray(children)) {
    for (const c of children) {
      const lang = languageFromChildren(c);
      if (lang) return lang;
    }
    return undefined;
  }
  if (!isValidElement(children)) return undefined;
  const className = (children.props as { className?: string }).className;
  if (typeof className !== "string") return undefined;
  const m = className.match(/language-([\w#+-]+)/);
  return m?.[1];
}

/** Map ``` fence language id to a readable full name (lowercase). */
function displayLanguageName(id: string): string {
  const k = id.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    javascript: "javascript",
    jsx: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    tsx: "typescript",
    typescript: "typescript",
    py: "python",
    python: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    c: "c",
    h: "c",
    cpp: "c++",
    cxx: "c++",
    cc: "c++",
    hpp: "c++",
    cs: "c#",
    fs: "f#",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    java: "java",
    scala: "scala",
    sh: "shell",
    bash: "bash",
    zsh: "zsh",
    ps1: "powershell",
    json: "json",
    jsonc: "jsonc",
    html: "html",
    htm: "html",
    xml: "xml",
    svg: "svg",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    mdx: "mdx",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    sql: "sql",
    graphql: "graphql",
    dockerfile: "dockerfile",
    vue: "vue",
    svelte: "svelte",
    r: "r",
    diff: "diff",
    patch: "patch",
    txt: "plain text",
    text: "plain text",
    plain: "plain text",
    env: "env",
    ini: "ini",
    http: "http",
    wasm: "webassembly",
  };
  return map[k] ?? k.replace(/-/g, " ");
}

const COPY_BTN =
  "text-foreground/50 hover:bg-foreground/10 hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors";

type Props = {
  children: ReactNode;
};

export function MarkdownCodeBlock({ children }: Props) {
  const [copied, setCopied] = useState(false);
  const plain = useMemo(() => textFromChildren(children), [children]);
  const lang = useMemo(() => languageFromChildren(children), [children]);
  const langLabel = useMemo(
    () => (lang ? displayLanguageName(lang) : undefined),
    [lang],
  );

  const copy = useCallback(async () => {
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [plain]);

  return (
    <div className="group my-3 overflow-hidden rounded-xl border border-foreground/10">
      <div className="border-foreground/10 flex min-h-10 items-center justify-between gap-2 border-b bg-zinc-900/90 px-3 py-2 dark:bg-zinc-900/95">
        <span className="text-foreground/60 min-w-0 truncate font-mono text-xs lowercase">
          {langLabel ?? "\u00a0"}
        </span>
        <Tooltip content={copied ? "Copied" : "Copy code"}>
          <button
            type="button"
            onClick={() => void copy()}
            className={COPY_BTN}
            aria-label={copied ? "Copied" : "Copy code"}
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
          </button>
        </Tooltip>
      </div>
      <pre className="bg-zinc-950 m-0 overflow-x-auto p-4 text-[13px] leading-normal text-zinc-100 dark:bg-zinc-900/95">
        {children}
      </pre>
    </div>
  );
}
