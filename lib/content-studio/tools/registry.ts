import type { LanguageModel, ToolSet } from "ai";
import { getTrendDiscoveryTools } from "@/lib/content-studio/tools/trend-discovery";
import { getResearchTools } from "@/lib/content-studio/tools/research";
import { getAngleGeneratorTools } from "@/lib/content-studio/tools/angle-generator";
import { getWritingTools } from "@/lib/content-studio/tools/writing";
import { getCriticTools } from "@/lib/content-studio/tools/critic";

/**
 * Aggregates every real Content Studio tool for the chat route — mirrors the chatbot's
 * `getXTools()` composition convention in `app/api/chat/route.ts`. The reasoning-only tools
 * (angles/writing/critic) reuse the same resolved `languageModel` as the parent conversation.
 */
export function getContentStudioTools(languageModel: LanguageModel): ToolSet {
  return {
    ...getTrendDiscoveryTools(),
    ...getResearchTools(),
    ...getAngleGeneratorTools(languageModel),
    ...getWritingTools(languageModel),
    ...getCriticTools(languageModel),
  };
}
