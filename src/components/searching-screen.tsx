"use client";

import { useEffect, useState } from "react";
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
    let cancelled = false;
    async function fetchQueries() {
      setStatusText("searching...");
      setQueries(null);
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
        // Remove triple backticks and optional "json" label
        return text
          .replace(/^```json\s*/i, "")
          .replace(/```$/i, "")
          .trim();
      }

      try {
        log("Fetching queries for prompt:", prompt);
        const res = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        let rawText = await res.text();
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
        const valid =
          data &&
          typeof data === "object" &&
          data.queries &&
          ["judaism", "christianity", "islam"].every(
            (k) =>
              data.queries[k] &&
              typeof data.queries[k].query === "string" &&
              data.queries[k].query.length > 0 &&
              typeof data.queries[k].numResults === "number",
          );

        if (!cancelled && valid) {
          setQueries(data.queries);
          setStatusText("searching...");
          log("Valid queries set:", data.queries);
        } else if (!cancelled) {
          setStatusText("error");
          log("Invalid queries format received:", data);
        }
      } catch (err) {
        setStatusText("error");
        log("Error fetching queries:", err);
      }
    }
    fetchQueries();
    return () => {
      cancelled = true;
    };
  }, [prompt]);

  // Step 2: Fetch CSE results and scrape content (concurrent for all religions)
  useEffect(() => {
    if (!queries) return;
    let cancelled = false;
    setStreamStarted(true);

    async function fetchAndScrapeConcurrent() {
      await Promise.all(
        RELIGIONS.map(async (r) => {
          const cseId = cseIds[r.key as keyof typeof cseIds];
          if (!queries || !queries[r.key]) return;
          const { query, numResults } = queries[r.key];
          if (!apiKey || !cseId || !query) return;

          // Set the title and idx as soon as search starts for this religion
          setCurrentSiteIdx((prev) => ({ ...prev, [r.key]: 0 }));
          setCurrentSiteTitle((prev) => ({
            ...prev,
            [r.key]: queries[r.key]?.query || r.label,
          }));

          // Fetch CSE results
          let cseData: any = null;
          try {
            const cseRes = await fetch(
              `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=${numResults}`,
            );
            cseData = await cseRes.json();
            log(`CSE results for ${r.label}:`, cseData);
          } catch (err) {
            log(`Error fetching CSE results for ${r.label}:`, err);
            setSources((prev) => ({
              ...prev,
              [r.key]: [
                {
                  religion: r.label,
                  title: "Error fetching results",
                  link: "",
                  color: COLORS[r.key as keyof typeof COLORS],
                  loading: false,
                  query,
                  filled: true,
                  snippet: "",
                },
              ],
            }));
            setErrorState((prev) => ({ ...prev, [r.key]: true }));
            setAllFailed((prev) => ({ ...prev, [r.key]: true }));
            return;
          }

          // For each result, scrape content and animate title
          const items = Array.isArray(cseData.items)
            ? cseData.items.slice(0, numResults)
            : [];
          const scrapedResults: SourceResult[] = [];
          let foundSuccess = false;
          let successCount = 0; // Track successful scrapes

          // Scrape all items concurrently for this religion
          await Promise.all(
            items.map(async (item: any, i: number) => {
              if (cancelled) return;
              // Animate the title in the box for this religion
              setCurrentSiteIdx((prev) => ({ ...prev, [r.key]: i }));
              setCurrentSiteTitle((prev) => ({
                ...prev,
                [r.key]: item.title || "Fetching...",
              }));

              let scraped: any = null;
              let scrapeError = false;
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  const scrapeRes = await fetch(
                    `/api/scrape-content?url=${encodeURIComponent(item.link)}`,
                    {
                      headers: {
                        "User-Agent":
                          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                      },
                    },
                  );
                  if (!scrapeRes.ok)
                    throw new Error(`HTTP ${scrapeRes.status}`);
                  scraped = await scrapeRes.json();

                  // --- FAST PREPROCESSING OF SCRAPED HTML CONTENT ---
                  if (scraped && scraped.content) {
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
                  foundSuccess = true;
                  break;
                } catch (err) {
                  log(
                    `Error scraping content for ${r.label} (attempt ${attempt + 1}):`,
                    err,
                  );
                  scrapeError = true;
                  // Red pulse/flash for error
                  setErrorState((prev) => ({ ...prev, [r.key]: true }));
                  setCurrentSiteTitle((prev) => ({
                    ...prev,
                    [r.key]: "Error fetching site, retrying...",
                  }));
                  // Flash red for 500ms
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  setErrorState((prev) => ({ ...prev, [r.key]: false }));
                  if (attempt === 0) {
                    // Wait before retry
                    await new Promise((resolve) => setTimeout(resolve, 400));
                  }
                }
              }
              if (!scrapeError) {
                scrapedResults.push({
                  religion: r.label,
                  title: item.title || scraped?.title || "No title",
                  link: item.link,
                  color: COLORS[r.key as keyof typeof COLORS],
                  loading: false,
                  snippet: scraped?.content || item.snippet || "",
                  query,
                  filled: true,
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
              }
            }),
          );
          // If no success after all items, show error
          if (!foundSuccess) {
            setAllFailed((prev) => ({ ...prev, [r.key]: true }));
            setCurrentSiteTitle((prev) => ({
              ...prev,
              [r.key]: "Failed to fetch any site.",
            }));
            setErrorState((prev) => ({ ...prev, [r.key]: true }));
            setSources((prev) => ({
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
          }
          // Deduplicate sources for this religion by link (fast, in-place)
          setSources((prev) => ({
            ...prev,
            [r.key]: (prev[r.key] || []).filter(
              (src, idx, arr) =>
                arr.findIndex((s) => s.link === src.link) === idx,
            ),
          }));

          // After all sites, if we didn't reach numResults, mark as done so the process can proceed
          if (successCount < numResults) {
            setAllFailed((prev) => ({ ...prev, [r.key]: true }));
          }
          // After all sites, reset to last title
          setCurrentSiteIdx((prev) => ({
            ...prev,
            [r.key]: items.length - 1,
          }));
          setCurrentSiteTitle((prev) => ({
            ...prev,
            [r.key]: items.length > 0 ? items[items.length - 1].title : "",
          }));
        }),
      );
      setScrapingProgress(null);
    }

    fetchAndScrapeConcurrent();

    return () => {
      cancelled = true;
    };
  }, [queries, apiKey, cseIds]);

  // Animate current source highlight
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSource((prev) => (prev + 1) % RELIGIONS.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [sources.length]);

  // Update status text as results stream in
  useEffect(() => {
    if (!queries) {
      setStatusText("Generating queries...");
      log("Waiting for queries to be generated...");
      return;
    }
    // Check if all scraping is done
    // Consider a religion "done" if it has at least one result (success or error), or all links have been tried
    log("DEBUG allDone check", { sources, allFailed, queries });
    const allDone = RELIGIONS.every((r) => {
      const expected =
        typeof queries?.[r.key]?.numResults === "number"
          ? queries[r.key].numResults
          : 1;
      return (
        sources[r.key] &&
        sources[r.key].length > 0 &&
        (sources[r.key].length >= expected || allFailed[r.key])
      );
    });

    if (!allDone) {
      return;
    }

    // All religions are done (either with results or error), proceed to Gemini
    log("All sources loaded, sending to Gemini for final parsing.");
    setStatusText("generating results...");

    // Prepare payload for Gemini
    const payload = {
      prompt,
      sources,
    };

    // Call Gemini for final parsing/generation
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          log("Error from /api/search:", await res.text());
          return;
        }
        const data = await res.json();
        log("Final Gemini parsed results:", data);
        if (onCompleteAction) {
          setTimeout(() => onCompleteAction(data.response), 700);
        }
      })
      .catch((err) => {
        log("Error calling /api/search:", err);
      });
  }, [sources, queries, onCompleteAction, scrapingProgress]);

  // --- ANIMATION VARIANTS ---
  const boxVariants = {
    initial: { opacity: 0, scale: 0.95, y: 40 },
    visible: { opacity: 1, scale: 1, y: 0 },
    error: {
      opacity: 1,
      scale: 1.04,
      y: 0,
      boxShadow: "0 0 0 4px #dc2626, 0 0 16px 4px #dc2626aa",
      transition: { duration: 0.7 },
    },
    exit: { opacity: 0, scale: 0.95, y: 40 },
  };

  // Slot-machine style vertical animation for title
  const slotMachineVariants = {
    loading: {
      y: [0, -10, 10, 0],
      transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
    },
    idle: { y: 0 },
  };

  // --- RENDER ---
  if (statusText === "error") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col justify-center items-center min-h-screen px-6 md:px-12 bg-black"
      >
        <div className="max-w-2xl w-full mx-auto text-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12"
          >
            <p className="text-red-400 text-2xl font-bold mb-4">
              Something went wrong
            </p>
            <p className="text-gray-400 text-lg mb-8">
              Sorry, we couldn't fetch results at this time.
              <br />
              Please check your internet connection or try again later.
            </p>
            <button
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col justify-center min-h-screen px-6 md:px-12 bg-black"
    >
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
            return (
              <motion.div
                key={r.key}
                variants={boxVariants}
                initial="initial"
                animate="visible"
                exit="exit"
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: idx * 0.15,
                  duration: 0.5,
                }}
                className={`relative border-2 ${COLORS[r.key as keyof typeof COLORS].border} p-8 shadow-lg overflow-hidden flex flex-col min-h-[110px] transition-all duration-700 ${
                  errorState[r.key]
                    ? "animate-pulse bg-red-900"
                    : "bg-transparent"
                }`}
                style={{
                  background: errorState[r.key] ? "#7f1d1d" : "transparent",
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
                      errorState[r.key]
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
                      backgroundColor: errorState[r.key]
                        ? "#7f1d1d"
                        : "transparent",
                      color: errorState[r.key] ? "#fca5a5" : "#fff",
                    }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {currentSiteTitle[r.key]
                      ? currentSiteTitle[r.key]
                      : queries && queries[r.key]?.query
                        ? queries[r.key]?.query
                        : "Generating query..."}
                  </motion.div>
                </div>
                {/* Skeleton overlay only, no fill animation */}
                <AnimatePresence>
                  {(!firstSource || firstSource.loading) && (
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
