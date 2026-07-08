"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Content Studio's own minimal markdown renderer — not shared with the chatbot's `markdown-message.tsx`. */
export function StudioMarkdown({ text }: { text: string }) {
  return (
    <div
      className="text-foreground text-[15px] leading-relaxed
        [&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0
        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:my-0.5
        [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold first:[&_h1]:mt-0
        [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold first:[&_h2]:mt-0
        [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold first:[&_h3]:mt-0
        [&_strong]:font-semibold
        [&_code]:bg-foreground/8 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]
        [&_a]:underline [&_a]:underline-offset-2
        [&_blockquote]:border-foreground/15 [&_blockquote]:text-foreground/70 [&_blockquote]:border-l-2 [&_blockquote]:pl-3"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
