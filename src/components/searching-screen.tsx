"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { marked } from "marked";
import { ChevronDown, ExternalLink, X } from "lucide-react";

// --- CONFIGURATION ---

const GEMINI_API_URL = "/api/generate-queries";
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const CSE_IDS = {
  judaism: process.env.NEXT_PUBLIC_CSE_ID_JUDAISM || "",
  christianity: process.env.NEXT_PUBLIC_CSE_ID_CHRISTIANITY || "",
  islam: process.env.NEXT_PUBLIC_CSE_ID_ISLAM || "",
};

const RELIGIONS = [
  { key: "judaism", label: "JUDAISM" },
  { key: "christianity", label: "CHRISTIANITY" },
  { key: "islam", label: "ISLAM" },
  { key: "hinduism", label: "HINDUISM" },
  { key: "sikhism", label: "SIKHISM" },
  { key: "buddhism", label: "BUDDHISM" },
];

const SEARCH_CATEGORIES = [
  ...RELIGIONS,
  { key: "philosophy", label: "PHILOSOPHY" },
];

const COLORS = {
  judaism: {
    border: "border-blue-600",
    bg: "bg-blue-950",
    bgHover: "bg-blue-900",
    bgSolid: "bg-blue-600",
    accent: "text-blue-400",
    fill: "bg-blue-900",
  },
  christianity: {
    border: "border-amber-600",
    bg: "bg-amber-950",
    bgHover: "bg-amber-900",
    bgSolid: "bg-amber-600",
    accent: "text-amber-400",
    fill: "bg-amber-900",
  },
  islam: {
    border: "border-green-600",
    bg: "bg-green-950",
    bgHover: "bg-green-900",
    bgSolid: "bg-green-600",
    accent: "text-green-400",
    fill: "bg-green-900",
  },
  hinduism: {
    border: "border-orange-600",
    bg: "bg-orange-950",
    bgHover: "bg-orange-900",
    bgSolid: "bg-orange-600",
    accent: "text-orange-400",
    fill: "bg-orange-900",
  },
  sikhism: {
    border: "border-yellow-600",
    bg: "bg-yellow-950",
    bgHover: "bg-yellow-900",
    bgSolid: "bg-yellow-600",
    accent: "text-yellow-400",
    fill: "bg-yellow-900",
  },
  buddhism: {
    border: "border-purple-600",
    bg: "bg-purple-950",
    bgHover: "bg-purple-900",
    bgSolid: "bg-purple-600",
    accent: "text-purple-400",
    fill: "bg-purple-900",
  },
  philosophy: {
    border: "border-slate-600",
    bg: "bg-slate-950",
    bgHover: "bg-slate-900",
    bgSolid: "bg-slate-600",
    accent: "text-slate-400",
    fill: "bg-slate-900",
  },
};

const statusColors: Record<string, string> = {
  permitted: "text-green-400 border-green-500 bg-green-900/20",
  forbidden: "text-red-400 border-red-500 bg-red-900/20",
  disliked: "text-orange-400 border-orange-500 bg-orange-900/20",
  unsure: "text-gray-400 border-gray-500 bg-gray-900/20",
  encouraged: "text-blue-400 border-blue-500 bg-blue-900/20",
  obligatory: "text-purple-400 border-purple-500 bg-purple-900/20",
  dharmic: "text-orange-400 border-orange-500 bg-orange-900/20",
  adharmic: "text-red-400 border-red-500 bg-red-900/20",
  skillful: "text-blue-400 border-blue-500 bg-blue-900/20",
  unskillful: "text-red-400 border-red-500 bg-red-900/20",
  neutral: "text-gray-400 border-gray-500 bg-gray-900/20",
};

// --- TYPES ---

interface SourceResult {
  religion: string;
  title: string;
  link: string;
  color: (typeof COLORS)[keyof typeof COLORS];
  loading: boolean;
  snippet?: string;
  query?: string;
  filled?: boolean;
  engine?: string;
}


// --- MAIN COMPONENT ---

