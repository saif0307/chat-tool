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

export const maxDuration = 120;

/** Larger completions when Max mode is enabled in the UI. */
const OUTPUT_TOKENS_DEFAULT = 8192;
const OUTPUT_TOKENS_MAX_MODE = 32768;

/** `provider` (default): OpenAI Responses API + Anthropic web_search tool — billed by provider. */
const SYSTEM_NATIVE_WEB =
  "Use the web_search tool whenever the user needs fresh or verifiable information from the public web; summarize and cite URLs.";

const SYSTEM_FIRECRAWL =
  "When you need live web facts, call the web_search tool with a concise query before answering.";

type ChatRequestBody = {
  messages: UIMessage[];
  provider: ProviderId;
  model: string;
  maxMode?: boolean;
  enableWebSearch?: boolean;
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

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }

  if (provider !== "openai" && provider !== "anthropic") {
    return Response.json({ error: "provider must be openai or anthropic" }, { status: 400 });
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

  if (enableWebSearch && backend === "firecrawl" && !process.env.FIRECRAWL_API_KEY) {
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
        web_search: openai.tools.webSearch(),
      };
    } else {
      /** Anthropic Messages API + hosted web_search tool (billed via Anthropic). */
      languageModel = anthropic.chat(model);
      tools = {
        web_search: anthropic.tools.webSearch_20260209({ maxUses: 10 }),
      };
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const maxOutputTokens = maxMode ? OUTPUT_TOKENS_MAX_MODE : OUTPUT_TOKENS_DEFAULT;

  const hasTools = tools !== undefined && Object.keys(tools).length > 0;

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    maxOutputTokens,
    ...(hasTools && tools
      ? {
          tools,
          toolChoice: "auto",
          stopWhen: stepCountIs(12),
          ...(searchSystem ? { system: searchSystem } : {}),
        }
      : {}),
  });

  return result.toUIMessageStreamResponse();
}
