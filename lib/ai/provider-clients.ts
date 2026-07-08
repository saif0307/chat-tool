import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ProviderId } from "@/lib/models";

/**
 * Shared provider-client abstraction — used by both `app/api/chat/route.ts` (chatbot) and
 * `app/api/content-studio/chat/route.ts` (Content Studio) so neither route re-instantiates
 * `createOpenAI`/`createAnthropic` or duplicates API-key validation.
 */

export function hasProviderKey(provider: ProviderId): boolean {
  return provider === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export function missingProviderKeyMessage(provider: ProviderId): string {
  return provider === "openai"
    ? "Missing OPENAI_API_KEY. Add it to your environment."
    : "Missing ANTHROPIC_API_KEY. Add it to your environment.";
}

export function createOpenAIClient() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
}

export function createAnthropicClient() {
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

/** Plain chat-completion model for a provider — the common case both apps need. */
export function resolveChatModel(provider: ProviderId, model: string): LanguageModel {
  return provider === "openai"
    ? createOpenAIClient().chat(model)
    : createAnthropicClient().chat(model);
}
