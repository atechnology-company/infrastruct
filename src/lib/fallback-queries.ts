const CATEGORY_KEYS = [
  "judaism",
  "christianity",
  "islam",
  "hinduism",
  "sikhism",
  "buddhism",
  "philosophy",
] as const;

export type SearchQueryMap = Record<
  string,
  { query: string; numResults: number }
>;

export function buildFallbackSearchQueries(
  prompt: string,
  enabledReligions?: Partial<Record<string, boolean>>,
): { queries: SearchQueryMap } {
  const trimmed = prompt.trim();
  const queries: SearchQueryMap = {};

  for (const key of CATEGORY_KEYS) {
    const enabled =
      key === "philosophy" ||
      enabledReligions?.[key] !== false;
    queries[key] = {
      query: trimmed,
      numResults: enabled ? 3 : 0,
    };
  }

  return { queries };
}
