"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InfrastructLogo } from "@/components/infrastruct-logo";
import { RainbowText } from "@/components/rainbow-text";

import { SearchingScreen } from "@/components/searching-screen";
import dynamic from "next/dynamic";
const ResultsScreenDynamic = dynamic(
  () => import("@/components/results-screen").then((m) => m.ResultsScreen),
  { ssr: false, loading: () => <div className="p-6 text-gray-400">Loading results…</div> }
);

type AppState = "home" | "thinking" | "searching" | "results";

// Simple error boundary to reveal render errors on the results page
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }>{
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

  // Handle search submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setAppState("searching");
  };

  // Callback for SearchingScreen when all results are loaded
  const handleSearchComplete = async (sources: any[]) => {
    try {
      console.log("[App] handleSearchComplete called with sources:", sources);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      console.log("[App] /api/search fetch completed");
      const data = await res.json();
      console.log("[App] /api/search response:", data);
      const resp = data?.response || {};
      const title = resp.title || "Results";
      const rawSections = resp.sections || {};
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
          status: ["permitted","forbidden","disliked","unsure","encouraged","obligatory"].includes(sec.status)
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
      } as any;
      const conclusion = typeof resp.conclusion === 'string' ? resp.conclusion : undefined;
      const conclusions = Array.isArray(resp.conclusions)
        ? resp.conclusions
        : (resp.conclusion ? [{ label: "Conclusion", summary: resp.conclusion }] : []);
      // If AI returned empty sections, build a minimal fallback from scraped sources
      const emptyJudaism = !sections.judaism?.summary && !(sections.judaism?.sources?.length);
      const emptyChristianity = !sections.christianity?.summary && !(sections.christianity?.sources?.length);
      const emptyIslam = !sections.islam?.summary && !(sections.islam?.sources?.length);
      if (Array.isArray(sources) && (emptyJudaism || emptyChristianity || emptyIslam)) {
        const grouped: Record<'judaism'|'christianity'|'islam', any[]> = { judaism: [], christianity: [], islam: [] };
        for (const s of sources) {
          const rel = String(s?.religion || '').toLowerCase();
          if (rel.includes('juda')) grouped.judaism.push(s);
          else if (rel.includes('christ')) grouped.christianity.push(s);
          else if (rel.includes('islam')) grouped.islam.push(s);
        }
        const makeSection = (arr: any[], label: string) => {
          const top = arr[0];
          return {
            featured_quote: top?.title || `Top sources for ${label}`,
            featured_quote_source: top?.link ? { title: top?.title || top?.link, url: top?.link } : null,
            status: null,
            summary: (arr.slice(0, 3).map((a, i) => `- [${label}, ${i+1}] ${a.title || a.link || ''}`).join('\n')) || '',
            sources: arr.map((a) => ({ title: a.title || a.link || '', url: a.link || '', engine: a.engine })),
          } as any;
        };
        if (emptyJudaism) sections.judaism = makeSection(grouped.judaism, 'Judaism');
        if (emptyChristianity) sections.christianity = makeSection(grouped.christianity, 'Christianity');
        if (emptyIslam) sections.islam = makeSection(grouped.islam, 'Islam');
      }

  const norm = {
        title,
        sections,
        conclusion,
        conclusions,
        sources: resp.sources,
      };
  console.log("[App] normalized resultsData:", norm);
      setResultsData(norm);
      setAppState("results");
      console.log("[App] setAppState to results");
    } catch (err) {
      console.error("[App] Error fetching results:", err);
      setResultsData({
        title: "Error",
        sections: {},
        conclusion: "Failed to fetch results.",
      });
      setAppState("results");
      console.log("[App] setAppState to results (error)");
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

  <AnimatePresence mode="sync" initial={false}>
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

    {appState === "results" && (
      <motion.div key="results-wrapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-50">
            {/* Debug banner to confirm results view is mounted */}
            <div className="fixed top-2 left-2 text-xs text-gray-500 pointer-events-none" style={{ zIndex: 60 }}>
              results view mounted
            </div>
            {/* Visible placeholder to prove results branch renders */}
            <div className="p-4 border border-gray-700 bg-gray-900/60 mb-2 text-xs text-gray-300">results placeholder (branch active)</div>
            <ErrorBoundary>
              <ResultsScreenDynamic
        key="results"
                title={resultsData?.title || "Results"}
                sections={
                  resultsData?.sections || {
                    judaism: { featured_quote: "", featured_quote_source: null, status: null, summary: "", sources: [] },
                    christianity: { featured_quote: "", featured_quote_source: null, status: null, summary: "", sources: [] },
                    islam: { featured_quote: "", featured_quote_source: null, status: null, summary: "", sources: [] },
                  }
                }
                conclusion={resultsData?.conclusion}
                conclusions={resultsData?.conclusions}
                sources={resultsData?.sources}
                onBack={resetToHome}
              />
            </ErrorBoundary>
      </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
