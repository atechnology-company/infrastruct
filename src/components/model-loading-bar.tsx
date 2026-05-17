"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ModelLoadState } from "@/lib/local-llm";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";

const MAX_VISIBLE_FILES = 10;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  const loading = loadState.status === "checking" || loadState.status === "loading";
  const smoothProgress = useSmoothProgress(loadState.progress, loading && show);

  const displayPercent = loadState.status === "error" ? 100 : smoothProgress;

  const fileSummary = useMemo(() => {
    const files = loadState.files ?? [];
    const active = files.filter((f) => f.status !== "done").length;
    const done = files.filter((f) => f.status === "done").length;
    if (files.length === 0) return null;
    return { total: files.length, active, done };
  }, [loadState.files]);

  const visibleFiles = useMemo(() => {
    const files = loadState.files ?? [];
    return files.slice(0, MAX_VISIBLE_FILES);
  }, [loadState.files]);

  const hiddenCount = Math.max(0, (loadState.files?.length ?? 0) - MAX_VISIBLE_FILES);

  const loadedBytes = loadState.loadedBytes;
  const totalBytes = loadState.totalBytes;

  const byteHint =
    loadedBytes != null && totalBytes != null && totalBytes > 0
      ? `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`
      : fileSummary
        ? `${fileSummary.done} of ${fileSummary.total} files ready`
        : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="w-full"
        >
          <motion.div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-1.5">
            <span className="truncate">
              {loadState.status === "error"
                ? loadState.message
                : loadState.message || "Loading AI model…"}
            </span>
            {loadState.status !== "error" && (
              <span className="tabular-nums shrink-0">{Math.round(displayPercent)}%</span>
            )}
          </motion.div>

          <div
            className="h-1 w-full rounded-full bg-gray-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className={`h-full rounded-full ${
                loadState.status === "error"
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500"
              }`}
              initial={false}
              animate={{ width: `${Math.max(2, displayPercent)}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>

          {byteHint && loadState.status !== "error" && (
            <p className="mt-2 text-[10px] text-gray-600 tabular-nums">{byteHint}</p>
          )}

          {loadState.status !== "error" && visibleFiles.length > 0 && (
            <ul className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
              {visibleFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 text-[10px] text-gray-600 font-mono"
                >
                  <span className="truncate">{file.label}</span>
                  <span className="shrink-0 text-gray-500">
                    {file.status === "done"
                      ? "done"
                      : file.total > 0
                        ? `${Math.round(file.progress)}%`
                        : "…"}
                  </span>
                </li>
              ))}
              {hiddenCount > 0 && (
                <li className="text-[10px] text-gray-600">+{hiddenCount} more files</li>
              )}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
