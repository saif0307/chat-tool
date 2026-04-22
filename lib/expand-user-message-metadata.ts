import type { UIMessage } from "ai";
import type { InlinedAttachmentPayload } from "@/lib/prepare-attachments";

/** Stored on user messages; expanded on the server for the model. The chat UI renders cards from this via `UserInlinedAttachments`. */
export type UserMessageMetadata = {
  inlinedForModel?: InlinedAttachmentPayload[];
};

/** Appends inlined document text for the model while keeping the chat UI to short labels only. */
export function expandInlinedMetadataForModel(messages: UIMessage[]): UIMessage[] {
  const out = structuredClone(messages) as UIMessage[];
  for (const m of out) {
    if (m.role !== "user") continue;
    const items = (m.metadata as UserMessageMetadata | undefined)?.inlinedForModel;
    if (!items?.length) continue;
    const extra = items
      .map(
        ({ filename, content }) =>
          `\n\n<<BEGIN ${filename}>>\n${content}\n<<END ${filename}>>`,
      )
      .join("");
    m.parts.push({ type: "text", text: extra });
  }
  return out;
}
