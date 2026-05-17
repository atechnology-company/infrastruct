"use client";

import {
  buildGenerateQueriesUserPrompt,
  buildSearchSynthesisUserPrompt,
  GENERATE_QUERIES_SYSTEM,
  SEARCH_SYNTHESIS_SYSTEM,
} from "@/lib/prompts";
import { parseModelJson } from "@/lib/json-utils";
import {
  createDownloadProgressTracker,
  createPromptApiProgressTracker,
  type ModelFileProgress,
} from "@/lib/download-progress";
import {
  detectRefusalInParsed,
  detectRefusalInText,
  QueryGenerationError,
} from "@/lib/llm-errors";
import {
  normalizeSearchQueries,
  validateSearchQueries,
} from "@/lib/validate-queries";

export { QueryGenerationError } from "@/lib/llm-errors";
export { userMessageForQueryError } from "@/lib/llm-errors";
import {
  describeModelTier,
  getDeviceCapabilitySnapshot,
  getTransformersModelCandidates,
  isGemma4Model,
  type ModelTier,
} from "@/lib/device-capabilities";

export type LlmBackend = "prompt-api" | "transformers";

export type { ModelFileProgress };

export type ModelLoadState = {
  status: "idle" | "checking" | "loading" | "ready" | "error";
  progress: number;
  message: string;
  backend: LlmBackend | null;
  modelId?: string;
  tier?: ModelTier;
  deviceMemoryGb?: number | null;
  files?: ModelFileProgress[];
  loadedBytes?: number;
  totalBytes?: number;
};

export { getDeviceCapabilitySnapshot, getTransformersModelCandidates };

type ProgressCallback = (state: ModelLoadState) => void;

type TextGenerator = (
  messages: { role: string; content: string }[],
  options?: { max_new_tokens?: number; temperature?: number },
) => Promise<{ generated_text?: { role: string; content: string }[] }>;

export type LlmGenerateOptions = {
  max_new_tokens?: number;
};

type LocalLlmInstance = {
  backend: LlmBackend;
  modelId?: string;
  tier?: ModelTier;
  deviceMemoryGb?: number | null;
  generate: (system: string, user: string, options?: LlmGenerateOptions) => Promise<string>;
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
  generate: (system: string, user: string, options?: LlmGenerateOptions) => Promise<string>;
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

  const trackPrompt = createPromptApiProgressTracker(({ progress, message, loadedBytes, totalBytes }) => {
    onProgress?.({
      status: "loading",
      progress,
      message,
      files: [],
      loadedBytes,
      totalBytes,
      backend: "prompt-api",
    });
  });

  const warmup = await LanguageModel.create({
    outputLanguage: "en",
    monitor(m) {
      m.addEventListener("downloadprogress", (e: Event) => {
        trackPrompt((e as ProgressEvent).loaded ?? 0);
      });
    },
  } as LanguageModelCreateOptions);
  warmup.destroy?.();

  return {
    backend: "prompt-api",
    async generate(system: string, user: string) {
      const runSession = await LanguageModel.create({
        outputLanguage: "en",
        initialPrompts: [{ role: "system", content: system }],
      } as LanguageModelCreateOptions);
      try {
        const result = await runSession.prompt(user);
        return typeof result === "string" ? result : String(result);
      } finally {
        runSession.destroy?.();
      }
    },
  };
}

function transformersProgressCallback(onProgress?: ProgressCallback) {
  const track = createDownloadProgressTracker(({ progress, message, files, loadedBytes, totalBytes }) => {
    onProgress?.({
      status: "loading",
      progress,
      message,
      files,
      loadedBytes,
      totalBytes,
      backend: "transformers",
    });
  });
  return track;
}

