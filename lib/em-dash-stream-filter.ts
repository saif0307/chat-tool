import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

/**
 * Replaces em dashes used as clause/sentence breaks with ", " so output reads like
 * "raised your seed round, congrats" instead of "raised your seed round — congrats".
 */
export function replaceEmDashClauseBreaks(text: string): string {
  return text.replace(/\s*—\s*/g, ", ");
}

/**
 * Stream transform: strips em dashes from assistant text deltas (token-safe across chunks).
 */
export function emDashStreamFilter<
  TOOLS extends ToolSet,
>(): StreamTextTransform<TOOLS> {
  return () => {
    let rawBuffer = "";
    let emittedTransformed = "";
    let textId = "";

    function resetTextState() {
      rawBuffer = "";
      emittedTransformed = "";
      textId = "";
    }

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type !== "text-delta" && chunk.type !== "reasoning-delta") {
          resetTextState();
          controller.enqueue(chunk);
          return;
        }

        if (chunk.id !== textId) {
          resetTextState();
          textId = chunk.id;
        }

        rawBuffer += chunk.text;
        const full = replaceEmDashClauseBreaks(rawBuffer);
        const delta = full.slice(emittedTransformed.length);
        emittedTransformed = full;

        if (delta.length > 0) {
          controller.enqueue({
            ...chunk,
            text: delta,
          });
        }
      },
      flush(controller) {
        resetTextState();
      },
    });
  };
}
