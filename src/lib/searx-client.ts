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
  return new Promise((resolve, reject) => {
    const sseUrl = `/api/scrape-content?mode=search&query=${encodeURIComponent(query)}&religion=${encodeURIComponent(religion)}&numResults=${encodeURIComponent(String(numResults))}`;
    const es = new EventSource(sseUrl);
    const mirrors: string[] = [];
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.close();
      fn();
    };

    es.addEventListener("mirror", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { mirror: string };
        mirrors.push(data.mirror);
        handlers?.onMirror?.(data.mirror);
      } catch {
        // ignore malformed mirror events
      }
    });

    es.addEventListener("results", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SearxSearchResponse & {
          usedMirrors?: string[];
        };
        finish(() =>
          resolve({
            results: data.results ?? [],
            usedEngine: data.usedEngine ?? "searx",
            usedMirrors: data.usedMirrors ?? mirrors,
          }),
        );
      } catch (err) {
        finish(() => reject(err));
      }
    });

    es.addEventListener("error", () => {
      finish(() => reject(new Error("Searx search failed")));
    });
  });
}
