export type NormalizedResults = {
  title: string;
  sections: Record<string, unknown>;
  conclusion: string;
  conclusions: { label: string; summary: string }[];
  sources?: unknown[];
};

export function normalizeSearchResponse(
  resp: {
    title?: string;
    sections?: Record<string, unknown>;
    conclusion?: string;
    conclusions?: { label: string; summary: string }[];
    sources?: unknown;
  },
  scrapedSources: { religion?: string; title?: string; link?: string; engine?: string }[],
): NormalizedResults {
  const title = typeof resp.title === "string" ? resp.title : "Results";
  const rawSections = resp.sections || {};

  const pickSection = (obj: Record<string, unknown>, key: string) => {
    if (!obj || typeof obj !== "object") {
      return {
        featured_quote: "",
        featured_quote_source: null,
        status: null,
        summary: "",
        sources: [],
      };
    }
    const foundKey = Object.keys(obj).find((k) => k.toLowerCase() === key);
    const sec = foundKey ? (obj[foundKey] as Record<string, unknown>) : null;
    if (!sec || typeof sec !== "object") {
      return {
        featured_quote: "",
        featured_quote_source: null,
        status: null,
        summary: "",
        sources: [],
      };
    }
    const quoteSource = sec.featured_quote_source as Record<string, string> | null;
    return {
      featured_quote: typeof sec.featured_quote === "string" ? sec.featured_quote : "",
      featured_quote_source:
        quoteSource && typeof quoteSource === "object"
          ? { title: quoteSource.title || "", url: quoteSource.url || "" }
          : null,
      status: ["permitted", "forbidden", "disliked", "unsure", "encouraged", "obligatory"].includes(
        String(sec.status),
      )
        ? sec.status
        : null,
      summary: typeof sec.summary === "string" ? sec.summary : "",
      sources: Array.isArray(sec.sources)
        ? sec.sources.map((s: { title?: string; url?: string; engine?: string }) => ({
            title: s?.title || "",
            url: s?.url || "",
            engine: s?.engine,
          }))
        : [],
    };
  };

  const sections = {
    judaism: pickSection(rawSections, "judaism"),
    christianity: pickSection(rawSections, "christianity"),
    islam: pickSection(rawSections, "islam"),
    hinduism: pickSection(rawSections, "hinduism"),
    sikhism: pickSection(rawSections, "sikhism"),
    buddhism: pickSection(rawSections, "buddhism"),
    philosophy: pickSection(rawSections, "philosophy"),
  };

  const conclusion = typeof resp.conclusion === "string" ? resp.conclusion : undefined;
  const conclusions = Array.isArray(resp.conclusions)
    ? resp.conclusions
    : conclusion
      ? [{ label: "Conclusion", summary: conclusion }]
      : [];

  const isEmpty = (key: keyof typeof sections) => {
    const section = sections[key] as { summary?: string; sources?: unknown[] };
    return !section?.summary && !section?.sources?.length;
  };

  if (
    Array.isArray(scrapedSources) &&
    (isEmpty("judaism") ||
      isEmpty("christianity") ||
      isEmpty("islam") ||
      isEmpty("hinduism") ||
      isEmpty("sikhism") ||
      isEmpty("buddhism"))
  ) {
    const grouped: Record<string, typeof scrapedSources> = {
      judaism: [],
      christianity: [],
      islam: [],
      hinduism: [],
      sikhism: [],
      buddhism: [],
    };
    for (const s of scrapedSources) {
      const rel = String(s?.religion || "").toLowerCase();
      if (rel.includes("juda")) grouped.judaism.push(s);
      else if (rel.includes("christ")) grouped.christianity.push(s);
      else if (rel.includes("islam")) grouped.islam.push(s);
      else if (rel.includes("hindu")) grouped.hinduism.push(s);
      else if (rel.includes("sikh")) grouped.sikhism.push(s);
      else if (rel.includes("buddh")) grouped.buddhism.push(s);
    }
    const makeSection = (arr: typeof scrapedSources, label: string) => {
      const top = arr[0];
      return {
        featured_quote: top?.title || `Top sources for ${label}`,
        featured_quote_source: top?.link
          ? { title: top?.title || top?.link, url: top?.link }
          : null,
        status: null,
        summary:
          arr
            .slice(0, 3)
            .map((a, i) => `- [${label}, ${i + 1}] ${a.title || a.link || ""}`)
            .join("\n") || "",
        sources: arr.map((a) => ({
          title: a.title || a.link || "",
          url: a.link || "",
          engine: a.engine,
        })),
      };
    };
    if (isEmpty("judaism")) sections.judaism = makeSection(grouped.judaism, "Judaism");
    if (isEmpty("christianity"))
      sections.christianity = makeSection(grouped.christianity, "Christianity");
    if (isEmpty("islam")) sections.islam = makeSection(grouped.islam, "Islam");
    if (isEmpty("hinduism")) sections.hinduism = makeSection(grouped.hinduism, "Hinduism");
    if (isEmpty("sikhism")) sections.sikhism = makeSection(grouped.sikhism, "Sikhism");
    if (isEmpty("buddhism")) sections.buddhism = makeSection(grouped.buddhism, "Buddhism");
  }

  return {
    title,
    sections,
    conclusion: conclusion ?? "",
    conclusions,
    sources: Array.isArray(resp.sources) ? resp.sources : undefined,
  };
}
