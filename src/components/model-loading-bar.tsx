"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ModelLoadState } from "@/lib/local-llm";

export function ModelLoadingBar({
  loadState,
  visible,
}: {
  loadState: ModelLoadState;
  visible: boolean;
}) {
  const show =
    visible &&
    (loadState.status === "checking" ||
      loadState.status === "loading" ||
      loadState.status === "error");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="absolute left-0 right-0 top-full mt-3"
        >
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-1.5">
            <span className="truncate">
              {loadState.status === "error"
                ? loadState.message
                : loadState.message || "Loading AI model..."}
            </span>
            {loadState.status !== "error" && (
              <span className="tabular-nums shrink-0">{Math.round(loadState.progress)}%</span>
            )}
          </div>
          <div
            className="h-0.5 w-full rounded-full bg-gray-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={loadState.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className={`h-full rounded-full ${
                loadState.status === "error"
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500"
              }`}
              initial={{ width: 0 }}
              animate={{
                width:
                  loadState.status === "error"
                    ? "100%"
                    : `${Math.max(loadState.progress, 2)}%`,
              }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
