export type ComposerPastedSnippet = { id: string; text: string };

export type ComposerDraft = {
  input: string;
  attachments: File[];
  pastedSnippets: ComposerPastedSnippet[];
};

export function emptyComposerDraft(): ComposerDraft {
  return { input: "", attachments: [], pastedSnippets: [] };
}

export function composerDraftHasContent(draft: ComposerDraft): boolean {
  return (
    Boolean(draft.input.trim()) ||
    draft.attachments.length > 0 ||
    draft.pastedSnippets.length > 0
  );
}
