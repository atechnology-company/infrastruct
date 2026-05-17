export type ModelTier = "low" | "medium" | "high";

export const TRANSFORMERS_MODELS = {
  gemmaSmall: "onnx-community/gemma-4-E2B-it-ONNX",
  gemmaLarge: "onnx-community/gemma-4-E4B-it-ONNX",
  phi4: "onnx-community/Phi-4-mini-instruct-ONNX-GQA",
  phi4Alt: "onnx-community/Phi-4-mini-instruct-ONNX-MHA",
} as const;

const TIER_MODEL_ORDER: Record<ModelTier, readonly string[]> = {
  low: [TRANSFORMERS_MODELS.gemmaSmall, TRANSFORMERS_MODELS.phi4],
  medium: [TRANSFORMERS_MODELS.gemmaSmall, TRANSFORMERS_MODELS.phi4, TRANSFORMERS_MODELS.phi4Alt],
  high: [
    TRANSFORMERS_MODELS.gemmaLarge,
    TRANSFORMERS_MODELS.gemmaSmall,
    TRANSFORMERS_MODELS.phi4,
    TRANSFORMERS_MODELS.phi4Alt,
  ],
};

export function isGemma4Model(modelId: string): boolean {
  return modelId.includes("gemma-4");
}

export function readDeviceMemoryGb(): number | null {
  if (typeof navigator === "undefined") return null;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && Number.isFinite(memory) && memory > 0) {
    return memory;
  }
  return null;
}

export function inferModelTierFromSignals(signals: {
  deviceMemoryGb: number | null;
  hardwareConcurrency?: number;
  hasWebGpu?: boolean;
}): ModelTier {
  const { deviceMemoryGb, hardwareConcurrency = 4, hasWebGpu = false } = signals;

  if (deviceMemoryGb != null) {
    if (deviceMemoryGb <= 4) return "low";
    if (deviceMemoryGb <= 8) return "medium";
    return "high";
  }

  if (!hasWebGpu && hardwareConcurrency <= 4) return "low";
  if (hasWebGpu && hardwareConcurrency >= 8) return "high";
  return "medium";
}

export function getDeviceCapabilitySnapshot(): {
  deviceMemoryGb: number | null;
  hardwareConcurrency: number;
  hasWebGpu: boolean;
  tier: ModelTier;
  modelCandidates: string[];
} {
  const deviceMemoryGb = readDeviceMemoryGb();
  const hardwareConcurrency =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const tier = inferModelTierFromSignals({
    deviceMemoryGb,
    hardwareConcurrency,
    hasWebGpu,
  });

  return {
    deviceMemoryGb,
    hardwareConcurrency,
    hasWebGpu,
    tier,
    modelCandidates: [...TIER_MODEL_ORDER[tier]],
  };
}

export function getTransformersModelCandidates(tier?: ModelTier): string[] {
  const resolved = tier ?? getDeviceCapabilitySnapshot().tier;
  return [...TIER_MODEL_ORDER[resolved]];
}

export function describeModelTier(
  tier: ModelTier,
  deviceMemoryGb: number | null,
): string {
  const ram =
    deviceMemoryGb != null
      ? `~${deviceMemoryGb} GB device RAM detected`
      : "device RAM unknown (using CPU/GPU hints)";

  const model =
    tier === "low"
      ? "Gemma 4 E2B"
      : tier === "medium"
        ? "Gemma 4 E2B"
        : "Gemma 4 E4B";

  return `${ram} — loading ${model}`;
}
