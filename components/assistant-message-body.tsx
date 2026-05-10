"use client";

import { MarkdownMessage } from "@/components/markdown-message";
import { DraftArtifactCard } from "@/components/draft-artifact-card";
import { splitDraftArtifact } from "@/lib/draft-artifact-parse";

type Props = {
  text: string;
  /** True while this assistant message is still streaming. */
  isStreaming: boolean;
};

export function AssistantMessageBody({ text, isStreaming }: Props) {
  const { intro, draft } = splitDraftArtifact(text);

  const showIntro = intro.trim().length > 0;
  const showDraft =
    draft !== null && (draft.body.length > 0 || isStreaming || !draft.closed);

  return (
    <div className="flex flex-col gap-1">
      {showIntro ? (
        <MarkdownMessage content={intro} />
      ) : null}
      {showDraft && draft ? (
        <DraftArtifactCard
          body={draft.body}
          format={draft.format}
          streaming={isStreaming && !draft.closed}
        />
      ) : null}
    </div>
  );
}
