"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ensureLocalLlm,
  type ModelLoadState,
} from "@/lib/local-llm";

const initialState: ModelLoadState = {
  status: "idle",
  progress: 0,
  message: "",
  backend: null,
};

export function useLocalLlm() {
  const [loadState, setLoadState] = useState<ModelLoadState>(initialState);

  const onProgress = useCallback((state: ModelLoadState) => {
    setLoadState(state);
  }, []);

  useEffect(() => {
    let cancelled = false;

    ensureLocalLlm((state) => {
      if (!cancelled) onProgress(state);
    }).catch((err) => {
      if (!cancelled) {
        setLoadState({
          status: "error",
          progress: 0,
          message: err instanceof Error ? err.message : "Failed to load AI model",
          backend: null,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [onProgress]);

  const isReady = loadState.status === "ready";
  const isLoading =
    loadState.status === "checking" || loadState.status === "loading";

  return { loadState, isReady, isLoading };
}
