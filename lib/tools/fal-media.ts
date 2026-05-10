import { fal } from "@fal-ai/client";
import { tool } from "ai";
import type { ToolSet, UIMessage } from "ai";
import { z } from "zod";
import type { ImageLayout, VideoAspect } from "@/lib/fal-models";
import {
  FAL_IMAGE_PREMIUM,
  FAL_IMAGE_STANDARD,
  FAL_NANO_BANANA_EDIT,
  FAL_VIDEO_PREMIUM,
  FAL_VIDEO_STANDARD,
} from "@/lib/fal-models";

/** Kling v3 text-to-video accepts these string durations only. */
type KlingDurationSeconds =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15";

function toKlingDuration(seconds: number): KlingDurationSeconds {
  const n = Math.min(15, Math.max(3, Math.round(seconds)));
  return String(n) as KlingDurationSeconds;
}

function getFalKey(): string | undefined {
  return process.env.FAL_KEY?.trim();
}

function collectImageUrlsFromMessage(m: UIMessage): string[] {
  const urls: string[] = [];
  for (const p of m.parts) {
    if (p.type !== "file") continue;
    const fp = p as { url?: string; mediaType?: string };
    if (!fp.url?.trim()) continue;
    if (!(fp.mediaType ?? "").toLowerCase().startsWith("image/")) continue;
    urls.push(fp.url);
  }
  return urls;
}

/** Prefer latest user message; then scan recent user turns for image file parts. */
function resolveImageUrlsForEdit(
  messages: UIMessage[],
  explicit?: string[],
): string[] {
  if (explicit?.filter((u) => u.trim()).length) {
    return explicit!.filter((u) => u.trim());
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const found = collectImageUrlsFromMessage(m);
    if (found.length) return found;
  }
  const seen = new Set<string>();
  const merged: string[] = [];
  let userTurns = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    userTurns++;
    if (userTurns > 6) break;
    for (const u of collectImageUrlsFromMessage(m)) {
      if (!seen.has(u)) {
        seen.add(u);
        merged.push(u);
      }
    }
  }
  return merged;
}

function pickImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const images = (data as { images?: unknown }).images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (!first || typeof first !== "object") return null;
  const url = (first as { url?: unknown }).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function pickVideoUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const video = (data as { video?: unknown }).video;
  if (!video || typeof video !== "object") return null;
  const url = (video as { url?: unknown }).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

const qualityTierField = z
  .enum(["standard", "premium"])
  .describe(
    "standard: fast / economical — drafts, previews, casual illustrations or clips. premium: flagship quality — marketing, cinematic video, hero visuals, maximum fidelity. Pick based on the user's goals and stakes; never ask them to choose a tier or model.",
  );

const imageLayoutField = z
  .enum([
    "landscape_16_9",
    "portrait_16_9",
    "square_hd",
    "landscape_4_3",
    "portrait_4_3",
    "square",
  ])
  .optional()
  .describe(
    "Composition preset (both image tiers). Default landscape 16:9 if omitted.",
  );

const generateImageTool = tool({
  description:
    "Create a new raster image from a text prompt (illustrations, concept art, diagrams, textures). Choose standard vs premium yourself from context—never ask the user which model or tier to use.",
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe("Detailed visual description; include style, lighting, and composition when helpful."),
    quality_tier: qualityTierField,
    layout: imageLayoutField,
  }),
  execute: async ({ prompt, quality_tier, layout }) => {
    const key = getFalKey();
    if (!key) {
      return { error: "Image generation is not configured." };
    }
    fal.config({ credentials: key });

    const modelId =
      quality_tier === "premium" ? FAL_IMAGE_PREMIUM : FAL_IMAGE_STANDARD;
    const image_size = (layout ?? "landscape_16_9") as ImageLayout;

    try {
      const result = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size,
          output_format: "png",
          enable_safety_checker: true,
        },
        logs: false,
      });

      const url = pickImageUrl(result.data);
      if (!url) {
        return { error: "Image generation returned no URL." };
      }

      return {
        mediaKind: "image" as const,
        mediaUrl: url,
        caption: prompt.slice(0, 200),
        tier: quality_tier,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Image generation failed.";
      return { error: msg };
    }
  },
});

const nanoBananaAspectRatios = [
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "4:1",
  "1:4",
  "8:1",
  "1:8",
] as const;

