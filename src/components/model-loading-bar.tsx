"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ModelLoadState } from "@/lib/local-llm";

const MAX_VISIBLE_FILES = 8;

function ProgressTrack({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const width = `${Math.max(2, Math.min(100, value))}%`;
  return (
    <motion.div
      className={`h-0.5 w-full rounded-full bg-gray-800 overflow-hidden ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${barClassName ?? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500"}`}
        style={{ width }}
      />
    </motion.div>
  );
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

  const activeFiles = useMemo(() => {
    const files = loadState.files ?? [];
    const inFlight = files.filter((f) => f.status !== "done");
    const list = inFlight.length > 0 ? inFlight : files;
    return list.slice(0, MAX_VISIBLE_FILES);
  }, [loadState.files]);

  const hiddenCount = useMemo(() => {
    const total = loadState.files?.length ?? 0;
    return Math.max(0, total - MAX_VISIBLE_FILES);
  }, [loadState.files]);

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
          <motion.div
            className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-1.5"
            layout
          >
            <span className="truncate">
              {loadState.status === "error"
                ? loadState.message
                : loadState.message || "Loading AI model…"}
            </span>
            {loadState.status !== "error" && (
              <span className="tabular-nums shrink-0">{Math.round(loadState.progress)}%</span>
            )}
          </motion.div>

          <ProgressTrack
            value={loadState.status === "error" ? 100 : loadState.progress}
            barClassName={
              loadState.status === "error"
                ? "bg-red-500"
                : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500"
            }
          />

          {loadState.status !== "error" && activeFiles.length > 0 && (
            <motion.ul
              className="mt-3 space-y-2"
              layout
              initial={false}
            >
              {activeFiles.map((file) => (
                <motion.li
                  key={file.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <motion.div
                    className="flex items-center justify-between gap-2 text-[10px] text-gray-600"
                    layout
                  >
                    <span className="truncate font-mono">{file.label}</span>
                    <span className="tabular-nums shrink-0">
                      {file.total > 0
                        ? `${Math.round(file.progress)}%`
                        : file.status === "pending"
                          ? "…"
                          : ""}
                    </span>
                  </motion.div>
                  <ProgressTrack
                    value={file.progress}
                    barClassName={
                      file.status === "done"
                        ? "bg-gray-600"
                        : "bg-gray-600/80 bg-gradient-to-r from-violet-600/70 via-fuchsia-600/70 to-amber-600/70"
                    }
                  />
                </motion.li>
              ))}
              {hiddenCount > 0 && (
                <li className="text-[10px] text-gray-600 pl-0.5">
                  +{hiddenCount} more file{hiddenCount === 1 ? "" : "s"}
                </li>
              )}
            </motion.ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
