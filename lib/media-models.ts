/**
 * Curated Replicate models — two tiers for generation; single edit model; extend via Seedance.
 * @see https://replicate.com/collections/text-to-video
 */
export const REPLICATE_IMAGE_STANDARD = "black-forest-labs/flux-schnell";
export const REPLICATE_IMAGE_PREMIUM = "black-forest-labs/flux-2-pro";
export const REPLICATE_EDIT = "google/nano-banana-2";
export const REPLICATE_VIDEO_STANDARD = "bytedance/seedance-2.0-fast";
export const REPLICATE_VIDEO_PREMIUM = "kwaivgi/kling-v3-video";
export const REPLICATE_VIDEO_EXTEND_STANDARD = "bytedance/seedance-2.0-fast";
export const REPLICATE_VIDEO_EXTEND_PREMIUM = "bytedance/seedance-2.0";

export type ImageLayout =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export type VideoAspect = "16:9" | "9:16" | "1:1";

/** Map layout presets to Replicate `aspect_ratio` strings. */
export function imageLayoutToAspectRatio(layout: ImageLayout): string {
  switch (layout) {
    case "portrait_16_9":
      return "9:16";
    case "portrait_4_3":
      return "3:4";
    case "square_hd":
    case "square":
      return "1:1";
    case "landscape_4_3":
      return "4:3";
    case "landscape_16_9":
    default:
      return "16:9";
  }
}

export function videoAspectForReplicate(aspect: VideoAspect): VideoAspect {
  return aspect;
}

export function clampVideoDuration(seconds: number): number {
  return Math.min(15, Math.max(3, Math.round(seconds)));
}
