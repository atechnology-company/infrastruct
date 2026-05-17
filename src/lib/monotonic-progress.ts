import type { ModelLoadState } from "@/lib/local-llm";

export function wrapMonotonicModelProgress(
  onProgress?: (state: ModelLoadState) => void,
): (state: ModelLoadState) => void {
  let peak = 0;

  return (state) => {
    if (!onProgress) return;

    if (state.status === "idle") {
      peak = 0;
      onProgress(state);
      return;
    }

    if (state.status === "checking") {
      peak = state.progress;
      onProgress(state);
      return;
    }

    if (state.status === "ready") {
      onProgress({ ...state, progress: 100 });
      return;
    }

    if (state.status === "error") {
      onProgress(state);
      return;
    }

    peak = Math.max(peak, state.progress);
    onProgress({ ...state, progress: peak });
  };
}
