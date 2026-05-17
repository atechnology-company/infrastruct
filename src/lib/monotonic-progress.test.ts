import { describe, expect, test } from "bun:test";
import { wrapMonotonicModelProgress } from "./monotonic-progress";
import type { ModelLoadState } from "./local-llm";

describe("wrapMonotonicModelProgress", () => {
  test("never decreases loading progress", () => {
    const seen: number[] = [];
    const emit = wrapMonotonicModelProgress((s) => {
      if (s.status === "loading") seen.push(s.progress);
    });

    emit({ status: "checking", progress: 0, message: "", backend: null });
    emit({ status: "loading", progress: 40, message: "", backend: "transformers" });
    emit({ status: "loading", progress: 2, message: "", backend: "transformers" });
    emit({ status: "loading", progress: 55, message: "", backend: "transformers" });

    expect(seen).toEqual([40, 40, 55]);
  });
});