async function configureTransformersEnv() {
  const { env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  return typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
}

async function loadPhi4Generator(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<TextGenerator> {
  const { pipeline } = await import("@huggingface/transformers");
  const device = await configureTransformersEnv();

  onProgress?.({
    status: "loading",
    progress: 5,
    message: `Loading ${modelId}...`,
    backend: "transformers",
  });

  const generator = await pipeline("text-generation", modelId, {
    dtype: device === "webgpu" ? "q4f16" : "q4",
    device,
    progress_callback: transformersProgressCallback(onProgress),
  });

  return generator as unknown as TextGenerator;
}

async function loadGemma4Generator(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<(system: string, user: string, options?: LlmGenerateOptions) => Promise<string>> {
  const { AutoProcessor, Gemma4ForConditionalGeneration } = await import(
    "@huggingface/transformers"
  );
  const device = await configureTransformersEnv();
  const progress_callback = transformersProgressCallback(onProgress);

  onProgress?.({
    status: "loading",
    progress: 5,
    message: `Loading ${modelId}...`,
    backend: "transformers",
  });

  const processor = await AutoProcessor.from_pretrained(modelId, { progress_callback });
  const model = await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
    dtype: device === "webgpu" ? "q4f16" : "q4",
    device,
    progress_callback,
  });

  return async (system: string, user: string, options?: LlmGenerateOptions) => {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const prompt = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
    } as Parameters<typeof processor.apply_chat_template>[1]);
    const inputs = await processor(prompt, undefined, undefined, {
      add_special_tokens: false,
    });
    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: options?.max_new_tokens ?? 4096,
      do_sample: false,
    } as Parameters<typeof model.generate>[0]);
    const sequences =
      outputs && typeof outputs === "object" && "sequences" in outputs
        ? (outputs as { sequences: import("@huggingface/transformers").Tensor }).sequences
        : (outputs as import("@huggingface/transformers").Tensor);
    const promptLen = inputs.input_ids.dims.at(-1) ?? 0;
    const decoded = processor.batch_decode(sequences.slice(null, [promptLen, null]), {
      skip_special_tokens: true,
    });
    return decoded[0] ?? "";
  };
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

      const generate = isGemma4Model(modelId)
        ? await loadGemma4Generator(modelId, onProgress)
        : await (async () => {
            const generator = await loadPhi4Generator(modelId, onProgress);
            return async (system: string, user: string, options?: LlmGenerateOptions) => {
              const messages = [
                { role: "system", content: system },
                { role: "user", content: user },
              ];
              const output = await generator(messages, {
                max_new_tokens: options?.max_new_tokens ?? 4096,
                temperature: 0.2,
              });
              return extractTransformersText(output);
            };
          })();

      return {
        backend: "transformers",
        modelId,
        tier: caps.tier,
        deviceMemoryGb: caps.deviceMemoryGb,
        generate,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[local-llm] Failed to load ${modelId}:`, err);
    }
  }

  throw lastError ?? new Error("Could not load any browser AI model");
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

export async function localLlmGenerate(
  system: string,
  user: string,
  options?: LlmGenerateOptions,
): Promise<string> {
  const llm = await ensureLocalLlm();
  return llm.generate(system, user, options);
}

const QUERY_GEN_TIMEOUT_MS = 90_000;
const QUERY_GEN_MAX_TOKENS = 768;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function generateSearchQueries(
  prompt: string,
  _enabledReligions?: Partial<Record<string, boolean>>,
) {
  await ensureLocalLlm();

  let text: string;
  try {
    text = await withTimeout(
      localLlmGenerate(
        GENERATE_QUERIES_SYSTEM,
        buildGenerateQueriesUserPrompt(prompt),
        { max_new_tokens: QUERY_GEN_MAX_TOKENS },
      ),
      QUERY_GEN_TIMEOUT_MS,
      "Query generation",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/timed out/i.test(message)) {
      throw new QueryGenerationError("timeout", message);
    }
    throw new QueryGenerationError("model", message);
  }

  const textRefusal = detectRefusalInText(text);
  if (textRefusal) {
    throw new QueryGenerationError("refusal", textRefusal);
  }

  let parsed: unknown;
  try {
    parsed = parseModelJson(text);
  } catch {
    const refusal = detectRefusalInText(text);
    if (refusal) {
      throw new QueryGenerationError("refusal", refusal);
    }
    throw new QueryGenerationError(
      "parse",
      "The model did not return valid JSON for search queries.",
    );
  }

  const jsonRefusal = detectRefusalInParsed(parsed);
  if (jsonRefusal) {
    throw new QueryGenerationError("refusal", jsonRefusal);
  }

  if (!validateSearchQueries(parsed)) {
    throw new QueryGenerationError(
      "parse",
      "The model returned search queries in an unexpected format.",
    );
  }

  return normalizeSearchQueries(parsed);
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
