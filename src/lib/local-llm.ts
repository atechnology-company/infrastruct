"use client";

import {
  buildGenerateQueriesUserPrompt,
  buildSearchSynthesisUserPrompt,
  GENERATE_QUERIES_SYSTEM,
  SEARCH_SYNTHESIS_SYSTEM,
} from "@/lib/prompts";
import { parseModelJson } from "@/lib/json-utils";
import {
  describeModelTier,
  getDeviceCapabilitySnapshot,
  getTransformersModelCandidates,
  type ModelTier,
} from "@/lib/device-capabilities";

export type LlmBackend = "prompt-api" | "transformers";

export type ModelLoadState = {
  status: "idle" | "checking" | "loading" | "ready" | "error";
  progress: number;
  message: string;
  backend: LlmBackend | null;
  modelId?: string;
  tier?: ModelTier;
  deviceMemoryGb?: number | null;
};

export { getDeviceCapabilitySnapshot, getTransformersModelCandidates };

type ProgressCallback = (state: ModelLoadState) => void;

type TextGenerator = (
  messages: { role: string; content: string }[],
  options?: { max_new_tokens?: number; temperature?: number },
) => Promise<{ generated_text?: { role: string; content: string }[] }>;

type LocalLlmInstance = {
  backend: LlmBackend;
  modelId?: string;
  tier?: ModelTier;
  deviceMemoryGb?: number | null;
  generate: (system: string, user: string) => Promise<string>;
};

let cachedLlm: LocalLlmInstance | null = null;

let initPromise: Promise<LocalLlmInstance> | null = null;

function hasLanguageModel(): boolean {
  return typeof window !== "undefined" && "LanguageModel" in window;
}

function extractTransformersText(output: unknown): string {
  if (!output || !Array.isArray(output)) return "";
  const first = output[0] as { generated_text?: unknown };
  const generated = first?.generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1] as { content?: string };
    return typeof last?.content === "string" ? last.content : String(last ?? "");
  }
  return String(generated ?? "");
}

async function tryPromptApi(onProgress?: ProgressCallback): Promise<{
  backend: LlmBackend;
  generate: (system: string, user: string) => Promise<string>;
} | null> {
  if (!hasLanguageModel()) return null;

  const availability = await LanguageModel.availability();
  if (availability === "unavailable") return null;

  onProgress?.({
    status: "loading",
    progress: availability === "available" ? 5 : 10,
    message: "Preparing built-in model (Chrome / Edge)...",
    backend: "prompt-api",
  });

  const warmup = await LanguageModel.create({
    monitor(m) {
      m.addEventListener("downloadprogress", (e: Event) => {
        const loaded = (e as ProgressEvent).loaded ?? 0;
        onProgress?.({
          status: "loading",
          progress: Math.min(95, Math.round(loaded * 100)),
          message: "Downloading on-device model...",
          backend: "prompt-api",
        });
      });
    },
  });
  warmup.destroy?.();

  return {
    backend: "prompt-api",
    async generate(system: string, user: string) {
      const runSession = await LanguageModel.create({
        initialPrompts: [{ role: "system", content: system }],
      });
      try {
        const result = await runSession.prompt(user);
        return typeof result === "string" ? result : String(result);
      } finally {
        runSession.destroy?.();
      }
    },
  };
}

