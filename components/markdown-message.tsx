"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { sanitizeAssistantMarkdown } from "@/lib/sanitize-assistant-markdown";
import { PreviewableImage } from "@/components/image-lightbox";

/** Stable plugin tuples — new arrays each render force react-markdown to redo expensive work. */
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="[&>p]:mb-0">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 text-xl font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-sky-600 underline decoration-sky-600/40 underline-offset-2 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-foreground/20 text-foreground/80 my-3 border-l-4 pl-4 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-foreground/15 my-6" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-foreground/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border-foreground/15 border px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-foreground/15 border px-3 py-2 align-top">{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="border-foreground/10 bg-zinc-950 my-3 overflow-x-auto rounded-xl border p-4 text-[13px] leading-normal text-zinc-100 dark:border-zinc-700/35 dark:bg-zinc-900/95">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} font-mono text-[13px]`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-foreground/8 rounded px-1.5 py-0.5 font-mono text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  img: ({ src, alt, ...props }) => {
    if (!src || typeof src !== "string") return null;
    return (
      <span className="my-3 block">
        <PreviewableImage
          src={src}
          alt={typeof alt === "string" ? alt : ""}
          className="max-h-[min(70vh,32rem)] max-w-full rounded-lg object-contain"
          {...props}
        />
      </span>
    );
  },
};

type Props = {
  content: string;
  /**
   * While tokens stream in, skip markdown + syntax highlighting (very expensive per update).
   * Full markdown runs once when this becomes false.
   */
  streaming?: boolean;
};

function MarkdownMessageInner({ content, streaming = false }: Props) {
  const safeContent = useMemo(() => sanitizeAssistantMarkdown(content), [content]);

  if (streaming) {
    return (
      <div className="markdown-body wrap-break-word wrap-anywhere text-foreground min-w-0 max-w-full text-[15px] leading-relaxed whitespace-pre-wrap [contain:content]">
        {safeContent}
      </div>
    );
  }

  return (
    <div className="markdown-body wrap-break-word wrap-anywhere min-w-0 max-w-full text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageInner);
