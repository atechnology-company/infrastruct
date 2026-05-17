import * as cheerio from "cheerio";
import {
  buildScopedSearchQuery,
  siteFiltersForReligion,
} from "@/lib/religion-sites";

export type SearchHit = {
  title: string;
  link: string;
  snippet?: string;
};

export type ServerSearchResponse = {
  results: SearchHit[];
  usedEngine: string;
  usedMirrors: string[];
  triedEngines: string[];
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Infrastruct/0.2; +https://github.com/undivisible/infrastruct)",
  Accept: "text/html,application/xhtml+xml,application/json",
};

const PUBLIC_SEARX_BASES = [
  "https://priv.au",
  "https://searx.tiekoetter.com",
  "https://searxng.hweeren.com",
  "https://search.mdosch.de",
  "https://baresearch.org",
];

function searxBases(): string[] {
  const custom = process.env.SEARX_BASE_URL?.trim().replace(/\/$/, "");
  const bases = custom ? [custom, ...PUBLIC_SEARX_BASES] : PUBLIC_SEARX_BASES;
  return [...new Set(bases)];
}

function hostnameMatches(link: string, domains: string[]): boolean {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return domains.some((d) => host === d.replace(/^www\./, "") || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function preferDomainResults(results: SearchHit[], domains: string[]): SearchHit[] {
  if (domains.length === 0) return results;
  const preferred = results.filter((r) => hostnameMatches(r.link, domains));
  return preferred.length > 0 ? preferred : results;
}

function dedupeByLink(results: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const r of results) {
    if (!r.link || seen.has(r.link)) continue;
    seen.add(r.link);
    out.push(r);
  }
  return out;
}

function unwrapDuckDuckGoLink(href: string): string {
  if (!href) return "";
  try {
    const url = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(url);
    if (parsed.hostname.includes("duckduckgo.com") && parsed.pathname === "/l/") {
      return parsed.searchParams.get("uddg") ?? href;
    }
  } catch {
    // keep original
  }
  return href;
}

export async function searchDuckDuckGoHtml(
  fullQuery: string,
  numResults: number,
): Promise<SearchHit[]> {
  const body = new URLSearchParams({ q: fullQuery, kl: "us-en" });
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      ...FETCH_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: SearchHit[] = [];

  $(".result").each((_, el) => {
    const row = $(el);
    if (row.hasClass("result--ad") || row.find(".badge--ad").length > 0) return;

    const anchor = row.find("a.result__a").first();
    const title = anchor.text().trim();
    let link = unwrapDuckDuckGoLink(anchor.attr("href") ?? "");
    const snippet = row.find(".result__snippet").text().trim();

    if (title && link && !link.includes("duckduckgo.com/y.js")) {
      results.push({ title, link, snippet });
    }
  });

  return dedupeByLink(results).slice(0, numResults);
}

type SearxJsonPayload = {
  results?: { title?: string; url?: string; content?: string }[];
};

export async function searchSearxJson(
  base: string,
  fullQuery: string,
  numResults: number,
): Promise<SearchHit[]> {
  const root = base.replace(/\/$/, "");
  const url = `${root}/search?${new URLSearchParams({
    q: fullQuery,
    format: "json",
    categories: "general",
    language: "en",
    safesearch: "1",
  })}`;

  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Searx JSON ${res.status} @ ${base}`);
  }

  const text = await res.text();
  if (text.startsWith("Too Many")) {
    throw new Error(`Searx rate limited @ ${base}`);
  }

  const data = JSON.parse(text) as SearxJsonPayload;
  const hits: SearchHit[] = [];
  for (const row of data.results ?? []) {
    if (!row.url || !row.title) continue;
    hits.push({
      title: row.title,
      link: row.url,
      snippet: row.content,
    });
  }
  return dedupeByLink(hits).slice(0, numResults);
}

function parseSearxHtml(html: string): SearchHit[] {
  const $ = cheerio.load(html);
  const results: SearchHit[] = [];

  const parsers: (() => void)[] = [
    () => {
      $("article.result").each((_, el) => {
        const link = $(el).find("a.url_header").attr("href");
        const title = $(el).find("h3 a").text().trim();
        const snippet = $(el).find("p.content").text().trim();
        if (link && title) results.push({ title, link, snippet });
      });
    },
    () => {
      $("#urls article, .result").each((_, el) => {
        const anchor = $(el).find("a[href]").first();
        const title = anchor.text().trim();
        const link = anchor.attr("href") ?? "";
        const snippet = $(el).find("p").first().text().trim();
        if (link && title) results.push({ title, link, snippet });
      });
    },
  ];

  for (const run of parsers) {
    if (results.length > 0) break;
    run();
  }

  return dedupeByLink(results);
}

export async function searchSearxHtml(
  base: string,
  fullQuery: string,
): Promise<SearchHit[]> {
  const root = base.replace(/\/$/, "");
  const url = `${root}/search?${new URLSearchParams({
    q: fullQuery,
    categories: "general",
    language: "en",
    safesearch: "1",
    theme: "simple",
  })}`;

  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Searx HTML ${res.status} @ ${base}`);
  }

  return parseSearxHtml(await res.text());
}

export async function runServerSearch(options: {
  query: string;
  religion: string;
  numResults: number;
}): Promise<ServerSearchResponse> {
  const { query, religion, numResults } = options;
  const siteFilters = siteFiltersForReligion(religion);
  const fullQuery = buildScopedSearchQuery(query, siteFilters);
  const triedEngines: string[] = [];
  const usedMirrors: string[] = [];
  let lastError: unknown;

  const finish = (results: SearchHit[], usedEngine: string): ServerSearchResponse => ({
    results: preferDomainResults(dedupeByLink(results), siteFilters).slice(0, numResults),
    usedEngine,
    usedMirrors,
    triedEngines,
  });

  triedEngines.push("duckduckgo-html");
  try {
    const ddg = await searchDuckDuckGoHtml(fullQuery, numResults);
    if (ddg.length > 0) {
      return finish(ddg, "duckduckgo-html");
    }
  } catch (err) {
    lastError = err;
  }

  for (const base of searxBases()) {
    triedEngines.push(`searx-json:${base}`);
    try {
      const hits = await searchSearxJson(base, fullQuery, numResults);
      if (hits.length > 0) {
        usedMirrors.push(base);
        return finish(hits, "searx-json");
      }
    } catch (err) {
      lastError = err;
    }

    triedEngines.push(`searx-html:${base}`);
    try {
      const hits = await searchSearxHtml(base, fullQuery);
      if (hits.length > 0) {
        usedMirrors.push(base);
        return finish(hits, "searx-html");
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (siteFilters.length > 0) {
    triedEngines.push("duckduckgo-html-broad");
    try {
      const broad = await searchDuckDuckGoHtml(query.trim(), numResults);
      if (broad.length > 0) {
        return finish(broad, "duckduckgo-html-broad");
      }
    } catch (err) {
      lastError = err;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "All search backends failed";
  throw new Error(message);
}
