export type ProviderId = "openai" | "anthropic";

/** Highest reasoning depth / longest outputs when Max mode is on (aligned with @ai-sdk model IDs). */
export const MAX_MODE_MODEL: Record<ProviderId, string> = {
  openai: "gpt-5.4-pro",
  anthropic: "claude-opus-4-7",
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
 * Latest catalog (verify against provider docs). IDs match @ai-sdk/openai + @ai-sdk/anthropic unions.
 */
export const OPENAI_MODELS: LabeledModel[] = [
  m("gpt-5.4-pro", "max", "GPT-5.4 Pro — frontier reasoning"),
  m("gpt-5.4", "intelligent", "GPT-5.4"),
  m("gpt-5.4-mini", "balanced", "GPT-5.4 Mini"),
  m("gpt-5.4-nano", "fast", "GPT-5.4 Nano"),
  m("gpt-5.2", "intelligent", "GPT-5.2"),
  m("gpt-5.2-pro", "max", "GPT-5.2 Pro"),
  m("gpt-5.1", "balanced", "GPT-5.1"),
  m("gpt-5-mini", "balanced", "GPT-5 Mini"),
  m("gpt-5-nano", "fast", "GPT-5 Nano"),
  m("gpt-4.1", "balanced", "GPT-4.1"),
  m("gpt-4o", "balanced", "GPT-4o"),
  m("gpt-4o-mini", "fast", "GPT-4o Mini"),
  m("o4-mini", "balanced", "o4-mini"),
  m("o3-mini", "fast", "o3-mini"),
];

export const ANTHROPIC_MODELS: LabeledModel[] = [
  m("claude-opus-4-7", "max", "Opus 4.7 — strongest"),
  m("claude-opus-4-6", "max", "Opus 4.6"),
  m("claude-opus-4-5-20251101", "intelligent", "Opus 4.5"),
  m("claude-opus-4-1", "intelligent", "Opus 4.1"),
  m("claude-sonnet-4-6", "intelligent", "Sonnet 4.6 — speed + IQ"),
  m("claude-sonnet-4-5-20250929", "balanced", "Sonnet 4.5"),
  m("claude-sonnet-4-5", "balanced", "Sonnet 4.5 (alias)"),
  m("claude-haiku-4-5-20251001", "fast", "Haiku 4.5"),
];

export function modelsForProvider(provider: ProviderId): LabeledModel[] {
  return provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
}

export function defaultModel(provider: ProviderId): string {
  return provider === "openai" ? "gpt-5-mini" : "claude-sonnet-4-5-20250929";
}

export function resolveEffectiveModel(
  provider: ProviderId,
  selectedModelId: string,
  maxMode: boolean,
): string {
  if (maxMode) return MAX_MODE_MODEL[provider];
  return selectedModelId;
}
