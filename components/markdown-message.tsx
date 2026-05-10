"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { sanitizeAssistantMarkdown } from "@/lib/sanitize-assistant-markdown";
import { MarkdownCodeBlock } from "@/components/markdown-code-block";
import { PreviewableImage } from "@/components/image-lightbox";

/** Stable plugin tuples — new arrays each render force react-markdown to redo expensive work. */
const remarkPlugins = [remarkGfm, remarkBreaks];
/** Full pipeline once streaming ends (syntax highlighting is the heavy part). */
const rehypePluginsFull = [rehypeHighlight];
/** While tokens stream: parse Markdown for headings/lists/bold; skip highlight pass. */
const rehypePluginsStreaming: typeof rehypePluginsFull = [];

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="markdown-chat-ul mb-3 space-y-2 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="markdown-chat-ol mb-3 space-y-2 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-foreground pl-0 [&>p]:mb-0">{children}</li>
  ),
  h1: ({ children }) => (
    <h1 className="text-foreground mb-3 mt-5 text-2xl font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-foreground mb-3 mt-6 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mb-2 mt-5 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  strong: ({ children }) => (
    <strong className="text-foreground font-semibold">{children}</strong>
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
  pre: ({ children }) => <MarkdownCodeBlock>{children}</MarkdownCodeBlock>,
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
   * While tokens stream in, fenced-code syntax highlighting is skipped (cheap Markdown still runs).
   */
  streaming?: boolean;
};

function MarkdownMessageInner({ content, streaming = false }: Props) {
  const safeContent = useMemo(() => sanitizeAssistantMarkdown(content), [content]);

  return (
    <div className="markdown-body wrap-break-word wrap-anywhere text-foreground min-w-0 max-w-full text-[15px] leading-relaxed contain-content">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={streaming ? rehypePluginsStreaming : rehypePluginsFull}
        components={markdownComponents}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageInner);
