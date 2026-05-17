import type { ServerSearchResponse } from "@/lib/server-search";

export type SearxSearchResult = {
  title: string;
  link: string;
  snippet?: string;
};

export type SearxSearchResponse = {
  results: SearxSearchResult[];
  usedEngine: string;
  usedMirrors: string[];
};

export async function searchWithSearx(
  query: string,
  religion: string,
  numResults: number,
  handlers?: {
    onMirror?: (mirror: string) => void;
  },
): Promise<SearxSearchResponse> {
  const params = new URLSearchParams({
    mode: "search",
    query,
    religion,
    numResults: String(numResults),
  });

  const res = await fetch(`/api/scrape-content?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(body.details ?? body.error ?? `Search failed (${res.status})`);
  }

  const data = (await res.json()) as ServerSearchResponse;

  for (const mirror of data.usedMirrors ?? []) {
    handlers?.onMirror?.(mirror);
  }

  if (data.usedEngine.startsWith("duckduckgo")) {
    handlers?.onMirror?.("DuckDuckGo");
  }

  return {
    results: data.results ?? [],
    usedEngine: data.usedEngine,
    usedMirrors: data.usedMirrors ?? [],
  };
}
