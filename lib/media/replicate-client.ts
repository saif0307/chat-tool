const REPLICATE_API = "https://api.replicate.com/v1";
const POLL_MS = 3000;
const MAX_POLL_MS = 8 * 60 * 1000;

export function getReplicateToken(): string | undefined {
  return process.env.REPLICATE_API_TOKEN?.trim();
}

type Prediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
  detail?: string;
};

/** Replicate only accepts Prefer: wait between 1 and 60 seconds. */
function clampPreferWait(seconds: number): number {
  return Math.min(60, Math.max(1, Math.round(seconds)));
}

function authHeaders(token: string, preferWait?: number): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (preferWait != null) {
    headers.Prefer = `wait=${clampPreferWait(preferWait)}`;
  }
  return headers;
}

function extractMediaUrl(output: unknown): string | null {
  if (typeof output === "string" && output.length > 0) return output;
  if (Array.isArray(output)) {
    const first = output.find((x) => typeof x === "string" && x.length > 0);
    return typeof first === "string" ? first : null;
  }
  if (output && typeof output === "object" && "url" in output) {
    const url = (output as { url?: unknown }).url;
    if (typeof url === "string" && url.length > 0) return url;
  }
  return null;
}

async function getPrediction(
  token: string,
  id: string,
): Promise<Prediction> {
  const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as Prediction & {
    title?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(json.detail || json.error || `HTTP ${res.status}`);
  }
  return json;
}

async function pollPrediction(
  token: string,
  id: string,
): Promise<Prediction> {
  const started = Date.now();
  let prediction = await getPrediction(token, id);

  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled"
  ) {
    if (Date.now() - started > MAX_POLL_MS) {
      throw new Error("Replicate prediction timed out.");
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
    prediction = await getPrediction(token, id);
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(prediction.error || "Replicate prediction failed.");
  }

  return prediction;
}

export async function runReplicateModel(
  model: string,
  input: Record<string, unknown>,
  options?: { preferWaitSeconds?: number },
): Promise<string> {
  const token = getReplicateToken();
  if (!token) {
    throw new Error("Media tools are not configured (missing REPLICATE_API_TOKEN).");
  }

  const preferWait = options?.preferWaitSeconds;
  const createRes = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: authHeaders(token, preferWait),
    body: JSON.stringify({ input }),
  });

  let prediction = (await createRes.json()) as Prediction;

  if (!createRes.ok) {
    throw new Error(
      prediction.detail ||
        prediction.error ||
        `Replicate request failed (HTTP ${createRes.status})`,
    );
  }

  if (prediction.status !== "succeeded" && prediction.id) {
    prediction = await pollPrediction(token, prediction.id);
  }

  const url = extractMediaUrl(prediction.output);
  if (!url) {
    throw new Error("Replicate returned no media URL.");
  }

  return url;
}

export async function replicateGenerateImage(params: {
  tier: "standard" | "premium";
  prompt: string;
  aspect_ratio: string;
}): Promise<string> {
  const model =
    params.tier === "premium"
      ? "black-forest-labs/flux-2-pro"
      : "black-forest-labs/flux-schnell";

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspect_ratio,
    output_format: params.tier === "premium" ? "png" : "webp",
  };

  if (params.tier === "standard") {
    input.num_outputs = 1;
    input.go_fast = true;
  } else {
    input.output_quality = 90;
    input.safety_tolerance = 2;
  }

  return runReplicateModel(model, input, { preferWaitSeconds: 60 });
}

export async function replicateEditImage(params: {
  prompt: string;
  imageUrl: string;
  imageUrls?: string[];
}): Promise<string> {
  const images =
    params.imageUrls?.filter((u) => u.trim()).length
      ? params.imageUrls!.filter((u) => u.trim())
      : [params.imageUrl];

  return runReplicateModel(
    "google/nano-banana-2",
    {
      prompt: params.prompt,
      image_input: images.slice(0, 14),
      aspect_ratio: "match_input_image",
      resolution: "1K",
      output_format: "png",
    },
    { preferWaitSeconds: 60 },
  );
}

export async function replicateExtendVideo(params: {
  tier: "standard" | "premium";
  prompt: string;
  videoUrl: string;
  duration_seconds: number;
}): Promise<string> {
  const model =
    params.tier === "premium"
      ? "bytedance/seedance-2.0"
      : "bytedance/seedance-2.0-fast";

  const continuationPrompt = params.prompt.includes("[Video1]")
    ? params.prompt
    : `Continue [Video1]: ${params.prompt}`;

  return runReplicateModel(model, {
    prompt: continuationPrompt,
    reference_videos: [params.videoUrl],
    duration: params.duration_seconds,
    resolution: params.tier === "premium" ? "720p" : "720p",
    aspect_ratio: "adaptive",
    generate_audio: true,
  });
}

export async function replicateGenerateVideo(params: {
  tier: "standard" | "premium";
  prompt: string;
  aspect_ratio: string;
  duration_seconds: number;
}): Promise<string> {
  if (params.tier === "premium") {
    return runReplicateModel(
      "kwaivgi/kling-v3-video",
      {
        prompt: params.prompt,
        mode: "pro",
        aspect_ratio: params.aspect_ratio,
        duration: params.duration_seconds,
        generate_audio: true,
      },
    );
  }

  return runReplicateModel(
    "bytedance/seedance-2.0-fast",
    {
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio,
      duration: params.duration_seconds,
      resolution: "720p",
      generate_audio: true,
    },
  );
}
