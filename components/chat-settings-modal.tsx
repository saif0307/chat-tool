"use client";

import { useEffect, useId, useRef } from "react";
import {
  defaultModel,
  modelsForProvider,
  resolveEffectiveModel,
  type ProviderId,
} from "@/lib/models";

export type SettingsDraft = {
  provider: ProviderId;
  model: string;
  maxMode: boolean;
  enableWebSearch: boolean;
  customInstructions: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  draft: SettingsDraft;
  onChangeDraft: (patch: Partial<SettingsDraft>) => void;
  onSave: () => void;
};

export function ChatSettingsModal({
  open,
  onClose,
  draft,
  onChangeDraft,
  onSave,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
  }, [open]);

  if (!open) return null;

  const modelOptions = modelsForProvider(draft.provider);
  const effectiveModel = resolveEffectiveModel(draft.provider, draft.model, draft.maxMode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="border-foreground/12 bg-background text-foreground relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl border shadow-xl"
      >
        <div className="border-foreground/10 flex flex-shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              Settings
            </h2>
            <p className="text-foreground/55 mt-0.5 text-sm">
              These defaults apply to every chat. Stored in this browser only (local storage).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground hover:bg-foreground/8 rounded-lg px-2 py-1 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-foreground/75 font-medium">Provider</span>
            <select
              value={draft.provider}
              onChange={(e) => {
                const p = e.target.value as ProviderId;
                onChangeDraft({ provider: p, model: defaultModel(p) });
              }}
              className="border-foreground/15 bg-background focus:ring-foreground/20 rounded-lg border px-3 py-2 outline-none focus:ring-2"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>

          <label className="text-foreground/65 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.maxMode}
              onChange={(e) => onChangeDraft({ maxMode: e.target.checked })}
              className="accent-foreground h-4 w-4 rounded border"
            />
            <span title="Uses the strongest model for this provider and longer outputs">
              Max mode
            </span>
          </label>

          <label className="text-foreground/65 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enableWebSearch}
              onChange={(e) => onChangeDraft({ enableWebSearch: e.target.checked })}
              className="accent-foreground h-4 w-4 rounded border"
            />
            <span title="Provider-hosted web search when available">
              Live web search
            </span>
          </label>

          {!draft.maxMode && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-foreground/75 font-medium">Model</span>
              <select
                value={draft.model}
                onChange={(e) => onChangeDraft({ model: e.target.value })}
                className="border-foreground/15 bg-background focus:ring-foreground/20 max-w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.maxMode && (
            <p className="text-foreground/55 text-xs">
              Max model: <span className="font-mono">{effectiveModel}</span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-instructions" className="text-foreground/75 text-sm font-medium">
              Custom instructions
            </label>
            <textarea
              id="custom-instructions"
              value={draft.customInstructions}
              onChange={(e) => onChangeDraft({ customInstructions: e.target.value })}
              placeholder="Optional: tone, format, expertise, or anything the assistant should follow across chats."
              rows={6}
              className="border-foreground/15 bg-background placeholder:text-foreground/35 focus:ring-foreground/20 max-h-48 min-h-[8rem] w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
            />
            <p className="text-foreground/45 text-xs">
              Sent to the model as extra system context when non-empty. Stored locally only.
            </p>
          </div>
        </div>

        <div className="border-foreground/10 flex flex-shrink-0 justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border-foreground/15 bg-background text-foreground hover:bg-foreground/5 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="bg-foreground text-background hover:opacity-92 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
