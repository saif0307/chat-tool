import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { defaultModel, type ProviderId } from "@/lib/models";
import {
  hasProviderKey,
  missingProviderKeyMessage,
  resolveChatModel,
} from "@/lib/ai/provider-clients";
import { getContentStudioTools } from "@/lib/content-studio/tools/registry";
import { getContentStudioSystemPrompt } from "@/lib/content-studio/system-prompt";

/** Own route, own system prompt, own tool set — independent from `app/api/chat/route.ts`. */
export const maxDuration = 300;

const OUTPUT_TOKENS_DEFAULT = 8192;

type ContentStudioChatRequestBody = {
  messages: UIMessage[];
  provider?: ProviderId;
  model?: string;
};

export async function POST(req: Request) {
  let body: ContentStudioChatRequestBody;
  try {
    body = (await req.json()) as ContentStudioChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  const provider: ProviderId = body.provider === "anthropic" ? "anthropic" : "openai";
  const model =
    typeof body.model === "string" && body.model.length > 0
      ? body.model
      : defaultModel(provider);

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "messages must be a non-empty array" },
      { status: 400 },
    );
  }

  if (!hasProviderKey(provider)) {
    return Response.json({ error: missingProviderKeyMessage(provider) }, { status: 503 });
  }

  const languageModel = resolveChatModel(provider, model);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: languageModel,
    messages: modelMessages,
    maxOutputTokens: OUTPUT_TOKENS_DEFAULT,
    system: getContentStudioSystemPrompt(),
    tools: getContentStudioTools(languageModel),
    toolChoice: "auto",
    /** Full pipeline can chain discover -> research -> angles -> write -> critique -> reply. */
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
