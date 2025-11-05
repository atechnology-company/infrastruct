"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { marked } from "marked";
import React from "react";

// Types for new JSON format
type ReligionKey = "judaism" | "christianity" | "islam";
type StatusType =
  | "permitted"
  | "forbidden"
  | "disliked"
  | "unsure"
  | "encouraged"
  | "obligatory";

interface ReligionSection {
  featured_quote: string;
  featured_quote_source: { title: string; url: string } | null;
  status: StatusType | null;
  summary: string;
  sources: Source[];
}

type Source = { title: string; url: string; religion?: string; engine?: string };

interface ResultsScreenProps {
  title: string;
  sections: Record<ReligionKey, ReligionSection>;
  // Now supports multiple conclusions
  conclusion?: string;
  conclusions?: { summary: string; label?: string }[];
  sources?: Source[];
  onBack: () => void;
}

const religionColors: Record<
  ReligionKey,
  { border: string; bg: string; accent: string }
> = {
  judaism: {
    border: "border-blue-500",
    bg: "bg-blue-900/50",
    accent: "text-blue-300",
  },
  christianity: {
    border: "border-amber-500",
    bg: "bg-amber-900/50",
    accent: "text-amber-300",
  },
  islam: {
    border: "border-green-500",
    bg: "bg-green-900/50",
    accent: "text-green-300",
  },
};

const statusColors: Record<StatusType, string> = {
  forbidden: "text-red-400",
  permitted: "text-amber-400",
  disliked: "text-amber-700",
  unsure: "text-gray-400",
  encouraged: "text-green-400",
  obligatory: "text-green-600",
};

function renderMarkdownWithReferences(md: string, sources: string[]) {
  // Replace [n] with superscript links to sources
  let html = marked.parse(md, { breaks: true, gfm: true }) as string;
  // Find [n] patterns and replace with links to sources
  html = html.replace(/\[(\d+)\]/g, (match, n) => {
    const idx = parseInt(n, 10) - 1;
    if (sources[idx]) {
      const url = sources[idx];
      return `<sup><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">[${n}]</a></sup>`;
    }
    return `<sup>[${n}]</sup>`;
  });
  return html;
}

