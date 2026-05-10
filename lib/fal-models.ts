/**
 * Curated fal.ai endpoints: two tiers per medium (faster/lower cost vs flagship).
 * @see https://fal.ai/models
 */
export const FAL_IMAGE_STANDARD = "fal-ai/flux/schnell";
export const FAL_IMAGE_PREMIUM = "fal-ai/flux-2-pro";
/** Google Nano Banana 2 — image editing from one or more reference images + prompt (fal.ai). */
export const FAL_NANO_BANANA_EDIT = "fal-ai/nano-banana-2/edit";
export const FAL_VIDEO_STANDARD = "fal-ai/wan/v2.2-a14b/text-to-video";
export const FAL_VIDEO_PREMIUM = "fal-ai/kling-video/v3/pro/text-to-video";

export type ImageLayout =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export type VideoAspect = "16:9" | "9:16" | "1:1";
