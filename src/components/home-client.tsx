"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfrastructLogo } from "@/components/infrastruct-logo";
import { RainbowText } from "@/components/rainbow-text";
import { SearchingScreen } from "@/components/searching-screen";
import { SettingsPage } from "@/components/settings-page";
import { ModelLoadingBar } from "@/components/model-loading-bar";
import { useLocalLlm } from "@/hooks/use-local-llm";
import { synthesizeSearchResults } from "@/lib/local-llm";
import { normalizeSearchResponse } from "@/lib/normalize-results";
import {
  loadEnabledReligions,
  type ReligionKey,
} from "@/lib/religions";

type AppState = "home" | "searching" | "results" | "settings";

type ResultsData = {
  title: string;
  sections: Record<string, unknown>;
  conclusion: string;
  conclusions?: { label: string; summary: string }[];
  sources?: unknown[];
};

type HistoryItem = {
  id: string;
  timestamp: number;
  query: string;
  results: ResultsData;
};

export function HomeClient() {
  const { loadState, isReady, isLoading } = useLocalLlm();
  const [appState, setAppState] = useState<AppState>("home");
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [enabledReligions, setEnabledReligions] = useState<
    Record<ReligionKey, boolean>
  >(() => loadEnabledReligions());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("infrastruct_search_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // ignore corrupt history
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("infrastruct_search_history", JSON.stringify(history));
  }, [history]);

  const addToHistory = (searchQuery: string, results: ResultsData) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (h) => h.query.toLowerCase() !== searchQuery.toLowerCase(),
      );
      return [
        { id: crypto.randomUUID(), timestamp: Date.now(), query: searchQuery, results },
        ...filtered,
      ].slice(0, 20);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !isReady) return;

    const cached = history.find(
      (h) => h.query.toLowerCase() === query.trim().toLowerCase(),
    );
    if (cached) {
      setResultsData(cached.results);
      setAppState("results");
      return;
    }

    setAppState("searching");
  };

  const handleSearchComplete = async (sources: { religion?: string; title?: string; link?: string; engine?: string; snippet?: string }[]) => {
    try {
      const resp = await synthesizeSearchResults(query, sources);
      const norm = normalizeSearchResponse(resp, sources);
      setResultsData(norm);
      addToHistory(query, norm);
      setAppState("results");
    } catch (err) {
      setResultsData({
        title: "Error",
        sections: {},
        conclusion: `Failed to fetch results: ${err instanceof Error ? err.message : String(err)}`,
      });
      setAppState("results");
    }
  };

  const resetToHome = () => {
    setAppState("home");
    setQuery("");
    setResultsData(null);
    setIsTyping(false);
  };

  const openSettings = () => setAppState("settings");

  const closeSettings = () => {
    setEnabledReligions(loadEnabledReligions());
    setAppState("home");
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <nav className="absolute top-4 right-4 md:top-6 md:right-6 z-50">
        <div className="flex flex-row gap-2 md:gap-6 text-gray-400 text-[10px] md:text-base">
          <a className="hover:text-white transition-colors" href="https://github.com/atechnology-company/infrastruct/">
            github
          </a>
          <a className="hover:text-white transition-colors" href="https://undivisible.dev/">
            about me
          </a>
          <button
            type="button"
            onClick={openSettings}
            className="hover:text-white transition-colors text-left"
          >
            settings
          </button>
        </div>
      </nav>

      {appState === "settings" && <SettingsPage onBack={closeSettings} />}

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

            <motion.div
              layout
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full max-w-4xl transition-transform duration-500 ease-out"
            >
              <form onSubmit={handleSubmit} className="w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setIsTyping(e.target.value.length > 0);
                    }}
                    disabled={isLoading && !isReady}
                    className="w-full bg-transparent text-2xl md:text-4xl text-white border-none outline-none transition-transform duration-300 ease-out disabled:opacity-60"
                    placeholder=""
                    autoFocus
                  />
                  <RainbowText
                    text="What is it that you need to know?"
                    isVisible={!isTyping && !query}
                    className="absolute top-0 left-0 text-2xl md:text-4xl font-light pointer-events-none"
                  />
                </div>
                <div className="min-h-[5.5rem] mt-5">
                  <ModelLoadingBar
                    loadState={loadState}
                    visible={isLoading || loadState.status === "error"}
                  />
                  <AnimatePresence mode="wait">
                    {!isTyping && !query && (
                      <motion.p
                        key="start-typing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="mt-12 text-gray-600 text-lg"
                      >
                        just start typing
                      </motion.p>
                    )}
                    {query && isReady && (
                      <motion.p
                        key="press-enter"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="mt-12 text-gray-600 text-lg"
                      >
                        just press enter
                      </motion.p>
                    )}
                    {query && isLoading && (
                      <motion.p
                        key="model-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-12 text-gray-600 text-lg"
                      >
                        waiting for AI model...
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </motion.div>

            {history.length > 0 && !isTyping && !query && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                className="mt-32 w-full max-w-4xl"
              >
                <h3
                  className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-4"
                  style={{ fontFamily: "Chivo Mono, monospace" }}
                >
                  Previous Searches
                </h3>
                <div className="space-y-2">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ x: 10 }}
                      className="cursor-pointer text-gray-400 hover:text-white transition-colors text-lg"
                      onClick={() => {
                        setQuery(item.query);
                        setResultsData(item.results);
                        setAppState("results");
                      }}
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
          <motion.div
            key="searching-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SearchingScreen
              prompt={query}
              enabledReligions={enabledReligions}
              onCompleteAction={handleSearchComplete}
              onStop={resetToHome}
              results={appState === "results" ? resultsData : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
