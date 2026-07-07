/**
 * Smoke-test REPLICATE_API_TOKEN from chat/.env
 * Run: npm run test:media-keys
 * Optional: npm run test:media-image  (flux-schnell generation)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "..", ".env");
const generateImage = process.argv.includes("--generate-image");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${filePath}`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function maskKey(key) {
  if (!key) return "(missing)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`;
}

function ok(label, detail) {
  console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`✗ ${label}: ${msg}`);
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.trim().slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Non-JSON response (HTTP ${res.status}): ${snippet || "(empty)"}`,
    );
  }
}

async function pollPrediction(token, id, maxMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const prediction = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(
        prediction.detail || prediction.error || `HTTP ${res.status}`,
      );
    }
    if (
      prediction.status === "succeeded" ||
      prediction.status === "failed" ||
      prediction.status === "canceled"
    ) {
      return prediction;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Prediction timed out while polling.");
}

async function testReplicate(token) {
  console.log("\n— Replicate —");
  console.log(`  Token: ${maskKey(token)}`);

  if (!token.startsWith("r8_")) {
    console.warn("  ⚠ Replicate tokens usually start with r8_");
  }

  const accountRes = await fetch("https://api.replicate.com/v1/account", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (accountRes.status === 401 || accountRes.status === 403) {
    throw new Error(
      `Auth failed (HTTP ${accountRes.status}) — check REPLICATE_API_TOKEN`,
    );
  }

  if (!accountRes.ok) {
    let detail = `HTTP ${accountRes.status}`;
    try {
      const json = await accountRes.json();
      detail = json.detail || json.title || json.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const account = await accountRes.json();
  const who =
    account.username ||
    account.name ||
    account.type ||
    "authenticated account";
  ok("Account", `${account.type ?? "account"} · ${who}`);

  if (!generateImage) {
    console.log("  (Pass --generate-image to run flux-schnell smoke test)");
    return;
  }

  const createRes = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt:
            "API smoke test: simple red circle on white background, flat design",
          aspect_ratio: "1:1",
          num_outputs: 1,
          output_format: "png",
          go_fast: true,
        },
      }),
    },
  );

  let prediction = await parseJsonResponse(createRes);

  if (!createRes.ok) {
    const detail =
      prediction.detail ||
      prediction.title ||
      prediction.message ||
      `HTTP ${createRes.status}`;
    throw new Error(`Image generation failed: ${detail}`);
  }

  if (prediction.status !== "succeeded" && prediction.id) {
    prediction = await pollPrediction(token, prediction.id);
  }

  if (prediction.status === "failed") {
    throw new Error(prediction.error || "Prediction failed");
  }

  const output = prediction.output;
  const imageUrl = Array.isArray(output) ? output[0] : output;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error(
      `No image URL in output (status=${prediction.status ?? "unknown"})`,
    );
  }

  ok(
    "flux-schnell (standard tier)",
    `status=${prediction.status}, url=${imageUrl.slice(0, 72)}…`,
  );
}

async function main() {
  loadEnvFile(ENV_PATH);
  const token = process.env.REPLICATE_API_TOKEN?.trim();

  console.log("Replicate API smoke test");
  console.log(`Env file: ${ENV_PATH}`);

  if (!token) {
    fail("Replicate", "REPLICATE_API_TOKEN is not set");
    process.exit(1);
  }

  try {
    await testReplicate(token);
    console.log("\nAll checks passed.");
    process.exit(0);
  } catch (e) {
    fail("Replicate", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
