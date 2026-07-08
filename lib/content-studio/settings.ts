import { defaultModel, modelsForProvider, type ProviderId } from "@/lib/models";

/** Own namespace — independent from the chatbot's `my-chatbot-app-settings-v1` key. */
const STORAGE_KEY = "content-studio-settings-v1";

export type ContentStudioSettings = {
  provider: ProviderId;
  model: string;
};

export function defaultContentStudioSettings(): ContentStudioSettings {
  return { provider: "openai", model: defaultModel("openai") };
}

function coerceProvider(v: unknown): ProviderId {
  return v === "anthropic" ? "anthropic" : "openai";
}

export function normalizeContentStudioSettings(
  s: Partial<ContentStudioSettings>,
): ContentStudioSettings {
  const provider = coerceProvider(s.provider);
  let model = typeof s.model === "string" ? s.model : defaultModel(provider);
  if (!modelsForProvider(provider).some((m) => m.id === model)) {
    model = defaultModel(provider);
  }
  return { provider, model };
}

export function loadContentStudioSettings(): ContentStudioSettings {
  const defaults = defaultContentStudioSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ContentStudioSettings>;
    return normalizeContentStudioSettings(parsed);
  } catch {
    return defaults;
  }
}

export function saveContentStudioSettings(settings: ContentStudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeContentStudioSettings(settings)));
  } catch {
    // quota or private mode
  }
}
