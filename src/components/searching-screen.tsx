"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
];

const COLORS = {
  judaism: {
    border: "border-blue-500",
    bg: "bg-blue-900/50",
    accent: "text-blue-300",
    fill: "bg-blue-900/80",
  },
  christianity: {
    border: "border-amber-500",
    bg: "bg-amber-900/50",
    accent: "text-amber-300",
    fill: "bg-amber-900/80",
  },
  islam: {
    border: "border-green-500",
    bg: "bg-green-900/50",
    accent: "text-green-300",
    fill: "bg-green-900/80",
  },
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
}: {
  prompt: string;
  apiKey?: string;
  cseIds?: { judaism: string; christianity: string; islam: string };
  onCompleteAction?: (results: SourceResult[]) => void;
}) {
  // queries: { judaism: { query, numResults }, ... }
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStopped, setIsStopped] = useState(false);
  const [queries, setQueries] = useState<{
    [key: string]: { query: string; numResults: number };
  } | null>(null);
  // sources: { [religion]: [{...results}] }
  const [sources, setSources] = useState<Record<string, SourceResult[]>>(
    RELIGIONS.reduce(
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
  }>({
    judaism: false,
    christianity: false,
    islam: false,
  });
  // Track current engine for each religion
  const [currentEngine, setCurrentEngine] = useState<{ [key: string]: string }>({
    judaism: '',
    christianity: '',
    islam: '',
  });

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
  }>({
    judaism: 0,
    christianity: 0,
    islam: 0,
  });
  // Track current site title for each religion
  const [currentSiteTitle, setCurrentSiteTitle] = useState<{
    [key: string]: string;
  }>({
    judaism: "",
    christianity: "",
    islam: "",
  });
  // Track error state for each religion (for red pulse/flash)
  const [errorState, setErrorState] = useState<{
    [key: string]: boolean;
  }>({
    judaism: false,
    christianity: false,
    islam: false,
  });
  // Track if all links failed for a religion
  const [allFailed, setAllFailed] = useState<{
    [key: string]: boolean;
  }>({
    judaism: false,
    christianity: false,
    islam: false,
  });

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
        RELIGIONS.reduce(
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
          ["judaism", "christianity", "islam"].every(
            (k) =>
              data.queries[k] &&
              typeof data.queries[k].query === "string" &&
              data.queries[k].query.length > 0 &&
              (typeof data.queries[k].numResults === "number" || typeof data.queries[k].numResults === "string")
          );
        // If numResults is a string, try to parse it as a number
        if (valid) {
          ["judaism", "christianity", "islam"].forEach((k) => {
            if (typeof data.queries[k].numResults === "string") {
              const n = parseInt(data.queries[k].numResults, 10);
              if (!isNaN(n)) data.queries[k].numResults = n;
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

  // Step 2: Fetch CSE results and scrape content (concurrent for all religions)
  useEffect(() => {
    log('Effect: Fetch CSE results and scrape content', { queries, isStopped });
    if (!queries || isStopped) return;
    let cancelled = false;
    abortControllerRef.current = new AbortController();
    setStreamStarted(true);

    async function fetchAndScrapeConcurrent() {
      log('fetchAndScrapeConcurrent: called');
      log('fetchAndScrapeConcurrent: RELIGIONS', RELIGIONS);
  // reset done flags
  setScrapingDone({ judaism: false, christianity: false, islam: false });
      // Assign a different engine to each religion (round-robin)
      const engines = [
        "google",
        "bing",
        "duckduckgo",
        "yahoo",
        "ecosia",
        "startpage",
        "yandex",
        "baidu",
        "ask",
      ];
      await Promise.all(
        RELIGIONS.map(async (r, idx) => {
          log('fetchAndScrapeConcurrent: religion', r);
          if (!queries || !queries[r.key] || isStopped || abortControllerRef.current?.signal.aborted) {
            log('fetchAndScrapeConcurrent: skipping religion', r.key);
            return;
          }
          const { query, numResults } = queries[r.key];
          setCurrentSiteIdx((prev) => ({ ...prev, [r.key]: 0 }));
          setCurrentSiteTitle((prev) => ({
            ...prev,
            [r.key]: queries[r.key]?.query || r.label,
          }));
          log('fetchAndScrapeConcurrent: setCurrentSiteIdx/Title', r.key, queries[r.key]?.query);

          // Fetch search results from Searx API
          let searchData: any = null;
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
              } catch {}
            });
            es.addEventListener('results', (e: MessageEvent) => {
              try {
                const data = JSON.parse(e.data) as { results: any[]; usedEngine: string; usedMirrors?: string[] };
                sseResults = data;
                if (data.usedMirrors) sseMirrors = data.usedMirrors;
                sseDone = true;
                es.close();
                resolve();
              } catch {}
            });
            es.addEventListener('error', (e: MessageEvent) => {
              try {
                sseError = e.data as string;
                sseDone = true;
                es.close();
                resolve();
              } catch {}
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
                  title: "No results found (Searx failed)",
                  link: "",
                  color: COLORS[r.key as keyof typeof COLORS],
                  loading: false,
                  query,
                  filled: true,
                  snippet: "Searx failed or returned no results. Try again later or check your Searx instance.",
                  engine: 'none',
                },
              ],
            }));
            setErrorState((prev) => ({ ...prev, [r.key]: true }));
            setAllFailed((prev) => ({ ...prev, [r.key]: true }));
            setCurrentEngine((prev) => ({ ...prev, [r.key]: 'none' }));
            // mark this religion as done even if failed
            setScrapingDone((prev) => ({ ...prev, [r.key]: true }));
            return;
          }
          // Show final mirror used
          setCurrentSiteTitle((prev) => ({ ...prev, [r.key]: `Results from: ${sseMirrors.join(', ')}` }));
          setCurrentEngine((prev) => ({ ...prev, [r.key]: sseMirrors.length > 0 ? sseMirrors[sseMirrors.length - 1] : 'searx' }));
          searchData = sseResults;

          // For each result, scrape content and animate title
          const items = Array.isArray(searchData.results)
            ? searchData.results.slice(0, numResults)
            : [];
          // Save which engine was used for this religion
          const usedEngine = searchData.usedEngine || "searx";
          log('fetchAndScrapeConcurrent: items to scrape', r.key, items);
          const scrapedResults: SourceResult[] = [];
          let foundSuccess = false;
          let successCount = 0; // Track successful scrapes

          // Scrape all items concurrently for this religion
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
                    // Remove boilerplate: headers, footers, nav, ads (simple regex, fast)
                    text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
                    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
                    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
                    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, "");
                    text = text.replace(/<form[\s\S]*?<\/form>/gi, "");
                    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
                    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
                    text = text.replace(/<!--[\s\S]*?-->/g, "");

                    // Remove common ad blocks by class/id (very basic, fast)
                    text = text.replace(
                      /<div[^>]*(id|class)=".*?(ad|ads|advert|banner).*?"[^>]*>[\s\S]*?<\/div>/gi,
                      "",
                    );

                    // Remove excessive whitespace
                    text = text.replace(/\s{3,}/g, "  ");
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
                  color: COLORS[r.key as 'judaism' | 'christianity' | 'islam'],
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
                      color: COLORS[r.key as 'judaism' | 'christianity' | 'islam'],
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
          // Deduplicate sources for this religion by link (fast, in-place)
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
          // mark this religion as done
          setScrapingDone((prev) => ({ ...prev, [r.key]: true }));
        }),
      );
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
  };

  // Animate current source highlight
  useEffect(() => {
    log('Effect: Animate current source highlight');
    const interval = setInterval(() => {
      setCurrentSource((prev) => (prev + 1) % RELIGIONS.length);
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
    // Check if all scraping tasks are done per religion
    log("DEBUG allDone check", { sources, allFailed, queries, scrapingDone });
    const allDone = RELIGIONS.every((r) => scrapingDone[r.key]);

    if (allDone && onCompleteAction) {
      setStatusText("generating results...");
      log("[SearchingScreen] TRIGGER onCompleteAction", { allDone, allFailed, sources });
      onCompleteAction(Object.values(sources).flat());
    }
  }, [queries, sources, allFailed, scrapingDone]);

  // --- MAIN RETURN BLOCK ---
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col justify-center min-h-screen px-6 md:px-12 bg-black"
    >
      <button
        onClick={handleStop}
        className="fixed top-6 left-6 z-50 px-4 py-2 bg-red-600 text-white rounded font-bold shadow hover:bg-red-700 transition-colors"
        style={{ minWidth: 80 }}
        disabled={isStopped}
      >
        Stop
      </button>
      <div className="max-w-4xl w-full mx-auto">
        {/* Animated Searching... or Generating Results... status at top */}
        {statusText && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12"
          >
            <p
              className="text-gray-400 text-lg mb-8"
              style={{ fontFamily: "Instrument Sans, sans-serif" }}
            >
              <span style={{ display: "inline-block", minWidth: "120px" }}>
                <motion.span
                  key={statusText}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{
                    y: 0,
                    opacity: 1,
                  }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    display: "inline-block",
                    fontFamily: "Instrument Sans, sans-serif",
                    letterSpacing: "0.04em",
                  }}
                >
                  {statusText.charAt(0).toUpperCase() +
                    statusText.slice(1).replace(/\.\.\.$/, "")}
                </motion.span>
                <motion.span
                  key={dotCount}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{
                    y: 0,
                    opacity: 1,
                  }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    display: "inline-block",
                    marginLeft: "2px",
                  }}
                >
                  {".".repeat(dotCount)}
                </motion.span>
              </span>
            </p>
          </motion.div>
        )}
        <div className="space-y-8">
          {RELIGIONS.map((r, idx) => {
            // Find the first loaded source for this religion, or show loading
            const firstSource = (sources[r.key] && sources[r.key][0]) || null;
            const engineLabel = currentEngine[r.key] && currentEngine[r.key] !== 'none'
              ? `Mirror: ${currentEngine[r.key]}`
              : firstSource && firstSource.engine === 'none'
                ? 'No engine succeeded'
                : '';
            // Only show error visuals if allFailed is true and no valid sources exist
            const showError = allFailed[r.key] && (!sources[r.key] || sources[r.key].length === 0 || (firstSource && firstSource.engine === 'none'));
            return (
              <motion.div
                key={r.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: idx * 0.15,
                  duration: 0.5,
                }}
                className={`relative border-2 ${COLORS[r.key as keyof typeof COLORS].border} p-8 shadow-lg overflow-hidden flex flex-col min-h-[110px] transition-all duration-700 ${
                  showError
                    ? "animate-pulse bg-red-900"
                    : "bg-transparent"
                }`}
                style={{
                  background: showError ? "#7f1d1d" : "transparent",
                  borderRadius: 0,
                  fontFamily: "Instrument Sans, sans-serif",
                  transition: "background 0.4s cubic-bezier(.4,0,.2,1)",
                }}
              >
                <div className="flex-1">
                  <div
                    className={`text-sm font-semibold uppercase ${COLORS[r.key as keyof typeof COLORS].accent} mb-1 tracking-wide`}
                  >
                    {r.label}
                  </div>
                  <motion.div
                    className={`text-xl font-bold text-white mb-2 flex items-center ${
                      showError
                        ? "animate-pulse bg-red-900 text-red-300"
                        : ""
                    }`}
                    style={{
                      fontFamily: "Chivo Mono, monospace",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderRadius: 0,
                      transition: "background 0.3s, color 0.3s",
                    }}
                    key={currentSiteIdx[r.key]}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{
                      y: 0,
                      opacity: 1,
                      backgroundColor: showError
                        ? "#7f1d1d"
                        : "rgba(0,0,0,0)",
                      color: showError ? "#fca5a5" : "#fff",
                    }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {/* Show current page title as it comes in */}
                    {showError
                      ? "Error fetching all results"
                      : currentSiteTitle[r.key]
                        ? currentSiteTitle[r.key]
                        : queries && queries[r.key]?.query
                          ? queries[r.key]?.query
                          : "Generating query..."}
                  </motion.div>
                  {/* Show mirror name */}
                  {engineLabel && (
                    <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: "Chivo Mono, monospace" }}>
                      {engineLabel}
                    </div>
                  )}
                  {/* No result content shown here */}
                </div>
                {/* Skeleton overlay only, no fill animation */}
                <AnimatePresence>
                  {(!firstSource || firstSource.loading) && !showError && (
                    <motion.div
                      key="skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.15 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gray-800 pointer-events-none"
                      style={{ borderRadius: 0 }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