export function ResultsScreen({
  title,
  sections,
  conclusion,
  conclusions,
  sources,
  onBack,
}: ResultsScreenProps) {
  // Modal logic removed
  const [cardTransition, setCardTransition] = useState(false);

  // Debug log for received props
  useEffect(() => {
    console.log('[ResultsScreen] props:', { title, sections, conclusion, conclusions, sources });
  }, [title, sections, conclusion, conclusions, sources]);

  // Animation variants
  const cardVariants = {
    initial: { opacity: 0, y: 40, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 40, scale: 0.95 },
  };

  // Ensure sections have safe defaults so cards always render
  const safeSections: Record<ReligionKey, ReligionSection> = {
    judaism: {
      featured_quote: sections?.judaism?.featured_quote || "",
      featured_quote_source: sections?.judaism?.featured_quote_source || null,
      status: (sections?.judaism?.status as any) ?? null,
      summary: sections?.judaism?.summary || "",
      sources: Array.isArray(sections?.judaism?.sources) ? sections.judaism.sources : [],
    },
    christianity: {
      featured_quote: sections?.christianity?.featured_quote || "",
      featured_quote_source: sections?.christianity?.featured_quote_source || null,
      status: (sections?.christianity?.status as any) ?? null,
      summary: sections?.christianity?.summary || "",
      sources: Array.isArray(sections?.christianity?.sources) ? sections.christianity.sources : [],
    },
    islam: {
      featured_quote: sections?.islam?.featured_quote || "",
      featured_quote_source: sections?.islam?.featured_quote_source || null,
      status: (sections?.islam?.status as any) ?? null,
      summary: sections?.islam?.summary || "",
      sources: Array.isArray(sections?.islam?.sources) ? sections.islam.sources : [],
    },
  };

  // Fallback UI for empty or error states
  if (!title && !sections) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-400">
        <h2 className="text-2xl mb-4">No results found</h2>
        <button onClick={onBack} className="px-4 py-2 bg-gray-700 rounded text-white">Back</button>
      </div>
    );
  }

  const religions: ReligionKey[] = ["judaism", "christianity", "islam"];

  // Animate card fill on mount
  useEffect(() => {
    const timeout = setTimeout(() => setCardTransition(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  // Helper to chunk conclusions for card preview
  function getConclusionChunks(arr: string[] | undefined, n: number) {
    if (!arr) return [];
    const size = Math.ceil(arr.length / n);
    return Array.from({ length: n }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }

  // Render conclusion preview chunk (first 2 lines or 120 chars)
  function renderConclusionPreview(text: string) {
    const lines = text.split("\n").filter(Boolean);
    const preview = lines.slice(0, 2).join(" ");
    return preview.length > 120 ? preview.slice(0, 120) + "..." : preview;
  }

  // In-text referencing renderer: handles [Religion, n] and [Religion, n; ...] multi-references, color-coded by religion
  function renderMarkdownWithReferences(
    md: string | { summary: string },
    sourcesByReligion: Record<string, Source[]>,
    getColor: (religion: string) => string,
  ) {
    const markdown = typeof md === "string" ? md : md.summary;
    let html = marked.parse(markdown, { breaks: true, gfm: true }) as string;

    // Replace [Religion, n; ...] with colored, clickable tabs for each reference
    html = html.replace(
      /\[((?:[A-Za-z]+,\s*\d+\s*;?\s*)+)\]/g,
      (match, refs) => {
        const refArr: string[] = refs
          .split(";")
          .map((ref: string) => ref.trim())
          .filter(Boolean);
        return refArr
          .map((ref) => {
            const m = ref.match(/^([A-Za-z]+),\s*(\d+)$/);
            if (!m) return `<sup>[${ref}]</sup>`;
            const religion = m[1];
            const rel = religion.toLowerCase();
            const idx = parseInt(m[2], 10) - 1;
            const srcArr = sourcesByReligion[rel];
            if (!srcArr || !srcArr[idx])
              return `<sup>[${religion}, ${m[2]}]</sup>`;
            const src = srcArr[idx];
            // Judaism is always blue
            const color = rel === "judaism" ? "#60a5fa" : getColor(rel);
            return `<a href="${src.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 2px;padding:2px 8px;border-radius:6px;background:${color};color:#fff;font-family:'Chivo Mono',monospace;font-size:0.85em;text-transform:uppercase;text-decoration:none;vertical-align:middle;">${src.title ? src.title.toUpperCase() : `[${religion}, ${m[2]}]`}</a>`;
          })
          .join("");
      },
    );
    return html;
  }

  // Font wrappers removed; use Tailwind classes directly

  // Helper to get accent color for a religion
  function getAccentColor(religion: string) {
    const rel = religion.toLowerCase();
    if (rel.includes("jew")) return "#60a5fa";
    if (rel.includes("christ")) return "#fbbf24";
    if (rel.includes("islam")) return "#34d399";
    return "#fff";
  }

  // Helper to prefer Sefaria for Jewish Torah sources
  function preferSefaria(sources: Source[] = []) {
    return (Array.isArray(sources) ? sources : []).map((src) => {
      if (
        src.url &&
        src.url.match(/biblegateway\.com/i) &&
        src.title &&
        (src.title.toLowerCase().includes("genesis") ||
          src.title.toLowerCase().includes("exodus") ||
          src.title.toLowerCase().includes("leviticus") ||
          src.title.toLowerCase().includes("numbers") ||
          src.title.toLowerCase().includes("deuteronomy"))
      ) {
        // Try to convert to Sefaria link if possible
        // e.g. Genesis 1:1 -> https://www.sefaria.org/Genesis.1.1
        const match = src.title.match(
          /(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+):(\d+)/i,
        );
        if (match) {
          const sefariaUrl = `https://www.sefaria.org/${match[1]}.${match[2]}.${match[3]}`;
          return { ...src, url: sefariaUrl };
        }
      }
      return src;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // Ensure the results view sits above any leftover overlays
      className={`min-h-screen px-6 md:px-12 py-8 bg-black font-instrument-sans relative z-[70]`}
    >
      {/* DEBUG: small overlay to confirm props/content are rendered visually */}
      <div className="fixed top-16 right-6 z-[80] bg-white/90 text-black p-2 text-xs rounded-sm pointer-events-none">
        <div className="font-semibold">Results debug</div>
        <div style={{maxWidth: 320, maxHeight: 180, overflow: 'auto', fontFamily: 'monospace', fontSize: 11}}>
          {JSON.stringify({ title, sections: Object.keys(sections || {}), conclusion: !!conclusion, conclusions: !!conclusions, sources: Array.isArray(sources) ? sources.length : (sources ? 1 : 0) })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          Back to search
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-4xl md:text-5xl font-light mb-12 text-white font-instrument-sans`}
        >
          {title}
        </motion.h1>

        <div className="flex flex-col gap-8 mb-12">
          {religions.map((religion, idx) => {
            const section = safeSections[religion];
            // Determine if this section is in error state (for demo, let's say forbidden is error)
            const isError = section.status === "forbidden";
            // Show which search engine was used (if available)
            const engine = Array.isArray(section.sources) && section.sources.length > 0 && section.sources[0].engine
              ? section.sources[0].engine
              : undefined;
            return (
              <motion.div
                key={religion}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ delay: idx * 0.15, duration: 0.5 }}
                className={`cursor-pointer border-2 ${religionColors[religion].border} ${cardTransition ? religionColors[religion].bg : "bg-transparent"} p-8 shadow-lg hover:scale-[1.02] transition-transform relative overflow-hidden font-instrument-sans border-solid ${isError ? "bg-red-900/80" : ""}`}
                style={{ borderRadius: 0 }}
              >
                {/* Animated fill effect */}
                <motion.div
                  initial={{ scaleY: 0, opacity: 0.2 }}
                  animate={{
                    scaleY: cardTransition ? 1 : 0,
                    opacity: cardTransition ? 1 : 0.2,
                  }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className={`absolute inset-0 pointer-events-none ${isError ? "bg-red-900/80" : "bg-white/10"}`}
                  style={{
                    transformOrigin: "bottom",
                    zIndex: 0,
                    borderRadius: 0,
                  }}
                />
                <div className="relative z-10 flex flex-col gap-4">
                  {engine && (
                    <div className="text-xs text-gray-400 mb-2 font-chivo-mono">
                      Search engine used: <span className="font-bold">{engine}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div
                        className={`text-sm font-semibold mb-1 tracking-wide font-chivo-mono ${religionColors[religion].accent}`}
                      >
                        {religion}
                      </div>
                      {/* Featured quote at top, large */}
                      <div
                        className={`text-3xl mb-2 leading-snug ${isError ? "text-red-300" : "text-white"} font-chivo-mono`}
                        style={{ fontWeight: 700 }}
                      >
                        {section.featured_quote || ""}
                      </div>
                      {/* Featured quote source */}
                      {section.featured_quote_source &&
                        section.featured_quote_source.url && (
                          <a
                            href={section.featured_quote_source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        className={`block text-xs mt-1 mb-2 text-blue-300 underline font-chivo-mono`}
                            style={{ fontWeight: 400 }}
                          >
                            {section.featured_quote_source.title
                              ? section.featured_quote_source.title.toUpperCase()
                              : section.featured_quote_source.url}
                          </a>
                        )}
                    </div>
                    {/* Status badge, only if not null */}
                    {section.status !== null && (
                      <div
                        className={`text-xl font-semibold ${statusColors[section.status]} font-chivo-mono ${isError ? "animate-pulse" : ""}`}
                      >
                        {section.status.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Summary/content with in-text referencing */}
                  <div
                    className={`mb-4 leading-relaxed text-lg mt-2 font-instrument-sans`}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownWithReferences(
                        section.summary || "",
                        {
                          [religion]: Array.isArray(section.sources)
                            ? section.sources
                            : [],
                        },
                        (rel) => getAccentColor(rel),
                      ),
                    }}
                  />
                  {/* Sources as cards (color-coded) */}
                  <div className="flex flex-wrap gap-4 mt-2">
                    {Array.isArray(section.sources) &&
                      section.sources.map((src: Source, i: number) => (
                        <motion.a
                          key={src.url + i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.08 }}
                          className={`block px-4 py-3 text-xs shadow hover:scale-105 hover:brightness-110 transition-all font-chivo-mono`}
                          style={{
                            borderRadius: 0,
                            background: getAccentColor(religion) + "22",
                            border: `2px solid ${getAccentColor(religion)}`,
                            color: getAccentColor(religion),
                            fontWeight: 700,
                          }}
                        >
                          {src.title
                            ? src.title.toUpperCase()
                            : `[${religion.toUpperCase()}, ${i + 1}]`}
                        </motion.a>
                      ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

  {/* Grey conclusion box directly below religions */}
  {(Array.isArray(conclusions) && conclusions.length > 0) ||
  conclusion ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className={`bg-gray-900/80 border border-gray-700 p-10 shadow-lg mt-4 font-instrument-sans`}
            style={{ borderRadius: 0 }}
          >
            <div
              className={`text-gray-200 leading-relaxed text-2xl font-semibold mb-4 font-chivo-mono`}
            >
              CONCLUSION
            </div>
            <div>
              {Array.isArray(conclusions) && conclusions.length > 0
                ? (conclusions as { summary: string; label?: string }[]).map(
                    (c, i) => {
                      const summary = typeof c === "string" ? c : c.summary;
                      const label =
                        typeof c === "object" && "label" in c
                          ? c.label
                          : undefined;
                      return (
                        <div key={i} className="mb-4">
                          <div
                            className="text-gray-300"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownWithReferences(
                                summary,
                                {
                                  judaism: safeSections.judaism.sources || [],
                                  christianity:
                                    safeSections.christianity.sources || [],
                                  islam: safeSections.islam.sources || [],
                                },
                                (rel) => getAccentColor(rel),
                              ),
                            }}
                          />
                          {label && (
                            <div className="text-xs text-gray-500 mt-1">
                              {label}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )
                : conclusion && (
                    <div
                      className="text-gray-300"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownWithReferences(
                          conclusion,
                          {
                            judaism: safeSections.judaism.sources || [],
                            christianity: safeSections.christianity.sources || [],
                            islam: safeSections.islam.sources || [],
                          },
                          (rel) => getAccentColor(rel),
                        ),
                      }}
                    />
                  )}
            </div>
          </motion.div>
        ) : null}

        {/* Absolute fallback if everything is empty */}
        {(!safeSections.judaism.summary && !safeSections.christianity.summary && !safeSections.islam.summary && !conclusion && !(Array.isArray(conclusions) && conclusions.length)) && (
          <div className="text-gray-400 mt-8">No structured content returned. Try another query.</div>
        )}
      </div>
    </motion.div>
  );
}
