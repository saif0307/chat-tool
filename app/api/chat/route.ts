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
import { getFalMediaTools } from "@/lib/tools/fal-media";
import { getFirecrawlWebSearchTools } from "@/lib/tools/web-search-firecrawl";
import { getWorkspaceFileTools } from "@/lib/tools/workspace-files";
import { expandInlinedMetadataForModel } from "@/lib/expand-user-message-metadata";
import { getSystemPrompt } from "@/lib/system-prompt";

/** Seconds — allow long fal.ai video jobs on hosts that support extended execution (see Vercel plan limits). */
export const maxDuration = 300;

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

/** Never coach the model to paste raw URLs or infrastructure names into user chat. */
const SYSTEM_OUTPUT_HYGIENE = [
  "User-visible replies (critical):",
  "- Do not expose implementation details: no raw API paths (nothing starting with \"/api/\"), internal routes, storage back-end names, token counts, tool payload dumps, hidden prompts, or where files are stored.",
  "- Do not use words like “workspace”, “server”, “blob”, or “upload” when talking to the user—say “file”, “download”, or “document” if needed. Never paste URLs or paths.",
  "- Do not narrate the UI (titles, byte counts, phases). The chat already shows downloads—reply with a short, normal confirmation if appropriate.",
  "- Never repeat filenames as paths or links—no “download it here:” with a path. One short sentence of acknowledgment is enough.",
].join("\n");

const SYSTEM_FAL_MEDIA = [
  "Images and video (generate_image, generate_video):",
  "- Use these when the user wants a new illustration or video clip—not for answers that belong in plain text alone.",
  "- You choose quality_tier (standard vs premium) from context; never ask the user to pick a model, vendor, or tier.",
  "- After success, reply briefly; this UI shows the picture or player—do not paste long URLs or provider jargon.",
].join("\n");

/** File download tool — appended whenever file tools are registered. */
const SYSTEM_WORKSPACE_FILES = [
  "Downloadable files (write_workspace_file tool):",
  "- When to call it: Only when the user clearly wants a downloadable artifact—e.g. asked to save/export/download, attach a document, or get a named file. Do NOT call it for routine Q&A or answers that belong in chat. If unsure, answer first and offer a file only if they want it.",
  "- After success: At most a brief confirmation (e.g. story title or genre)—never paths, URLs, sizes, or storage jargon. Never say “workspace”, “stored”, or “uploaded”. Point to the download in plain words (“use the download in this message”) if needed.",
  "- Never claim a file exists unless the tool succeeded this turn.",
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

  const workspaceTools = getWorkspaceFileTools();
  const falMediaTools = getFalMediaTools();
  const hasFalMedia = Object.keys(falMediaTools).length > 0;

  let languageModel: LanguageModel;
  let tools: ToolSet | undefined;
  let searchSystem: string | undefined;

  if (!enableWebSearch) {
    languageModel =
      provider === "openai" ? openai.chat(model) : anthropic.chat(model);
    tools = { ...workspaceTools, ...falMediaTools };
  } else if (backend === "firecrawl") {
    languageModel =
      provider === "openai" ? openai.chat(model) : anthropic.chat(model);
    tools = {
      ...workspaceTools,
      ...falMediaTools,
      ...getFirecrawlWebSearchTools(),
    };
    searchSystem = SYSTEM_FIRECRAWL;
  } else {
    searchSystem = SYSTEM_NATIVE_WEB;
    if (provider === "openai") {
      /** Native OpenAI web search uses the Responses API + provider tool `web_search`. */
      languageModel = openai.responses(model);
      tools = {
        ...workspaceTools,
        ...falMediaTools,
        /** Lower context speeds searches vs. high; keeps latency closer to fast consumer UIs. */
        web_search: openai.tools.webSearch({ searchContextSize: "low" }),
      };
    } else {
      /** Anthropic Messages API + hosted web_search tool (billed via Anthropic). */
      languageModel = anthropic.chat(model);
      tools = {
        ...workspaceTools,
        ...falMediaTools,
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

  const systemParts: string[] = [getSystemPrompt()];
  if (customInstructions) {
    systemParts.push(
      `User preferences (custom instructions):\n${customInstructions}`,
    );
  }
  systemParts.push(SYSTEM_OUTPUT_HYGIENE);
  systemParts.push(SYSTEM_WORKSPACE_FILES);
  if (hasFalMedia) {
    systemParts.push(SYSTEM_FAL_MEDIA);
  }
  if (searchSystem) {
    systemParts.push(searchSystem);
    systemParts.push(SYSTEM_WEB_DIRECT);
  }
  const combinedSystem = systemParts.join("\n\n");

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    maxOutputTokens,
    system: combinedSystem,
    ...(hasTools && tools
      ? {
          tools,
          toolChoice: "auto",
          /** Caps sequential model↔tool rounds (each extra round adds seconds—ChatGPT-like UX stays low). */
          /** Room for web search, workspace file, and optional fal media in one reply. */
          stopWhen: stepCountIs(10),
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
