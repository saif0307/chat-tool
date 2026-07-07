import { tool } from "ai";
import type { ToolSet, UIMessage } from "ai";
import { z } from "zod";
import {
  resolveImageUrlForEdit,
  resolveVideoUrlForExtend,
} from "@/lib/media-context";
import type { ImageLayout, VideoAspect } from "@/lib/media-models";
import {
  clampVideoDuration,
  imageLayoutToAspectRatio,
  videoAspectForReplicate,
} from "@/lib/media-models";
import {
  getReplicateToken,
  replicateEditImage,
  replicateExtendVideo,
  replicateGenerateImage,
  replicateGenerateVideo,
} from "@/lib/media/replicate-client";

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
    "Composition preset (image generation tiers). Default landscape 16:9 if omitted.",
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
    if (!getReplicateToken()) {
      return {
        error: "Image generation is not configured (missing REPLICATE_API_TOKEN).",
      };
    }

    const aspect_ratio = imageLayoutToAspectRatio(
      (layout ?? "landscape_16_9") as ImageLayout,
    );

    try {
      const mediaUrl = await replicateGenerateImage({
        tier: quality_tier,
        prompt,
        aspect_ratio,
      });

      return {
        mediaKind: "image" as const,
        mediaUrl,
        caption: prompt.slice(0, 200),
        tier: quality_tier,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Image generation failed.";
      return { error: msg };
    }
  },
});

function buildEditImageTool(messages: UIMessage[]) {
  return tool({
    description:
      "Edit or transform an image from this chat using Nano Banana 2. Call when the user wants visual changes to a photo they attached OR to an image already shown in the thread (e.g. one you generated earlier). Source images are resolved automatically from recent uploads and prior generate/edit results—omit image_urls unless you must target a specific URL. If their edit request is clear, call this tool immediately; do not ask them to re-attach an image that is already visible above. For brand-new images from text only, use generate_image instead.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "What to change or produce relative to the source image: edits, style, scene, etc.",
        ),
      image_urls: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Optional: explicit image URLs from this chat. Omit to auto-use the most recent image (upload or prior tool result).",
        ),
    }),
    execute: async ({ prompt, image_urls }) => {
      if (!getReplicateToken()) {
        return {
          error: "Image editing is not configured (missing REPLICATE_API_TOKEN).",
        };
      }

      const imageUrl = resolveImageUrlForEdit(messages, image_urls);
      if (!imageUrl) {
        return {
          error:
            "No image found in this chat. Ask the user to attach an image or generate one first.",
        };
      }

      try {
        const mediaUrl = await replicateEditImage({
          prompt,
          imageUrl,
          imageUrls: image_urls,
        });

        return {
          mediaKind: "image" as const,
          mediaUrl,
          caption: prompt.slice(0, 200),
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
      .describe("Clip length in seconds (3–15). Default 5."),
  }),
  execute: async ({
    prompt,
    quality_tier,
    aspect_ratio,
    duration_seconds,
  }) => {
    if (!getReplicateToken()) {
      return {
        error: "Video generation is not configured (missing REPLICATE_API_TOKEN).",
      };
    }

    const aspect = videoAspectForReplicate((aspect_ratio ?? "16:9") as VideoAspect);

    try {
      const mediaUrl = await replicateGenerateVideo({
        prompt,
        tier: quality_tier,
        aspect_ratio: aspect,
        duration_seconds: clampVideoDuration(duration_seconds ?? 5),
      });

      return {
        mediaKind: "video" as const,
        mediaUrl,
        caption: prompt.slice(0, 200),
        tier: quality_tier,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Video generation failed.";
      return { error: msg };
    }
  },
});

function buildExtendVideoTool(messages: UIMessage[]) {
  return tool({
    description:
      "Extend or continue a video already in this chat using Seedance video-to-video. Call when the user wants more footage after an existing clip (e.g. ‘keep going’, ‘extend this’, ‘continue the scene’). Source video is resolved automatically from recent uploads and prior generate/extend results—omit video_urls unless you must target a specific URL. Do not ask the user to re-attach a video that is already visible above.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "What should happen next in the scene—motion, camera, dialogue (use quotes), mood.",
        ),
      quality_tier: qualityTierField,
      duration_seconds: z
        .number()
        .int()
        .min(3)
        .max(15)
        .optional()
        .describe("Length of the new continuation segment (3–15s). Default 5."),
      video_urls: z
        .array(z.string().min(1))
        .optional()
        .describe(
          "Optional: explicit video URLs from this chat. Omit to auto-use the most recent video.",
        ),
    }),
    execute: async ({ prompt, quality_tier, duration_seconds, video_urls }) => {
      if (!getReplicateToken()) {
        return {
          error: "Video extension is not configured (missing REPLICATE_API_TOKEN).",
        };
      }

      const videoUrl = resolveVideoUrlForExtend(messages, video_urls);
      if (!videoUrl) {
        return {
          error:
            "No video found in this chat. Ask the user to attach a video or generate one first.",
        };
      }

      try {
        const mediaUrl = await replicateExtendVideo({
          prompt,
          tier: quality_tier,
          videoUrl,
          duration_seconds: clampVideoDuration(duration_seconds ?? 5),
        });

        return {
          mediaKind: "video" as const,
          mediaUrl,
          caption: prompt.slice(0, 200),
          tier: quality_tier,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Video extension failed.";
        return { error: msg };
      }
    },
  });
}

/** Image, edit, video, and extend via Replicate when `REPLICATE_API_TOKEN` is set. */
export function getMediaTools(messages: UIMessage[]): ToolSet {
  if (!getReplicateToken()) return {};

  return {
    generate_image: generateImageTool,
    edit_image: buildEditImageTool(messages),
    generate_video: generateVideoTool,
    extend_video: buildExtendVideoTool(messages),
  };
}