function buildEditImageTool(messages: UIMessage[]) {
  return tool({
    description:
      "Edit or transform photo(s) the user attached using Google's Nano Banana 2 (fal.ai). Call this when their message includes image(s) and they want visual changes (style, colors, theme, objects, background, restoration). Use attachments from the conversation automatically—omit image_urls unless you must reference specific URLs. If their instructions are clear, call this tool immediately in this turn; do not substitute long prose-only interior-design advice or ask permission to edit. For brand-new images from text only (no photo), use generate_image instead.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "What to change or produce relative to the source image(s): edits, style, scene, etc.",
        ),
      image_urls: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Optional: explicit image URLs from file parts in this chat (data URLs or hosted URLs). Omit to auto-use images from the user's recent attachments.",
        ),
      aspect_ratio: z
        .enum(nanoBananaAspectRatios)
        .optional()
        .describe("Output aspect ratio; default auto."),
      resolution: z
        .enum(["0.5K", "1K", "2K", "4K"])
        .optional()
        .describe("Output resolution; default 1K."),
    }),
    execute: async ({ prompt, image_urls, aspect_ratio, resolution }) => {
      const key = getFalKey();
      if (!key) {
        return { error: "Image editing is not configured (missing FAL_KEY)." };
      }
      fal.config({ credentials: key });

      const urls = resolveImageUrlsForEdit(messages, image_urls);
      if (!urls.length) {
        return {
          error:
            "No image attachments found. Ask the user to attach at least one image, then try again.",
        };
      }

      try {
        const result = await fal.subscribe(FAL_NANO_BANANA_EDIT, {
          input: {
            prompt,
            image_urls: urls,
            aspect_ratio: aspect_ratio ?? "auto",
            resolution: resolution ?? "1K",
            output_format: "png",
            num_images: 1,
          },
          logs: false,
        });

        const url = pickImageUrl(result.data);
        if (!url) {
          return { error: "Image edit returned no URL." };
        }

        return {
          mediaKind: "image" as const,
          mediaUrl: url,
          caption: prompt.slice(0, 200),
          model: "nano-banana-2-edit",
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Image editing failed.";
        return { error: msg };
      }
    },
  });
}

const generateVideoTool = tool({
  description:
    "Create a short video from a text prompt. Choose standard vs premium yourself from context—never ask the user which model or tier to use.",
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe("Scene, motion, mood, and duration intent (e.g. slow pan, aerial shot)."),
    quality_tier: qualityTierField,
    aspect_ratio: z
      .enum(["16:9", "9:16", "1:1"])
      .optional()
      .describe("Frame shape; default 16:9."),
    duration_seconds: z
      .number()
      .int()
      .min(3)
      .max(15)
      .optional()
      .describe(
        "Clip length in seconds (premium Kling only; clamped 3–15). Ignored for standard tier defaults.",
      ),
  }),
  execute: async ({
    prompt,
    quality_tier,
    aspect_ratio,
    duration_seconds,
  }) => {
    const key = getFalKey();
    if (!key) {
      return { error: "Video generation is not configured." };
    }
    fal.config({ credentials: key });

    const aspect: VideoAspect = aspect_ratio ?? "16:9";

    try {
      if (quality_tier === "standard") {
        const result = await fal.subscribe(FAL_VIDEO_STANDARD, {
          input: {
            prompt,
            aspect_ratio: aspect,
            resolution: "720p",
          },
          logs: false,
        });
        const url = pickVideoUrl(result.data);
        if (!url) return { error: "Video generation returned no URL." };
        return {
          mediaKind: "video" as const,
          mediaUrl: url,
          caption: prompt.slice(0, 200),
          tier: quality_tier,
        };
      }

      const dur = duration_seconds ?? 5;
      const result = await fal.subscribe(FAL_VIDEO_PREMIUM, {
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: toKlingDuration(dur),
          generate_audio: true,
        },
        logs: false,
      });
      const url = pickVideoUrl(result.data);
      if (!url) return { error: "Video generation returned no URL." };
      return {
        mediaKind: "video" as const,
        mediaUrl: url,
        caption: prompt.slice(0, 200),
        tier: quality_tier,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Video generation failed.";
      return { error: msg };
    }
  },
});

/** Image generation, Nano Banana image edit, and video via fal.ai when `FAL_KEY` is set. */
export function getFalMediaTools(messages: UIMessage[]): ToolSet {
  if (!getFalKey()) return {};
  return {
    generate_image: generateImageTool,
    edit_image: buildEditImageTool(messages),
    generate_video: generateVideoTool,
  };
}