export function SearchingScreen({
  prompt,
  apiKey = GOOGLE_API_KEY,
  cseIds = CSE_IDS,
  onCompleteAction,
  onStop,
  results,
}: {
  prompt: string;
  apiKey?: string;
  cseIds?: { judaism: string; christianity: string; islam: string };
  onCompleteAction?: (results: SourceResult[]) => void;
  onStop?: () => void;
  results?: {
    title: string;
    sections: Record<string, any>;
    conclusion?: string;
    conclusions?: any[];
  } | null;
}) {
  console.log("[SearchingScreen] COMPONENT CALLED - prompt:", prompt, "results:", results);

  // queries: { judaism: { query, numResults }, ... }
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStopped, setIsStopped] = useState(false);
  const [queries, setQueries] = useState<{
    [key: string]: { query: string; numResults: number };
  } | null>(null);
  // sources: { [religion]: [{...results}] }
  const [sources, setSources] = useState<Record<string, SourceResult[]>>(
    SEARCH_CATEGORIES.reduce(
      (acc, r) => {
        acc[r.key] = [];
        return acc;
      },
      {} as Record<string, SourceResult[]>,
    ),
  );
  const [statusText, setStatusText] = useState("searching...");
  const [currentSource, setCurrentSource] = useState(0);
  const [streamStarted, setStreamStarted] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<string | null>(null);
  // Track when each religion's scraping phase is complete (regardless of success)
  const [scrapingDone, setScrapingDone] = useState<{
    [key: string]: boolean;
  }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );
  // Track current engine for each religion
  const [currentEngine, setCurrentEngine] = useState<{ [key: string]: string }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = 'none';
      return acc;
    }, {} as Record<string, string>)
  );

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const aggregatedSourcesList = useMemo(() => {
    const sections = results?.sections || {};
    return Object.entries(sections).reduce((acc, [key, section]) => {
      if (section?.sources && Array.isArray(section.sources)) {
        acc.push(...section.sources);
      }
      return acc;
    }, [] as any[]);
  }, [results?.sections]);

  const sectionSourcesMap = useMemo(() => {
    const sections = results?.sections || {};
    return Object.entries(sections).reduce((acc, [key, section]) => {
      if (section?.sources && Array.isArray(section.sources)) {
        acc[key.toLowerCase()] = section.sources;
      }
      return acc;
    }, {} as Record<string, any[]>);
  }, [results?.sections]);

  const getSourceForCitation = (religion: string | undefined, idx: number, localSources?: any[]) => {
    if (religion) {
      const key = religion.toLowerCase();
      const sectionSources = sectionSourcesMap[key];
      if (sectionSources && sectionSources[idx]) {
        return sectionSources[idx];
      }
    }
    if (localSources && localSources[idx]) {
      return localSources[idx];
    }
    if (aggregatedSourcesList[idx]) {
      return aggregatedSourcesList[idx];
    }
    return null;
  };

  // Animated dots for "Searching..."
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (!queries) return;
    interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [queries]);

  // Track current site index for each religion for slot-machine animation
  const [currentSiteIdx, setCurrentSiteIdx] = useState<{
    [key: string]: number;
  }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = 0;
      return acc;
    }, {} as Record<string, number>)
  );
  // Track current site title for each religion
  const [currentSiteTitle, setCurrentSiteTitle] = useState<{
    [key: string]: string;
  }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = "";
      return acc;
    }, {} as Record<string, string>)
  );
  // Track error state for each religion (for red pulse/flash)
  const [errorState, setErrorState] = useState<{
    [key: string]: boolean;
  }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );
  // Track if all links failed for a religion
  const [allFailed, setAllFailed] = useState<{
    [key: string]: boolean;
  }>(
    SEARCH_CATEGORIES.reduce((acc, r) => {
      acc[r.key] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  // --- LOGGING UTILITY ---
  const log = (...args: any[]) => {
    if (typeof window !== "undefined") {
      // Only log in browser
      console.log("[SearchingScreen]", ...args);
    }
  };

  // Step 1: Generate queries using Gemini
  useEffect(() => {
    log('Effect: Generate queries for prompt', prompt);
    let cancelled = false;
    abortControllerRef.current = new AbortController();
    async function fetchQueries() {
      log('fetchQueries: called');
      setStatusText("searching...");
      log('fetchQueries: setStatusText searching...');
      setQueries(null);
      log('fetchQueries: setQueries null');
      setSources(
        SEARCH_CATEGORIES.reduce(
          (acc, r) => {
            acc[r.key] = [];
            return acc;
          },
          {} as Record<string, SourceResult[]>,
        ),
      );
      // Utility to clean Gemini's markdown fencing
      function cleanGeminiJson(text: string): string {
        log('cleanGeminiJson: called');
        // Remove triple backticks and optional "json" label, robustly
        let cleaned = text.trim();
        // Remove all leading/trailing backtick blocks
        cleaned = cleaned.replace(/^```+(json)?\s*/i, "");
        cleaned = cleaned.replace(/```+\s*$/i, "");
        // Remove any stray backticks at start/end
        cleaned = cleaned.replace(/^`+|`+$/g, "");
        // Remove any leading/trailing whitespace again
        return cleaned.trim();
      }

      try {
        log("Fetching queries for prompt:", prompt);
        const res = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          ...(abortControllerRef.current ? { signal: abortControllerRef.current.signal } : {}),
        });
        let rawText = await res.text();
        log('fetchQueries: rawText', rawText);
        let data;
        try {
          data = JSON.parse(cleanGeminiJson(rawText));
        } catch (e) {
          log("Error parsing Gemini response:", rawText);
          setStatusText("error");
          return;
        }
        log("Queries received:", data);

        // Validate queries format
        log('fetchQueries: validating queries', data.queries);
        const valid =
          data &&
          typeof data === "object" &&
          data.queries &&
          typeof data.queries === "object" &&
          SEARCH_CATEGORIES.every(
            (r) =>
              data.queries[r.key] &&
              typeof data.queries[r.key].query === "string" &&
              data.queries[r.key].query.length > 0 &&
              (typeof data.queries[r.key].numResults === "number" || typeof data.queries[r.key].numResults === "string")
          );
        // If numResults is a string, try to parse it as a number
        if (valid) {
          SEARCH_CATEGORIES.forEach((r) => {
            if (typeof data.queries[r.key].numResults === "string") {
              const n = parseInt(data.queries[r.key].numResults, 10);
              if (!isNaN(n)) data.queries[r.key].numResults = n;
            }
          });
        }

        if (!cancelled && valid) {
          log('fetchQueries: valid queries, setting state');
          setQueries(data.queries);
          setStatusText("searching...");
          log("Valid queries set:", data.queries);
        } else if (!cancelled) {
          log('fetchQueries: invalid queries format');
          setStatusText("error");
          log("Invalid queries format received:", data);
        }
      } catch (err) {
        log('fetchQueries: error', err);
        setStatusText("error");
        log("Error fetching queries:", err);
      }
    }
    log('Effect: calling fetchQueries');
    fetchQueries();
    return () => {
      log('Effect cleanup: fetchQueries');
      cancelled = true;
      // Do NOT setIsStopped(true) here; only abort the controller
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [prompt]);

  // Step 2: Fetch CSE results and scrape content (concurrent for all categories)
  useEffect(() => {
    log('Effect: Fetch CSE results and scrape content', { queries, isStopped });
    if (!queries || isStopped) return;
    let cancelled = false;
    abortControllerRef.current = new AbortController();
    setStreamStarted(true);

    async function fetchAndScrapeConcurrent() {
      log('fetchAndScrapeConcurrent: called');
      log('fetchAndScrapeConcurrent: SEARCH_CATEGORIES', SEARCH_CATEGORIES);
      // reset done flags
      setScrapingDone(
        SEARCH_CATEGORIES.reduce((acc, r) => {
          acc[r.key] = false;
          return acc;
        }, {} as Record<string, boolean>)
      );

      // Set 5-minute timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        log('⏱️ 5-minute timeout reached, proceeding with available results');
        // Mark all categories as done to trigger results screen
        setScrapingDone(
          SEARCH_CATEGORIES.reduce((acc, r) => {
            acc[r.key] = true;
            return acc;
          }, {} as Record<string, boolean>)
        );
      }, 5 * 60 * 1000); // 5 minutes

      try {
        // Process categories in batches of 3 to avoid Perplexity rate limits
        const batchSize = 3;
        for (let batchIdx = 0; batchIdx < SEARCH_CATEGORIES.length; batchIdx += batchSize) {
          const batch = SEARCH_CATEGORIES.slice(batchIdx, batchIdx + batchSize);
          log(`📦 Processing batch ${Math.floor(batchIdx / batchSize) + 1}/${Math.ceil(SEARCH_CATEGORIES.length / batchSize)}: ${batch.map(r => r.key).join(', ')}`);

          await Promise.all(
            batch.map(async (r, idx) => {
              log('fetchAndScrapeConcurrent: category', r);
              if (!queries || !queries[r.key] || isStopped || abortControllerRef.current?.signal.aborted) {
                log('fetchAndScrapeConcurrent: skipping category', r.key);
                return;
              }
              const { query, numResults } = queries[r.key];
              setCurrentSiteIdx((prev) => ({ ...prev, [r.key]: 0 }));
              setCurrentSiteTitle((prev) => ({
                ...prev,
                [r.key]: queries[r.key]?.query || r.label,
              }));
              log('fetchAndScrapeConcurrent: setCurrentSiteIdx/Title', r.key, queries[r.key]?.query);

              // Try Perplexity first, fallback to Searx
              let searchData: any = null;
              let usedEngine = 'none';

              // Step 1: Try Perplexity API
              try {
                log('fetchAndScrapeConcurrent: trying Perplexity for', r.key);
                setCurrentEngine((prev) => ({ ...prev, [r.key]: 'perplexity' }));
                setCurrentSiteTitle((prev) => ({ ...prev, [r.key]: 'Searching with Perplexity...' }));

                const perplexityRes = await fetch('/api/perplexity-search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query, religion: r.key, numResults }),
                  signal: abortControllerRef.current?.signal,
                });

                if (perplexityRes.ok) {
                  const data = await perplexityRes.json();
                  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                    searchData = data;
                    usedEngine = 'perplexity';
                    log('fetchAndScrapeConcurrent: Perplexity succeeded for', r.key, data);
                    setCurrentSiteTitle((prev) => ({ ...prev, [r.key]: `Found ${data.results.length} sources via Perplexity` }));
                  } else {
                    log('fetchAndScrapeConcurrent: Perplexity returned no results for', r.key);
                  }
                } else {
                  log('fetchAndScrapeConcurrent: Perplexity API failed for', r.key, perplexityRes.status);
                }
              } catch (err) {
                log('fetchAndScrapeConcurrent: Perplexity error for', r.key, err);
              }

              // Step 2: Fallback to Searx if Perplexity failed or returned no results
              if (!searchData || !searchData.results || searchData.results.length === 0) {
                log('fetchAndScrapeConcurrent: Falling back to Searx for', r.key);
                setCurrentEngine((prev) => ({ ...prev, [r.key]: 'searx' }));
                // --- SSE: Progressive Searx mirror updates ---
                let sseDone = false;
                let sseError: string | null = null;
                let sseResults: { results: any[]; usedEngine: string; usedMirrors?: string[] } | null = null;
                let sseMirrors: string[] = [];
                await new Promise<void>((resolve) => {
                  const sseUrl = `/api/scrape-content?mode=search&query=${encodeURIComponent(query)}&religion=${encodeURIComponent(r.key)}&numResults=${encodeURIComponent(String(numResults))}`;
                  const es = new window.EventSource(sseUrl);
                  es.addEventListener('mirror', (e: MessageEvent) => {
                    try {
                      const data: { mirror: string; url: string } = JSON.parse(e.data);
                      setCurrentSiteTitle((prev) => ({ ...prev, [r.key]: `Searching: ${data.mirror}` }));
                      setCurrentEngine((prev) => ({ ...prev, [r.key]: data.mirror }));
                      sseMirrors.push(data.mirror);
                    } catch { }
                  });
                  es.addEventListener('results', (e: MessageEvent) => {
                    try {
                      const data = JSON.parse(e.data) as { results: any[]; usedEngine: string; usedMirrors?: string[] };
                      sseResults = data;
                      if (data.usedMirrors) sseMirrors = data.usedMirrors;
                      sseDone = true;
                      es.close();
                      resolve();
                    } catch { }
                  });
                  es.addEventListener('error', (e: MessageEvent) => {
                    try {
                      sseError = e.data as string;
                      sseDone = true;
                      es.close();
                      resolve();
                    } catch { }
                  });
                });
                if (
                  sseError ||
                  !sseResults ||
                  !Array.isArray((sseResults as { results: any[] }).results) ||
                  (sseResults as { results: any[] }).results.length === 0
                ) {
                  setSources((prev) => ({
                    ...prev,
                    [r.key]: [
                      {
                        religion: r.label,
                        title: "No results found (Perplexity and Searx failed)",
                        link: "",
                        color: COLORS[r.key as keyof typeof COLORS],
                        loading: false,
                        query,
                        filled: true,
                        snippet: "Both Perplexity and Searx failed. Try again later.",
                        engine: 'none',
                      },
                    ],
                  }));
                  setErrorState((prev) => ({ ...prev, [r.key]: true }));
                  setAllFailed((prev) => ({ ...prev, [r.key]: true }));
                  setCurrentEngine((prev) => ({ ...prev, [r.key]: 'none' }));
                  // mark this category as done even if failed
                  setScrapingDone((prev) => ({ ...prev, [r.key]: true }));
                  return;
                }
                // Show final mirror used
                setCurrentSiteTitle((prev) => ({ ...prev, [r.key]: `Results from: ${sseMirrors.join(', ')}` }));
                setCurrentEngine((prev) => ({ ...prev, [r.key]: sseMirrors.length > 0 ? sseMirrors[sseMirrors.length - 1] : 'searx' }));
                searchData = sseResults;
                usedEngine = searchData.usedEngine || "searx";
              }

              // For each result, scrape content and animate title
              const items = Array.isArray(searchData.results)
                ? searchData.results.slice(0, numResults)
                : [];
              // Save which engine was used for this category
              log('fetchAndScrapeConcurrent: items to scrape', r.key, items, 'using engine:', usedEngine);
              const scrapedResults: SourceResult[] = [];
              let foundSuccess = false;
              let successCount = 0; // Track successful scrapes

              // Scrape all items concurrently for this category
              await Promise.all(
                items.map(async (item: any, i: number) => {
                  log('fetchAndScrapeConcurrent: scraping item', r.key, item);
                  if (cancelled || isStopped || abortControllerRef.current?.signal.aborted) return;
                  setCurrentSiteIdx((prev) => ({ ...prev, [r.key]: i }));
                  setCurrentSiteTitle((prev) => ({
                    ...prev,
                    [r.key]: item.title || "Fetching...",
                  }));
                  setCurrentEngine((prev) => ({ ...prev, [r.key]: usedEngine }));

                  let scraped: any = null;
                  let scrapeError = false;
                  for (let attempt = 0; attempt < 2; attempt++) {
                    log('fetchAndScrapeConcurrent: scrape attempt', attempt, r.key, item.link);
                    if (isStopped || abortControllerRef.current?.signal.aborted) return;
                    try {
                      const scrapeRes = await fetch(
                        `/api/scrape-content?url=${encodeURIComponent(item.link)}`,
                        abortControllerRef.current
                          ? {
                            headers: {
                              "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            },
                            signal: abortControllerRef.current.signal,
                          }
                          : {
                            headers: {
                              "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            },
                          }
                      );
                      if (isStopped || abortControllerRef.current?.signal.aborted) return;
                      if (!scrapeRes.ok) {
                        log('fetchAndScrapeConcurrent: scrapeRes not ok', scrapeRes.status, item.link);
                        throw new Error(`HTTP ${scrapeRes.status}`);
                      }
                      scraped = await scrapeRes.json();
                      log('fetchAndScrapeConcurrent: scraped result', scraped);
                      if (isStopped || abortControllerRef.current?.signal.aborted) return;
                      // --- FAST PREPROCESSING OF SCRAPED HTML CONTENT ---
                      if (scraped && scraped.content) {
                        log('fetchAndScrapeConcurrent: scraped content found', scraped.content.slice(0, 100));
                        let text = scraped.content;

                        // Remove script, style, and comment tags first
                        text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
                        text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
                        text = text.replace(/<!--[\s\S]*?-->/g, "");

                        // Remove boilerplate sections
                        text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
                        text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
                        text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
                        text = text.replace(/<aside[\s\S]*?<\/aside>/gi, "");
                        text = text.replace(/<form[\s\S]*?<\/form>/gi, "");

                        // Remove ALL remaining HTML tags
                        text = text.replace(/<[^>]+>/g, " ");

                        // Decode HTML entities
                        text = text.replace(/&nbsp;/g, " ");
                        text = text.replace(/&amp;/g, "&");
                        text = text.replace(/&lt;/g, "<");
                        text = text.replace(/&gt;/g, ">");
                        text = text.replace(/&quot;/g, '"');
                        text = text.replace(/&#39;/g, "'");
                        text = text.replace(/&[a-z]+;/gi, " ");

                        // Remove excessive whitespace
                        text = text.replace(/\s{3,}/g, " ");
                        text = text.replace(/(\r?\n){3,}/g, "\n\n");
                        text = text.trim();

                        // Assign cleaned content back
                        scraped.content = text;
                      }
                      // --- END PREPROCESSING ---

                      log(`Scraped content for ${r.label}:`, scraped);
                      scrapeError = false;
                      log('fetchAndScrapeConcurrent: scrape success', r.key, item.link);
                      foundSuccess = true;
                      // Always set the current site title to the valid result's title after success
                      setCurrentSiteTitle((prev) => ({
                        ...prev,
                        [r.key]: item.title || scraped?.title || "No title",
                      }));
                      break;
                    } catch (err) {
                      log('fetchAndScrapeConcurrent: scrape error', err);
                      log(
                        `Error scraping content for ${r.label} (attempt ${attempt + 1}):`,
                        err,
                      );
                      scrapeError = true;
                      // Red pulse/flash for error
                      setErrorState((prev) => ({ ...prev, [r.key]: true }));
                      log('fetchAndScrapeConcurrent: setErrorState true', r.key);
                      // Only set error title if no previous success
                      setCurrentSiteTitle((prev) => ({
                        ...prev,
                        [r.key]: foundSuccess ? (item.title || "Fetching...") : "Error fetching site, retrying...",
                      }));
                      // Flash red for 500ms
                      await new Promise((resolve) => setTimeout(resolve, 500));
                      setErrorState((prev) => ({ ...prev, [r.key]: false }));
                      log('fetchAndScrapeConcurrent: setErrorState false', r.key);
                      if (attempt === 0) {
                        // Wait before retry
                        await new Promise((resolve) => setTimeout(resolve, 400));
                      }
                    }
                  }
                  if (!scrapeError && !isStopped && !cancelled) {
                    scrapedResults.push({
                      religion: r.label,
                      title: item.title || scraped?.title || "No title",
                      link: item.link,
                      color: COLORS[r.key as keyof typeof COLORS],
                      loading: false,
                      snippet: scraped?.content || item.snippet || "",
                      query,
                      filled: true,
                      engine: usedEngine,
                    });
                    // Update sources as we go for streaming effect
                    setSources((prev) => ({
                      ...prev,
                      [r.key]: [
                        ...(prev[r.key] || []),
                        {
                          religion: r.label,
                          title: item.title || scraped?.title || "No title",
                          link: item.link,
                          color: COLORS[r.key as keyof typeof COLORS],
                          loading: false,
                          snippet: scraped?.content || item.snippet || "",
                          query,
                          filled: true,
                          engine: usedEngine,
                        },
                      ],
                    }));
                    // Slot-machine animation: wait a bit before next title
                    await new Promise((resolve) => setTimeout(resolve, 650));
                    successCount++;
                  } else {
                    log(
                      `Final failure scraping content for ${r.label}:`,
                      item.link,
                    );
                    log('fetchAndScrapeConcurrent: final failure', r.key, item.link);
                  }
                }),
              );
              // If no success after all items, show error
              const hasValidResults = (sources[r.key] && sources[r.key].length > 0);
              if (!foundSuccess && !hasValidResults) {
                setAllFailed((prev) => ({ ...prev, [r.key]: true }));
                log('fetchAndScrapeConcurrent: setAllFailed true', r.key);
                setCurrentSiteTitle((prev) => ({
                  ...prev,
                  ...prev,
                  [r.key]: "Failed to fetch any site.",
                }));
                setErrorState((prev) => ({ ...prev, [r.key]: true }));
                log('fetchAndScrapeConcurrent: setErrorState true (all failed)', r.key);
                setSources((prev) => ({
                  ...prev,
                  ...prev,
                  [r.key]: [
                    {
                      religion: r.label,
                      title: "Error fetching all results",
                      link: "",
                      color: COLORS[r.key as keyof typeof COLORS],
                      loading: false,
                      query,
                      filled: true,
                      snippet: "",
                    },
                  ],
                }));
              } else {
                setAllFailed((prev) => ({ ...prev, [r.key]: false }));
                log('fetchAndScrapeConcurrent: setAllFailed false', r.key);
              }
              // Deduplicate sources for this category by link (fast, in-place)
              setSources((prev) => ({
                ...prev,
                ...prev,
                [r.key]: (prev[r.key] || []).filter(
                  (src, idx, arr) =>
                    arr.findIndex((s) => s.link === src.link) === idx,
                ),
              }));

              // After all sites, reset to last title
              setCurrentSiteIdx((prev) => ({
                ...prev,
                ...prev,
                [r.key]: items.length - 1,
              }));
              setCurrentSiteTitle((prev) => ({
                ...prev,
                ...prev,
                [r.key]: items.length > 0 ? items[items.length - 1].title : "",
              }));
              // mark this category as done
              setScrapingDone((prev) => ({ ...prev, [r.key]: true }));
            }),
          );

          // Wait 2 seconds between batches to avoid rate limiting
          if (batchIdx + batchSize < SEARCH_CATEGORIES.length && !isStopped && !cancelled) {
            log('⏳ Waiting 2s before next batch...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      setScrapingProgress(null);
      log('fetchAndScrapeConcurrent: done');
    }

    log('Effect: calling fetchAndScrapeConcurrent');
    fetchAndScrapeConcurrent();

    return () => {
      log('Effect cleanup: fetchAndScrapeConcurrent');
      cancelled = true;
      // Do NOT setIsStopped(true) here; only abort the controller
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [queries, apiKey, cseIds, isStopped]);
  // Stop button handler
  const handleStop = () => {
    setIsStopped(true);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setStatusText("Stopped.");
    if (onStop) onStop(); // Call the callback to return to home
  };

  // Animate current source highlight
  useEffect(() => {
    log('Effect: Animate current source highlight');
    const interval = setInterval(() => {
      setCurrentSource((prev) => (prev + 1) % SEARCH_CATEGORIES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStarted]);

  // Prevent duplicate /api/search calls
  const [searchTriggered, setSearchTriggered] = useState(false);
  useEffect(() => {
    log('Effect: Update status text as results stream in');
    if (!queries) {
      setStatusText("Generating queries...");
      log("Waiting for queries to be generated...");
      setSearchTriggered(false);
      return;
    }
    // Check if all scraping tasks are done per category
    log("DEBUG allDone check", { sources, allFailed, queries, scrapingDone });
    log("DEBUG scrapingDone values:", Object.entries(scrapingDone).map(([k, v]) => `${k}=${v}`).join(", "));
    const allDone = SEARCH_CATEGORIES.every((r) => scrapingDone[r.key]);
    log("DEBUG allDone result:", allDone, "checking categories:", SEARCH_CATEGORIES.map(r => r.key).join(", "));

    if (allDone && onCompleteAction) {
      setStatusText("generating results...");
      log("[SearchingScreen] TRIGGER onCompleteAction", { allDone, allFailed, sources });
      onCompleteAction(Object.values(sources).flat());
    }
  }, [queries, sources, allFailed, scrapingDone]);

  // Helper to extract a best-effort display domain from URL
  const getDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length === 0) return 'source';
      if (parts.length <= 2) {
        return parts[0];
      }
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      if (last.length === 2 && secondLast.length <= 3 && parts.length >= 3) {
        return parts[parts.length - 3];
      }
      return secondLast;
    } catch {
      return 'source';
    }
  };

  // Helper to process summary with styled citations
  const processSummaryWithCitations = (summary: string, sectionSources: any[] = []) => {
    if (!summary) return '';

    const citationClass = 'inline-flex items-center px-2 py-0.5 mx-1 text-xs font-mono rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors cursor-pointer no-underline';

    const parseReferences = (text: string) => {
      const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
      const refs: { religion?: string; num: number }[] = [];
      let idx = 0;
      while (idx < parts.length) {
        const current = parts[idx];
        if (!current) {
          idx += 1;
          continue;
        }
        if (/^\d+$/.test(current)) {
          refs.push({ num: parseInt(current, 10) });
          idx += 1;
          continue;
        }
        const next = parts[idx + 1];
        if (next && /^\d+$/.test(next)) {
          refs.push({ religion: current, num: parseInt(next, 10) });
          idx += 2;
          continue;
        }
        idx += 1;
      }
      return refs;
    };

    const renderCitation = (religion: string | undefined, num: number) => {
      const idx = num - 1;
      const source = getSourceForCitation(religion, idx, sectionSources);
      const citationLabel = `[${num}]`;
      const domainLabel = source?.url ? getDomain(source.url) : '';
      const displayText = domainLabel || citationLabel;
      const baseAttrTitle = domainLabel || citationLabel;
      const attrs = `class="${citationClass}" title="${baseAttrTitle}" onClick="event.stopPropagation()"`;
      if (source?.url) {
        const safeUrl = source.url.replace(/"/g, '%22');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" ${attrs}>${displayText}</a>`;
      }
      return `<span ${attrs}>${displayText}</span>`;
    };

    const processed = summary.replace(/\[([^\]]+)\]/g, (match, inner) => {
      const refs = parseReferences(inner);
      if (!refs.length) return match;
      return refs.map((ref) => renderCitation(ref.religion, ref.num)).join('');
    });

    return marked.parse(processed);
  };


  

  // --- MAIN RETURN BLOCK ---
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col min-h-screen px-6 md:px-12 bg-black pt-24 pb-12"
    >
      {/* Query title - top left */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-3">
        <button
          type="button"
          onClick={onStop}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-gray-400 text-sm font-bold uppercase tracking-wider"
          style={{ fontFamily: "Chivo Mono, monospace" }}
        >
          {prompt}
        </motion.div>
      </div>

      <div className="max-w-3xl w-full mx-auto">
        <div className="flex flex-col gap-4">
          {/* Render Religions */}
          {RELIGIONS.map((r) => {
            const section = results?.sections?.[r.key];
            const hasResult = !!section;
            const sourcesList = sources[r.key] || [];

            // Find the first loaded source for this religion, or show loading
            const firstSource = (sourcesList && sourcesList[0]) || null;
            const engineLabel = currentEngine[r.key] && currentEngine[r.key] !== 'none'
              ? `Mirror: ${currentEngine[r.key]}`
              : firstSource && firstSource.engine === 'none'
                ? 'No engine succeeded'
                : '';

            const showError = allFailed[r.key] && (!sourcesList || sourcesList.length === 0 || (firstSource && firstSource.engine === 'none'));
            const isExpanded = expandedCard === r.key;
            const isHovered = hoveredCard === r.key;

            // Determine background color based on state
            const colorConfig = COLORS[r.key as keyof typeof COLORS];
            const cardBgClass = hasResult
              ? (isExpanded ? colorConfig.bgSolid : (isHovered ? colorConfig.bgHover : colorConfig.bg))
              : "bg-black";

            // Status visibility: hide for Eastern religions if not relevant
            const showStatus = hasResult && section?.status && !['hinduism', 'sikhism', 'buddhism'].includes(r.key);

            return (
              <motion.div
                key={r.key}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                onMouseEnter={() => hasResult && setHoveredCard(r.key)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => hasResult && setExpandedCard(isExpanded ? null : r.key)}
                className={`relative border-2 ${colorConfig.border} p-6 shadow-lg overflow-hidden transition-colors duration-500 ${hasResult ? "cursor-pointer" : ""} ${cardBgClass}`}
                style={{
                  borderRadius: 0,
                  minHeight: isExpanded ? "auto" : "160px",
                }}
              >
                <div className="relative z-10">
                  {/* Religion name - always visible */}
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className={`text-sm font-bold uppercase ${isExpanded ? "text-white" : colorConfig.accent} tracking-wider`}
                      style={{ fontFamily: "Chivo Mono, monospace" }}
                    >
                      {r.label}
                    </div>
                    {showStatus && (
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isExpanded ? "text-white border-white bg-white/20" : (statusColors[section.status] || "text-gray-400 border-gray-500")}`}>
                        {section.status}
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {!hasResult ? (
                      <motion.div
                        key="searching"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        className="space-y-2"
                      >
                        <motion.div
                          className={`text-lg font-bold uppercase ${showError ? "text-red-300" : "text-white"}`}
                          style={{ fontFamily: "Chivo Mono, monospace" }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          {showError ? "SEARCH FAILED" : (currentSiteTitle[r.key] || "WAITING...").toUpperCase()}
                        </motion.div>
                        {currentEngine[r.key] && currentEngine[r.key] !== 'none' && (
                          <div className="text-xs text-gray-500 uppercase" style={{ fontFamily: "Chivo Mono, monospace" }}>
                            {currentEngine[r.key]}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="space-y-4"
                      >
                        {/* Featured quote - Only visible on hover or expand */}
                        <AnimatePresence>
                          {(isHovered || isExpanded) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, y: 10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: 10 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                              className="space-y-2 overflow-hidden"
                            >
                              <div className="text-lg font-medium text-white leading-relaxed">
                                "{section.featured_quote}"
                              </div>
                              {section.featured_quote_source && (
                                <a
                                  href={section.featured_quote_source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs text-white/70 italic hover:text-white transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  — {getDomain(section.featured_quote_source.url)}
                                </a>
                              )}
                              <div className="h-2" /> {/* Spacer */}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Summary - preview or full based on hover/expand */}
                        <motion.div
                          layout
                          className={`text-sm ${isExpanded ? "text-white" : "text-gray-300"} leading-relaxed transition-all duration-300 ${!isHovered && !isExpanded ? "line-clamp-3" : ""}`}
                          dangerouslySetInnerHTML={{
                            __html: processSummaryWithCitations(section?.summary || "", section?.sources || []),
                          }}
                        />

                        {/* Expanded view - quotes and sources */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-white/20 space-y-4"
                          >
                            {/* Source cards */}
                            {section.sources && section.sources.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider" style={{ fontFamily: "Chivo Mono, monospace" }}>
                                  Sources
                                </h4>
                                <div className="grid gap-3">
                                  {section.sources.map((s: any, i: number) => (
                                    <a
                                      key={i}
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block p-3 bg-black/20 border border-white/20 hover:bg-black/40 hover:border-white/40 transition-colors group rounded"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-white truncate group-hover:text-blue-200 transition-colors">
                                            {s.title || 'Untitled'}
                                          </div>
                                          <div className="text-xs text-white/60 truncate mt-1">
                                            {getDomain(s.url)}
                                          </div>
                                        </div>
                                        <ExternalLink size={12} className="text-white/60 group-hover:text-white flex-shrink-0 mt-1" />
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}

          {/* Philosophy Cards (Synthesized Conclusions) */}
          {results?.conclusions?.map((conclusion: any, idx: number) => {
            const isExpanded = expandedCard === `philosophy-${idx}`;
            const isHovered = hoveredCard === `philosophy-${idx}`;
            const colorConfig = COLORS.philosophy;

            return (
              <motion.div
                key={`philosophy-${idx}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * idx }}
                onMouseEnter={() => setHoveredCard(`philosophy-${idx}`)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => setExpandedCard(isExpanded ? null : `philosophy-${idx}`)}
                className={`relative border-2 ${colorConfig.border} p-6 shadow-lg overflow-hidden cursor-pointer transition-colors duration-500 ${isExpanded ? colorConfig.bgSolid : (isHovered ? colorConfig.bgHover : colorConfig.bg)}`}
                style={{
                  borderRadius: 0,
                  minHeight: isExpanded ? "auto" : "120px",
                }}
              >
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className={`text-sm font-bold uppercase ${isExpanded ? "text-white" : colorConfig.accent} tracking-wider`}
                      style={{ fontFamily: "Chivo Mono, monospace" }}
                    >
                      {conclusion.label || "PHILOSOPHY"}
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isExpanded ? "text-white border-white bg-white/20" : "text-gray-400 border-gray-500 bg-gray-900/20"}`}>
                      SYNTHESIS
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Summary */}
                    <motion.div
                      layout
                      className={`text-sm ${isExpanded ? "text-white" : "text-gray-300"} leading-relaxed transition-all duration-300 ${!isHovered && !isExpanded ? "line-clamp-3" : ""}`}
                      dangerouslySetInnerHTML={{
                        __html: processSummaryWithCitations(conclusion.summary || "", aggregatedSourcesList),
                      }}
                    />

                    {/* Expand indicator */}
                    {!isExpanded && (
                      <motion.div
                        layout
                        className="flex justify-center pt-2 opacity-50"
                      >
                        <ChevronDown size={16} className="text-white" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
