export type ProviderId = "openai" | "anthropic";

/** Highest reasoning depth / longest outputs when Max mode is on (aligned with @ai-sdk model IDs). */
export const MAX_MODE_MODEL: Record<ProviderId, string> = {
  openai: "gpt-5.5",
  anthropic: "claude-opus-4-8",
};

export type ModelTier = "max" | "intelligent" | "balanced" | "fast";

export type LabeledModel = {
  id: string;
  tier: ModelTier;
  /** Short label for the dropdown */
  label: string;
};

function tierPrefix(tier: ModelTier): string {
  switch (tier) {
    case "max":
      return "Max · ";
    case "intelligent":
      return "Intelligent · ";
    case "balanced":
      return "Balanced · ";
    case "fast":
      return "Fast · ";
    default:
      return "";
  }
}

function m(id: string, tier: ModelTier, name: string): LabeledModel {
  return { id, tier, label: `${tierPrefix(tier)}${name}` };
}

/**
 * Curated catalog — one pick per tier, latest generation only.
 * IDs match @ai-sdk/openai + @ai-sdk/anthropic (v4.x).
 */
export const OPENAI_MODELS: LabeledModel[] = [
  m("gpt-5.5", "max", "GPT-5.5 — frontier"),
  m("gpt-5.4", "intelligent", "GPT-5.4"),
  m("gpt-5.4-mini", "balanced", "GPT-5.4 Mini"),
  m("gpt-5.4-nano", "fast", "GPT-5.4 Nano"),
];

export const ANTHROPIC_MODELS: LabeledModel[] = [
  m("claude-opus-4-8", "max", "Opus 4.8 — strongest"),
  m("claude-sonnet-5", "intelligent", "Sonnet 5 — speed + IQ"),
  m("claude-haiku-4-5", "fast", "Haiku 4.5"),
];

export function modelsForProvider(provider: ProviderId): LabeledModel[] {
  return provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
}

export function defaultModel(provider: ProviderId): string {
  return provider === "openai" ? "gpt-5.4-mini" : "claude-sonnet-5";
}

export function resolveEffectiveModel(
  provider: ProviderId,
  selectedModelId: string,
  maxMode: boolean,
): string {
  if (maxMode) return MAX_MODE_MODEL[provider];
  return selectedModelId;
}
