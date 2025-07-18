"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfrastructLogo } from "@/components/infrastruct-logo";
import { RainbowText } from "@/components/rainbow-text";

import { SearchingScreen } from "@/components/searching-screen";
import { ResultsScreen } from "@/components/results-screen";

type AppState = "home" | "thinking" | "searching" | "results";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("home");
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

  // Handle search submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setAppState("searching");
  };

  // Callback for SearchingScreen when all results are loaded
  const handleSearchComplete = async (sources: any[]) => {
    try {
      console.log("[App] Search complete, sources:", sources);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      console.log("[App] /api/search response:", data);
      setResultsData({
        title: data.response.title,
        sections: data.response.sections,
        conclusion: data.response.conclusion,
        conclusions: data.response.conclusions,
        sources: data.response.sources,
      });
      setAppState("results");
    } catch (err) {
      console.error("[App] Error fetching results:", err);
      setResultsData({
        title: "Error",
        sections: {},
        conclusion: "Failed to fetch results.",
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

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Navigation */}
      <nav className="absolute top-6 right-6 z-50">
        <div className="flex gap-6 text-gray-400">
          <button className="hover:text-white transition-colors">
            documentation
          </button>
          <button className="hover:text-white transition-colors">about</button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {appState === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col justify-center min-h-screen px-6 md:px-12"
          >
            <div className="mb-10">
              <InfrastructLogo />
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-4xl">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsTyping(e.target.value.length > 0);
                  }}
                  className="w-full bg-transparent text-2xl md:text-4xl text-white border-none outline-none"
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
                      transition={{ duration: 0.3, ease: "easeOut" }}
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
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute bottom-[-60px] left-0 text-gray-600 text-lg"
                    >
                      just press enter
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </motion.div>
        )}

        {appState === "searching" && (
          <SearchingScreen
            key="searching"
            prompt={query}
            onCompleteAction={handleSearchComplete}
          />
        )}

        {appState === "results" && resultsData && (
          <ResultsScreen
            key="results"
            title={resultsData.title}
            sections={resultsData.sections}
            conclusion={resultsData.conclusion}
            conclusions={resultsData.conclusions}
            sources={resultsData.sources}
            onBack={resetToHome}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
