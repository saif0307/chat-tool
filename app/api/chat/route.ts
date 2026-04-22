import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderId } from "@/lib/models";
import { getFirecrawlWebSearchTools } from "@/lib/tools/web-search-firecrawl";
import { expandInlinedMetadataForModel } from "@/lib/expand-user-message-metadata";

export const maxDuration = 120;

/** Larger completions when Max mode is enabled in the UI. */
const OUTPUT_TOKENS_DEFAULT = 8192;
const OUTPUT_TOKENS_MAX_MODE = 32768;

/** `provider` (default): OpenAI Responses API + Anthropic web_search tool — billed by provider. */
const SYSTEM_NATIVE_WEB =
  "When you need live web facts: use web_search at most once per user message with one query that covers the whole question (e.g. “Brent WTI crude oil spot price today”). Then answer from what you get—do not issue another search for the same question unless the first result was empty or unusable. Summarize and cite URLs.";

const SYSTEM_FIRECRAWL =
  "When live web facts are needed: call web_search once with one query that covers the full question. Answer from those results; do not call again for the same turn unless results were empty.";

/**
 * Behavior aligned with fast assistants (answer first, minimal clarifying questions).
 * Appended after provider-specific web instructions.
 */
const SYSTEM_WEB_DIRECT = [
  "Response style (important):",
  "- After any tool results, answer immediately with concrete facts (numbers, dates, names). Lead with the takeaway.",
  "- Do not ask the user to pick between common alternatives when both are routinely quoted together—for example commodity prices often list both Brent and WTI; quote both briefly instead of asking which benchmark they want.",
  "- Ask a clarifying question only when you cannot answer safely or meaningfully without it—not as a substitute for answering.",
].join("\n");

type ChatRequestBody = {
  messages: UIMessage[];
  provider: ProviderId;
  model: string;
  maxMode?: boolean;
  enableWebSearch?: boolean;
  /** Client-side “custom instructions”; merged into system prompt when set. */
  customInstructions?: string;
};

/** `provider` | `firecrawl` — see `.env.example` */
function webSearchBackend(): "provider" | "firecrawl" {
  const raw = (process.env.WEB_SEARCH_BACKEND ?? "provider").toLowerCase();
  return raw === "firecrawl" ? "firecrawl" : "provider";
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, provider, model, maxMode } = body;
  const enableWebSearch = body.enableWebSearch !== false;
  const customInstructions =
    typeof body.customInstructions === "string"
      ? body.customInstructions.trim()
      : "";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "messages must be a non-empty array" },
      { status: 400 },
    );
  }

  if (provider !== "openai" && provider !== "anthropic") {
    return Response.json(
      { error: "provider must be openai or anthropic" },
      { status: 400 },
    );
  }

  if (!model || typeof model !== "string") {
    return Response.json({ error: "model is required" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (provider === "openai" && !openaiKey) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY. Add it to your environment." },
      { status: 503 },
    );
  }

  if (provider === "anthropic" && !anthropicKey) {
    return Response.json(
      { error: "Missing ANTHROPIC_API_KEY. Add it to your environment." },
      { status: 503 },
    );
  }

  const openai = createOpenAI({ apiKey: openaiKey ?? "" });
  const anthropic = createAnthropic({ apiKey: anthropicKey ?? "" });

  const backend = webSearchBackend();

  if (
    enableWebSearch &&
    backend === "firecrawl" &&
    !process.env.FIRECRAWL_API_KEY
  ) {
    return Response.json(
      {
        error:
          "Live search is set to Firecrawl (WEB_SEARCH_BACKEND=firecrawl) but FIRECRAWL_API_KEY is missing.",
      },
      { status: 503 },
    );
  }

  let languageModel: LanguageModel;
  let tools: ToolSet | undefined;
  let searchSystem: string | undefined;

  if (!enableWebSearch) {
    languageModel =
      provider === "openai" ? openai.chat(model) : anthropic.chat(model);
  } else if (backend === "firecrawl") {
    languageModel =
      provider === "openai" ? openai.chat(model) : anthropic.chat(model);
    tools = getFirecrawlWebSearchTools();
    searchSystem = SYSTEM_FIRECRAWL;
  } else {
    searchSystem = SYSTEM_NATIVE_WEB;
    if (provider === "openai") {
      /** Native OpenAI web search uses the Responses API + provider tool `web_search`. */
      languageModel = openai.responses(model);
      tools = {
        /** Lower context speeds searches vs. high; keeps latency closer to fast consumer UIs. */
        web_search: openai.tools.webSearch({ searchContextSize: "low" }),
      };
    } else {
      /** Anthropic Messages API + hosted web_search tool (billed via Anthropic). */
      languageModel = anthropic.chat(model);
      tools = {
        /** Hard cap prevents long chains of searches on one reply (major latency driver). */
        web_search: anthropic.tools.webSearch_20260209({ maxUses: 2 }),
      };
    }
  }

  const modelMessages = await convertToModelMessages(
    expandInlinedMetadataForModel(messages),
  );

  const maxOutputTokens = maxMode
    ? OUTPUT_TOKENS_MAX_MODE
    : OUTPUT_TOKENS_DEFAULT;

  const hasTools = tools !== undefined && Object.keys(tools).length > 0;

  const systemParts: string[] = [];
  if (customInstructions) {
    systemParts.push(
      `User preferences (custom instructions):\n${customInstructions}`,
    );
  }
  if (searchSystem) {
    systemParts.push(searchSystem);
    systemParts.push(SYSTEM_WEB_DIRECT);
  }
  const combinedSystem =
    systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    maxOutputTokens,
    ...(combinedSystem ? { system: combinedSystem } : {}),
    ...(hasTools && tools
      ? {
          tools,
          toolChoice: "auto",
          /** Caps sequential model↔tool rounds (each extra round adds seconds—ChatGPT-like UX stays low). */
          stopWhen: stepCountIs(4),
          providerOptions:
            provider === "openai"
              ? {
                  /** One tool call at a time reduces multi–web_search bursts in a single turn. */
                  openai: { parallelToolCalls: false },
                }
              : { anthropic: { toolStreaming: true } },
        }
      : {}),
  });

  return result.toUIMessageStreamResponse();
}
