import { describe, expect, test } from "bun:test";
import { createDownloadProgressTracker } from "./download-progress";

describe("createDownloadProgressTracker", () => {
  test("aggregates parallel file bytes into monotonic overall progress", () => {
    let lastProgress = 0;
    const track = createDownloadProgressTracker((s) => {
      expect(s.progress).toBeGreaterThanOrEqual(lastProgress);
      lastProgress = s.progress;
    });

    track({
      status: "progress",
      file: "onnx/model_a.onnx",
      loaded: 50,
      total: 100,
      progress: 50,
    });
    track({
      status: "progress",
      file: "onnx/model_b.onnx",
      loaded: 25,
      total: 100,
      progress: 25,
    });
    track({
      status: "progress_total",
      files: {
        "onnx/model_a.onnx": { loaded: 100, total: 100 },
        "onnx/model_b.onnx": { loaded: 50, total: 100 },
      },
      progress: 75,
    });

    expect(lastProgress).toBe(75);
  });
});
