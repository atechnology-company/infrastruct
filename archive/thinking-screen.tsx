"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ThinkingScreenProps {
  query: string;
}

export function ThinkingScreen({ query }: ThinkingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [searchingResults, setSearchingResults] = useState<
    { religion: string; title: string; source: string; color: string }[]
  >([]);
  const [phase, setPhase] = useState<"searching" | "thinking" | "results">(
    "searching",
  );

  // Fetch thinking steps and search results from Gemini API
  useEffect(() => {
    async function fetchThinking() {
      // Replace with your actual Gemini API endpoint and key
      const res = await fetch("/api/thinking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      // Expecting: { searchingResults: [...], thinkingSteps: [...] }
      setSearchingResults(data.searchingResults || []);
      // If thoughts are present, show thinking; otherwise, skip to results
      if (data.thinkingSteps && data.thinkingSteps.length > 0) {
        setThinkingSteps(data.thinkingSteps);
        setTimeout(() => setPhase("thinking"), 1800);
      } else {
        setPhase("results");
      }
    }
    fetchThinking();
  }, [query]);

  // Animate thinking steps
  useEffect(() => {
    if (phase !== "thinking" || thinkingSteps.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % thinkingSteps.length);
    }, 800);

    return () => clearInterval(interval);
  }, [phase, thinkingSteps.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col justify-center min-h-screen px-6 md:px-12"
    >
      <div className="max-w-4xl">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-5xl font-light mb-4">{query}</h1>
        </motion.div>

        {phase === "searching" ? (
          <>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <p className="text-gray-400 text-lg">searching...</p>
            </motion.div>
            <div className="space-y-4">
              {searchingResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: index * 0.2,
                    duration: 0.5,
                  }}
                  className={`border-2 ${
                    result.color === "blue"
                      ? "border-blue-500"
                      : result.color === "amber"
                        ? "border-amber-500"
                        : result.color === "green"
                          ? "border-green-500"
                          : "border-gray-500"
                  } p-6 rounded-lg`}
                >
                  <div className="text-sm text-gray-400 mb-1">
                    {result.religion}
                  </div>
                  <div className="text-lg font-medium">{result.title}</div>
                  <div className="text-sm text-gray-400">{result.source}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : phase === "thinking" ? (
          <>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <p className="text-gray-400 text-lg">thinking...</p>
            </motion.div>
            <div className="space-y-4">
              {thinkingSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: index <= currentStep ? 1 : 0.3,
                    x: 0,
                  }}
                  transition={{
                    delay: index * 0.2,
                    duration: 0.5,
                  }}
                  className="text-xl md:text-2xl font-light"
                >
                  {step}
                </motion.div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
