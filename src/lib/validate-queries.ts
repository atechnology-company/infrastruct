const REQUIRED_KEYS = [
  "judaism",
  "christianity",
  "islam",
  "hinduism",
  "sikhism",
  "buddhism",
  "philosophy",
] as const;

export type SearchQueriesPayload = {
  queries: Record<string, { query: string; numResults: number }>;
};

export function normalizeSearchQueries(data: SearchQueriesPayload): SearchQueriesPayload {
  for (const key of REQUIRED_KEYS) {
    const entry = data.queries[key];
    if (!entry) continue;
    if (typeof entry.numResults === "string") {
      const n = parseInt(String(entry.numResults), 10);
      if (!Number.isNaN(n)) entry.numResults = n;
    }
  }
  return data;
}

export function validateSearchQueries(data: unknown): data is SearchQueriesPayload {
  if (!data || typeof data !== "object") return false;
  const queries = (data as SearchQueriesPayload).queries;
  if (!queries || typeof queries !== "object") return false;

  return REQUIRED_KEYS.every((key) => {
    const entry = queries[key];
    if (!entry) return false;
    const numRaw = entry.numResults;
    const num =
      typeof numRaw === "number" ? numRaw : parseInt(String(numRaw), 10);
    if (!Number.isNaN(num) && num === 0) return true;
    return (
      typeof entry.query === "string" &&
      entry.query.length > 0 &&
      (typeof numRaw === "number" || typeof numRaw === "string")
    );
  });
}
