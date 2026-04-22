import { defaultModel, modelsForProvider, type ProviderId } from "@/lib/models";

const STORAGE_KEY = "my-chatbot-app-settings-v1";
/** Legacy key — custom instructions only; migrated once into STORAGE_KEY */
const LEGACY_STORAGE_KEY = "my-chatbot-user-settings-v1";

export type AppChatSettings = {
  provider: ProviderId;
  model: string;
  maxMode: boolean;
  enableWebSearch: boolean;
  /** Shown to the model as additional system context (ChatGPT-style custom instructions). */
  customInstructions: string;
};

/** Defaults when nothing is stored (SSR / first visit). */
export function defaultAppChatSettings(): AppChatSettings {
  return {
    provider: "openai",
    model: defaultModel("openai"),
    maxMode: false,
    enableWebSearch: true,
    customInstructions: "",
  };
}

function coerceProvider(v: unknown): ProviderId {
  return v === "anthropic" ? "anthropic" : "openai";
}

/** Ensure model id exists for the provider (handles catalog updates). */
export function normalizeAppChatSettings(s: AppChatSettings): AppChatSettings {
  const provider = coerceProvider(s.provider);
  let model = typeof s.model === "string" ? s.model : defaultModel(provider);
  if (!modelsForProvider(provider).some((x) => x.id === model)) {
    model = defaultModel(provider);
  }
  return {
    provider,
    model,
    maxMode: Boolean(s.maxMode),
    enableWebSearch: s.enableWebSearch !== false,
    customInstructions: typeof s.customInstructions === "string" ? s.customInstructions : "",
  };
}

function parsePartial(raw: string): Partial<AppChatSettings> | null {
  try {
    return JSON.parse(raw) as Partial<AppChatSettings>;
  } catch {
    return null;
  }
}

/**
 * Load app-wide chat preferences from localStorage (same for every conversation).
 * Migrates legacy `my-chatbot-user-settings-v1` if present.
 */
export function loadAppChatSettings(): AppChatSettings {
  const defaults = defaultAppChatSettings();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = parsePartial(raw);
      if (p) {
        return normalizeAppChatSettings({
          ...defaults,
          ...p,
          provider: coerceProvider(p.provider ?? defaults.provider),
          model: typeof p.model === "string" ? p.model : defaults.model,
          customInstructions:
            typeof p.customInstructions === "string" ? p.customInstructions : defaults.customInstructions,
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const p = parsePartial(legacy);
      const migrated = normalizeAppChatSettings({
        ...defaults,
        customInstructions:
          typeof p?.customInstructions === "string" ? p.customInstructions : defaults.customInstructions,
      });
      saveAppChatSettings(migrated);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    // ignore
  }

  return defaults;
}

export function saveAppChatSettings(settings: AppChatSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppChatSettings(settings)));
  } catch {
    // quota / private mode
  }
}

/** @deprecated Use loadAppChatSettings — kept for any external imports */
export type UserChatSettings = Pick<AppChatSettings, "customInstructions">;

/** @deprecated Use loadAppChatSettings */
export function loadUserSettings(): UserChatSettings {
  return { customInstructions: loadAppChatSettings().customInstructions };
}

/** @deprecated Use saveAppChatSettings with full settings */
export function saveUserSettings(settings: UserChatSettings): void {
  const cur = loadAppChatSettings();
  saveAppChatSettings({
    ...cur,
    customInstructions:
      typeof settings.customInstructions === "string" ? settings.customInstructions : cur.customInstructions,
  });
}
