import type { UIMessage } from "ai";

export function messageToPlainText(message: UIMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && part.text) chunks.push(part.text);
    if (part.type === "reasoning" && part.text) chunks.push(`[Reasoning]\n${part.text}`);
  }
  return chunks.join("\n\n").trim();
}
