import type { UIMessage } from "ai";
import { Sparkles } from "lucide-react";
import { StudioMarkdown } from "@/components/studio/workspace/studio-markdown";
import {
  StudioToolInvocationCard,
  type StudioToolPart,
} from "@/components/studio/workspace/studio-tool-invocation";

function isToolPart(type: string): boolean {
  return type === "dynamic-tool" || type.startsWith("tool-");
}

export function StudioMessage({
  message,
  onSelectAngle,
}: {
  message: UIMessage;
  onSelectAngle?: (text: string) => void;
}) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    return (
      <div className="flex justify-end">
        <div className="bg-foreground text-background max-w-[min(85%,42rem)] whitespace-pre-wrap rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="bg-cs-accent/15 text-cs-accent mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text?.trim()) {
            return <StudioMarkdown key={i} text={part.text} />;
          }
          if (isToolPart(part.type)) {
            return (
              <StudioToolInvocationCard
                key={i}
                part={part as unknown as StudioToolPart}
                onSelectAngle={onSelectAngle}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