async function loadTransformersGenerator(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<TextGenerator> {
  const { pipeline, env } = await import("@huggingface/transformers");

  env.allowLocalModels = false;
  env.useBrowserCache = true;

  onProgress?.({
    status: "loading",
    progress: 5,
    message: `Loading ${modelId}...`,
    backend: "transformers",
  });

  const device =
    typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";

  const generator = await pipeline("text-generation", modelId, {
    dtype: device === "webgpu" ? "q4f16" : "q4",
    device,
    progress_callback: (data: {
      status?: string;
      progress?: number;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (data.status === "progress" && data.progress != null) {
        onProgress?.({
          status: "loading",
          progress: Math.min(95, Math.round(data.progress)),
          message: data.file ? `Downloading ${data.file.split("/").pop()}` : "Downloading Qwen3.5-3B...",
          backend: "transformers",
        });
      } else if (data.status === "done") {
        onProgress?.({
          status: "loading",
          progress: 98,
          message: "Initializing model...",
          backend: "transformers",
        });
      }
    },
  });

  return generator as unknown as TextGenerator;
}

async function tryTransformers(onProgress?: ProgressCallback): Promise<LocalLlmInstance> {
  let lastError: unknown;
  const caps = getDeviceCapabilitySnapshot();
  const candidates = caps.modelCandidates;

  onProgress?.({
    status: "loading",
    progress: 1,
    message: describeModelTier(caps.tier, caps.deviceMemoryGb),
    backend: "transformers",
    tier: caps.tier,
    deviceMemoryGb: caps.deviceMemoryGb,
  });

  for (const modelId of candidates) {
    try {
      onProgress?.({
        status: "loading",
        progress: 2,
        message: `Loading ${modelId.split("/").pop()}...`,
        backend: "transformers",
        tier: caps.tier,
        deviceMemoryGb: caps.deviceMemoryGb,
      });

      const generator = await loadTransformersGenerator(modelId, onProgress);

      return {
        backend: "transformers",
        modelId,
        tier: caps.tier,
        deviceMemoryGb: caps.deviceMemoryGb,
        async generate(system: string, user: string) {
          const messages = [
            { role: "system", content: system },
            { role: "user", content: user },
          ];
          const output = await generator(messages, {
            max_new_tokens: 4096,
            temperature: 0.2,
          });
          return extractTransformersText(output);
        },
      };
    } catch (err) {
      lastError = err;
      console.warn(`[local-llm] Failed to load ${modelId}:`, err);
    }
  }

  throw lastError ?? new Error("Could not load any Qwen3.5 model in the browser");
}

export async function initializeLocalLlm(
  onProgress?: ProgressCallback,
): Promise<LocalLlmInstance> {
  if (cachedLlm) return cachedLlm;

  onProgress?.({
    status: "checking",
    progress: 0,
    message: "Checking for built-in AI...",
    backend: null,
  });

  const promptApi = await tryPromptApi(onProgress);
  if (promptApi) {
    cachedLlm = promptApi;
    onProgress?.({
      status: "ready",
      progress: 100,
      message: "Ready (built-in AI)",
      backend: "prompt-api",
    });
    return cachedLlm;
  }

  cachedLlm = await tryTransformers(onProgress);
  const label = cachedLlm.modelId?.split("/").pop() ?? "local model";
  onProgress?.({
    status: "ready",
    progress: 100,
    message: `Ready (${label})`,
    backend: "transformers",
    modelId: cachedLlm.modelId,
    tier: cachedLlm.tier,
    deviceMemoryGb: cachedLlm.deviceMemoryGb,
  });
  return cachedLlm;
}

export function getLocalLlm(): typeof cachedLlm {
  return cachedLlm;
}

export function ensureLocalLlm(onProgress?: ProgressCallback): Promise<LocalLlmInstance> {
  if (cachedLlm) return Promise.resolve(cachedLlm);
  if (!initPromise) {
    initPromise = initializeLocalLlm(onProgress);
  }
  return initPromise;
}

export async function localLlmGenerate(system: string, user: string): Promise<string> {
  const llm = await ensureLocalLlm();
  return llm.generate(system, user);
}

export async function generateSearchQueries(prompt: string) {
  const text = await localLlmGenerate(
    GENERATE_QUERIES_SYSTEM,
    buildGenerateQueriesUserPrompt(prompt),
  );
  return parseModelJson<{ queries: Record<string, { query: string; numResults: number }> }>(text);
}

export type SearchSynthesisResponse = {
  title?: string;
  sections?: Record<string, unknown>;
  conclusion?: string;
  conclusions?: { label: string; summary: string }[];
  sources?: unknown;
};

export async function synthesizeSearchResults(
  query: string,
  sources: { snippet?: string; religion?: string; title?: string; link?: string; engine?: string }[],
): Promise<SearchSynthesisResponse> {
  const text = await localLlmGenerate(
    SEARCH_SYNTHESIS_SYSTEM,
    buildSearchSynthesisUserPrompt(query, sources),
  );
  return parseModelJson<SearchSynthesisResponse>(text);
}
