"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfrastructLogo } from "@/components/infrastruct-logo";
import { RainbowText } from "@/components/rainbow-text";

import { SearchingScreen } from "@/components/searching-screen";
import { SettingsPage } from "@/components/settings-page";

type AppState = "home" | "thinking" | "searching" | "results" | "settings";

// Simple error boundary to reveal render errors on the results page
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[Results ErrorBoundary] error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-red-300">
          Results failed to render.
          <pre className="mt-2 whitespace-pre-wrap text-red-400">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("home");
  // Debug appState transitions
  React.useEffect(() => {
    console.log("[App] appState:", appState);
  }, [appState]);
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // ResultsScreen expects this structure:
  const [resultsData, setResultsData] = useState<{
    title: string;
    sections: any;
    conclusion: string;
    conclusions?: any;
    sources?: any[];
  } | null>(null);

  // History state
  const [history, setHistory] = useState<{ id: string; timestamp: number; query: string; results: any }[]>([]);

  // Load history from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("infrastruct_search_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem("infrastruct_search_history", JSON.stringify(history));
  }, [history]);

  const addToHistory = (query: string, results: any) => {
    setHistory((prev) => {
      // Remove existing entry for same query to avoid duplicates
      const filtered = prev.filter((h) => h.query.toLowerCase() !== query.toLowerCase());
      const newItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        query,
        results,
      };
      // Keep last 20 items
      return [newItem, ...filtered].slice(0, 20);
    });
  };

  const loadFromHistory = (item: { query: string; results: any }) => {
    setQuery(item.query);
    setResultsData(item.results);
    setAppState("results");
  };

  // Handle search submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Check cache
    const cached = history.find((h) => h.query.toLowerCase() === query.trim().toLowerCase());
    if (cached) {
      console.log("[App] Cache hit for:", query);
      setResultsData(cached.results);
      setAppState("results");
      return;
    }

    setAppState("searching");
  };

  // Callback for SearchingScreen when all results are loaded
  const handleSearchComplete = async (sources: any[]) => {
    console.log("[App] ===== handleSearchComplete START =====");
    console.log("[App] handleSearchComplete called with sources:", sources?.length, "items");

    try {
      console.log("[App] Fetching /api/search...");
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources }),
      });
      console.log("[App] /api/search fetch completed, status:", res.status);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      console.log("[App] /api/search response received");
      console.log("[App] /api/search response keys:", Object.keys(data));

      const resp = data?.response || {};
      console.log("[App] response object keys:", Object.keys(resp));

      const title = resp.title || "Results";
      const rawSections = resp.sections || {};
      console.log("[App] rawSections keys:", Object.keys(rawSections));
      // Normalize sections to required shape and keys
      const pickSection = (obj: any, key: string) => {
        if (!obj || typeof obj !== 'object') return {
          featured_quote: '',
          featured_quote_source: null,
          status: null,
          summary: '',
          sources: [],
        };
        const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key);
        const sec = foundKey ? obj[foundKey] : null;
        if (!sec || typeof sec !== 'object') return {
          featured_quote: '',
          featured_quote_source: null,
          status: null,
          summary: '',
          sources: [],
        };
        return {
          featured_quote: typeof sec.featured_quote === 'string' ? sec.featured_quote : '',
          featured_quote_source: sec.featured_quote_source && typeof sec.featured_quote_source === 'object'
            ? { title: sec.featured_quote_source.title || '', url: sec.featured_quote_source.url || '' }
            : null,
          status: ["permitted", "forbidden", "disliked", "unsure", "encouraged", "obligatory"].includes(sec.status)
            ? sec.status
            : null,
          summary: typeof sec.summary === 'string' ? sec.summary : '',
          sources: Array.isArray(sec.sources) ? sec.sources.map((s: any) => ({ title: s?.title || '', url: s?.url || '', engine: s?.engine })) : [],
        } as any;
      };
      const sections = {
        judaism: pickSection(rawSections, 'judaism'),
        christianity: pickSection(rawSections, 'christianity'),
        islam: pickSection(rawSections, 'islam'),
        hinduism: pickSection(rawSections, 'hinduism'),
        sikhism: pickSection(rawSections, 'sikhism'),
        buddhism: pickSection(rawSections, 'buddhism'),
        philosophy: pickSection(rawSections, 'philosophy'),
      } as any;
      const conclusion = typeof resp.conclusion === 'string' ? resp.conclusion : undefined;
      const conclusions = Array.isArray(resp.conclusions)
        ? resp.conclusions
        : (resp.conclusion ? [{ label: "Conclusion", summary: resp.conclusion }] : []);
      // If AI returned empty sections, build a minimal fallback from scraped sources
      const emptyJudaism = !sections.judaism?.summary && !(sections.judaism?.sources?.length);
      const emptyChristianity = !sections.christianity?.summary && !(sections.christianity?.sources?.length);
      const emptyIslam = !sections.islam?.summary && !(sections.islam?.sources?.length);
      const emptyHinduism = !sections.hinduism?.summary && !(sections.hinduism?.sources?.length);
      const emptySikhism = !sections.sikhism?.summary && !(sections.sikhism?.sources?.length);
      const emptyBuddhism = !sections.buddhism?.summary && !(sections.buddhism?.sources?.length);
      if (Array.isArray(sources) && (emptyJudaism || emptyChristianity || emptyIslam || emptyHinduism || emptySikhism || emptyBuddhism)) {
        const grouped: Record<'judaism' | 'christianity' | 'islam' | 'hinduism' | 'sikhism' | 'buddhism', any[]> = { judaism: [], christianity: [], islam: [], hinduism: [], sikhism: [], buddhism: [] };
        for (const s of sources) {
          const rel = String(s?.religion || '').toLowerCase();
          if (rel.includes('juda')) grouped.judaism.push(s);
          else if (rel.includes('christ')) grouped.christianity.push(s);
          else if (rel.includes('islam')) grouped.islam.push(s);
          else if (rel.includes('hindu')) grouped.hinduism.push(s);
          else if (rel.includes('sikh')) grouped.sikhism.push(s);
          else if (rel.includes('buddh')) grouped.buddhism.push(s);
        }
        const makeSection = (arr: any[], label: string) => {
          const top = arr[0];
          return {
            featured_quote: top?.title || `Top sources for ${label}`,
            featured_quote_source: top?.link ? { title: top?.title || top?.link, url: top?.link } : null,
            status: null,
            summary: (arr.slice(0, 3).map((a, i) => `- [${label}, ${i + 1}] ${a.title || a.link || ''}`).join('\n')) || '',
            sources: arr.map((a) => ({ title: a.title || a.link || '', url: a.link || '', engine: a.engine })),
          } as any;
        };
        if (emptyJudaism) sections.judaism = makeSection(grouped.judaism, 'Judaism');
        if (emptyChristianity) sections.christianity = makeSection(grouped.christianity, 'Christianity');
        if (emptyIslam) sections.islam = makeSection(grouped.islam, 'Islam');
        if (emptyHinduism) sections.hinduism = makeSection(grouped.hinduism, 'Hinduism');
        if (emptySikhism) sections.sikhism = makeSection(grouped.sikhism, 'Sikhism');
        if (emptyBuddhism) sections.buddhism = makeSection(grouped.buddhism, 'Buddhism');
      }

      const norm = {
        title,
        sections,
        conclusion,
        conclusions,
        sources: resp.sources,
      };
      console.log("[App] normalized resultsData:", norm);
      console.log("[App] resultsData sections:", Object.keys(norm.sections));
      console.log("[App] resultsData conclusions:", norm.conclusions);
      setResultsData(norm);
      addToHistory(query, norm); // Save to history
      console.log("[App] setResultsData complete");
      setAppState("results");
      console.log("[App] setAppState to results complete");
      console.log("[App] ===== handleSearchComplete SUCCESS =====");
    } catch (err) {
      console.error("[App] ===== handleSearchComplete ERROR =====");
      console.error("[App] Error type:", err?.constructor?.name);
      console.error("[App] Error message:", err instanceof Error ? err.message : String(err));
      console.error("[App] Error stack:", err instanceof Error ? err.stack : "N/A");
      console.error("[App] Full error:", err);

      setResultsData({
        title: "Error",
        sections: {},
        conclusion: `Failed to fetch results: ${err instanceof Error ? err.message : String(err)}`,
      });
      setAppState("results");
      console.log("[App] setAppState to results (error case)");
    }
  };

  const resetToHome = () => {
    setAppState("home");
    setQuery("");
    setResultsData(null);
    setIsTyping(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Navigation */}
      <nav className="absolute top-6 right-6 z-50">
        <div className="flex gap-6 text-gray-400">
          <button className="hover:text-white transition-colors">
            documentation
          </button>
          <button className="hover:text-white transition-colors">about</button>
          <button
            onClick={() => setAppState("settings")}
            className="hover:text-white transition-colors"
          >
            settings
          </button>
        </div>
      </nav>

      {/* Settings Screen */}
      {appState === "settings" && (
        <SettingsPage onBack={() => setAppState("home")} />
      )}

      <AnimatePresence mode="wait" initial={false}>
        {appState === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col justify-center min-h-screen px-6 md:px-12"
          >
            <motion.div layout transition={{ duration: 0.6, ease: "easeOut" }} className="mb-10">
              <InfrastructLogo />
            </motion.div>

            <motion.div layout transition={{ duration: 0.6, ease: "easeOut" }} className="w-full max-w-4xl transition-transform duration-500 ease-out">
              <form onSubmit={handleSubmit} className="w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setIsTyping(e.target.value.length > 0);
                    }}
                    className="w-full bg-transparent text-2xl md:text-4xl text-white border-none outline-none transition-transform duration-300 ease-out"
                    placeholder=""
                    autoFocus
                  />
                  <RainbowText
                    text="What is it that you need to know?"
                    isVisible={!isTyping && !query}
                    className="absolute top-0 left-0 text-2xl md:text-4xl font-light pointer-events-none"
                  />
                  <AnimatePresence mode="wait">
                    {!isTyping && !query && (
                      <motion.div
                        key="start-typing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="absolute bottom-[-60px] left-0 text-gray-600 text-lg"
                      >
                        just start typing
                      </motion.div>
                    )}
                    {query && (
                      <motion.div
                        key="press-enter"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="absolute bottom-[-60px] left-0 text-gray-600 text-lg"
                      >
                        just press enter
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </motion.div>

            {/* Search History */}
            {history.length > 0 && !isTyping && !query && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                className="mt-32 w-full max-w-4xl"
              >
                <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "Chivo Mono, monospace" }}>
                  Previous Searches
                </h3>
                <div className="space-y-2">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ x: 10 }}
                      className="cursor-pointer text-gray-400 hover:text-white transition-colors text-lg"
                      onClick={() => loadFromHistory(item)}
                    >
                      {item.query}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {(appState === "searching" || appState === "results") && (
          <motion.div key="searching-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SearchingScreen
              prompt={query}
              onCompleteAction={handleSearchComplete}
              onStop={resetToHome}
              results={resultsData}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
