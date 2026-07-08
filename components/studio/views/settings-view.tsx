"use client";

import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { StudioTopbar } from "@/components/studio/studio-topbar";
import { modelsForProvider, type ProviderId } from "@/lib/models";
import {
  loadContentStudioSettings,
  saveContentStudioSettings,
  type ContentStudioSettings,
} from "@/lib/content-studio/settings";
import { clearAllProjects, hasAnyProjects } from "@/lib/content-studio/services/project-service";
import { cn } from "@/lib/cn";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
];

export function SettingsView() {
  const [settings, setSettings] = useState<ContentStudioSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSettings(loadContentStudioSettings());
      setHasProjects(hasAnyProjects());
    });
  }, []);

  function persist(next: ContentStudioSettings) {
    setSettings(next);
    saveContentStudioSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function handleProviderChange(provider: ProviderId) {
    if (!settings) return;
    const model = modelsForProvider(provider)[0]?.id ?? settings.model;
    persist({ provider, model });
  }

  function handleModelChange(model: string) {
    if (!settings) return;
    persist({ ...settings, model });
  }

  function handleClearAll() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearAllProjects();
    setHasProjects(false);
    setConfirmingClear(false);
  }

  if (!settings) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StudioTopbar
        title="Settings"
        description="Preferences for how Content Studio researches and writes."
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="border-foreground/10 bg-cs-surface rounded-2xl border p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-foreground text-sm font-semibold">Model</h3>
              {saved ? (
                <span className="text-cs-accent flex items-center gap-1 text-xs font-medium">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Saved
                </span>
              ) : null}
            </div>
            <p className="text-foreground/55 mt-1.5 text-[13px] leading-relaxed">
              Which provider and model power research reasoning, angle generation, writing, and
              critique for new messages.
            </p>

            <div className="mt-4 flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                    settings.provider === p.id
                      ? "border-cs-accent/40 bg-cs-accent/10 text-cs-accent"
                      : "border-foreground/10 text-foreground/65 hover:bg-foreground/6",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="text-foreground/50 mb-1.5 block text-xs font-medium uppercase tracking-wide">
                Model
              </span>
              <select
                value={settings.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="border-foreground/15 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                {modelsForProvider(settings.provider).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-foreground/10 bg-cs-surface rounded-2xl border p-5">
            <h3 className="text-foreground text-sm font-semibold">Data</h3>
            <p className="text-foreground/55 mt-1.5 text-[13px] leading-relaxed">
              Content Studio stores your projects locally in this browser, independent from the
              chatbot&apos;s history.
            </p>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!hasProjects}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                confirmingClear
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : "bg-foreground/6 text-foreground hover:bg-foreground/10",
              )}
              onBlur={() => setConfirmingClear(false)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {confirmingClear ? "Click again to confirm" : "Clear all projects"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
