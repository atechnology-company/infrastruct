import { describe, expect, test } from "bun:test";
import {
  inferModelTierFromSignals,
  getTransformersModelCandidates,
  TRANSFORMERS_MODELS,
} from "./device-capabilities";

describe("inferModelTierFromSignals", () => {
  test("uses deviceMemory when available", () => {
    expect(
      inferModelTierFromSignals({ deviceMemoryGb: 2, hardwareConcurrency: 8, hasWebGpu: true }),
    ).toBe("low");
    expect(
      inferModelTierFromSignals({ deviceMemoryGb: 4, hardwareConcurrency: 8, hasWebGpu: true }),
    ).toBe("low");
    expect(
      inferModelTierFromSignals({ deviceMemoryGb: 8, hardwareConcurrency: 4, hasWebGpu: false }),
    ).toBe("medium");
    expect(
      inferModelTierFromSignals({ deviceMemoryGb: 16, hardwareConcurrency: 4, hasWebGpu: false }),
    ).toBe("high");
  });

  test("falls back to CPU/GPU hints when RAM is unknown", () => {
    expect(
      inferModelTierFromSignals({
        deviceMemoryGb: null,
        hardwareConcurrency: 4,
        hasWebGpu: false,
      }),
    ).toBe("low");
    expect(
      inferModelTierFromSignals({
        deviceMemoryGb: null,
        hardwareConcurrency: 12,
        hasWebGpu: true,
      }),
    ).toBe("high");
    expect(
      inferModelTierFromSignals({
        deviceMemoryGb: null,
        hardwareConcurrency: 6,
        hasWebGpu: true,
      }),
    ).toBe("medium");
  });
});

describe("getTransformersModelCandidates", () => {
  test("returns tier-appropriate model order", () => {
    expect(getTransformersModelCandidates("low")[0]).toBe(TRANSFORMERS_MODELS.gemmaSmall);
    expect(getTransformersModelCandidates("medium")[0]).toBe(TRANSFORMERS_MODELS.gemmaSmall);
    expect(getTransformersModelCandidates("high")[0]).toBe(TRANSFORMERS_MODELS.gemmaLarge);
    expect(getTransformersModelCandidates("high")[1]).toBe(TRANSFORMERS_MODELS.gemmaSmall);
  });
});
