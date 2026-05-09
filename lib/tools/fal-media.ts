import { fal } from "@fal-ai/client";
import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import type { ImageLayout, VideoAspect } from "@/lib/fal-models";
import {
  FAL_IMAGE_PREMIUM,
  FAL_IMAGE_STANDARD,
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

/** Image + video generation via fal.ai when `FAL_KEY` is set. */
export function getFalMediaTools(): ToolSet {
  if (!getFalKey()) return {};
  return {
    generate_image: generateImageTool,
    generate_video: generateVideoTool,
  };
}
