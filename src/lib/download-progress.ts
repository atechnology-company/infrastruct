export type ModelFileProgress = {
  id: string;
  label: string;
  progress: number;
  loaded: number;
  total: number;
  status: "pending" | "downloading" | "done";
};

export type DownloadProgressSnapshot = {
  progress: number;
  message: string;
  files: ModelFileProgress[];
};

type TransformersProgressEvent = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  files?: Record<string, { loaded: number; total: number }>;
};

function fileLabel(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  return name.length > 48 ? `…${name.slice(-45)}` : name;
}

function fileProgress(loaded: number, total: number, reported?: number): number {
  if (total > 0) return Math.min(100, (loaded / total) * 100);
  if (reported != null) return Math.min(100, reported);
  return 0;
}

function aggregateBytes(files: ModelFileProgress[]): { loaded: number; total: number } {
  let loaded = 0;
  let total = 0;
  for (const f of files) {
    if (f.total > 0) {
      loaded += Math.min(f.loaded, f.total);
      total += f.total;
    }
  }
  return { loaded, total };
}

export function createDownloadProgressTracker(
  onUpdate: (snapshot: DownloadProgressSnapshot) => void,
): (data: TransformersProgressEvent) => void {
  const files = new Map<string, ModelFileProgress>();
  let peakProgress = 0;

  const emit = (message: string, floorProgress?: number) => {
    const list = [...files.values()].sort((a, b) => {
      if (a.status !== b.status) {
        const order = { downloading: 0, pending: 1, done: 2 };
        return order[a.status] - order[b.status];
      }
      return a.label.localeCompare(b.label);
    });

    const { loaded, total } = aggregateBytes(list);
    let overall =
      total > 0 ? (loaded / total) * 100 : floorProgress ?? peakProgress;

    if (floorProgress != null) {
      overall = Math.max(overall, floorProgress);
    }

    peakProgress = Math.max(peakProgress, overall);
    const progress = Math.min(95, Math.round(peakProgress));

    onUpdate({ progress, message, files: list });
  };

  return (data: TransformersProgressEvent) => {
    if (data.status === "progress_total" && data.files) {
      for (const [path, entry] of Object.entries(data.files)) {
        const loaded = entry.loaded ?? 0;
        const total = entry.total ?? 0;
        files.set(path, {
          id: path,
          label: fileLabel(path),
          progress: fileProgress(loaded, total),
          loaded,
          total,
          status: total > 0 && loaded >= total ? "done" : "downloading",
        });
      }
      emit("Downloading model files…");
      return;
    }

    if (data.status === "progress" && data.file) {
      const loaded = data.loaded ?? 0;
      const total = data.total ?? 0;
      files.set(data.file, {
        id: data.file,
        label: fileLabel(data.file),
        progress: fileProgress(loaded, total, data.progress),
        loaded,
        total,
        status: total > 0 && loaded >= total ? "done" : "downloading",
      });
      emit("Downloading model files…");
      return;
    }

    if ((data.status === "initiate" || data.status === "download") && data.file) {
      const existing = files.get(data.file);
      files.set(data.file, {
        id: data.file,
        label: fileLabel(data.file),
        progress: existing?.progress ?? 0,
        loaded: existing?.loaded ?? 0,
        total: existing?.total ?? 0,
        status: "pending",
      });
      emit("Downloading model files…");
      return;
    }

    if (data.status === "done" && data.file) {
      const existing = files.get(data.file);
      const total = existing?.total ?? 0;
      files.set(data.file, {
        id: data.file,
        label: fileLabel(data.file),
        progress: 100,
        loaded: total > 0 ? total : existing?.loaded ?? 0,
        total,
        status: "done",
      });
      emit("Downloading model files…");
      return;
    }

    if (data.status === "done") {
      emit("Initializing model…", 98);
    }
  };
}

export function createPromptApiProgressTracker(
  onUpdate: (snapshot: DownloadProgressSnapshot) => void,
): (loadedRatio: number) => void {
  let peakProgress = 0;

  return (loadedRatio: number) => {
    const pct = Math.min(95, Math.round(loadedRatio * 100));
    peakProgress = Math.max(peakProgress, pct);
    onUpdate({
      progress: peakProgress,
      message: "Downloading on-device model…",
      files: [
        {
          id: "prompt-api",
          label: "Built-in model",
          progress: peakProgress,
          loaded: peakProgress,
          total: 100,
          status: peakProgress >= 95 ? "done" : "downloading",
        },
      ],
    });
  };
}
