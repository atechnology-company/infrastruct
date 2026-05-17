"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getLocalLlm } from "@/lib/local-llm";
import { getDeviceCapabilitySnapshot } from "@/lib/device-capabilities";
import {
  DEFAULT_ENABLED_RELIGIONS,
  loadEnabledReligions,
  saveEnabledReligions,
  RELIGION_KEYS,
  type ReligionKey,
} from "@/lib/religions";

interface SettingsPageProps {
  onBack: () => void;
}

const RELIGION_LABELS: Record<ReligionKey, string> = {
  judaism: "Judaism",
  christianity: "Christianity",
  islam: "Islam",
  hinduism: "Hinduism",
  sikhism: "Sikhism",
  buddhism: "Buddhism",
};

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [enabledReligions, setEnabledReligions] = useState<
    Record<ReligionKey, boolean>
  >(DEFAULT_ENABLED_RELIGIONS);
  const [aiBackend, setAiBackend] = useState<string>("checking...");
  const [deviceInfo, setDeviceInfo] = useState<string>("");

  useEffect(() => {
    setEnabledReligions(loadEnabledReligions());
    const caps = getDeviceCapabilitySnapshot();
    setDeviceInfo(
      caps.deviceMemoryGb != null
        ? `Device RAM (reported): ~${caps.deviceMemoryGb} GB · tier: ${caps.tier}`
        : `Device RAM not reported · tier: ${caps.tier} (from CPU/GPU hints)`,
    );
  }, []);

  useEffect(() => {
    const llm = getLocalLlm();
    if (!llm) {
      setAiBackend("loading...");
      const id = setInterval(() => {
        const ready = getLocalLlm();
        if (ready) {
          setAiBackend(
            ready.backend === "prompt-api"
              ? "Chrome / Edge built-in AI"
              : ready.modelId?.split("/").pop() ?? "transformers.js (browser)",
          );
          clearInterval(id);
        }
      }, 500);
      return () => clearInterval(id);
    }
    setAiBackend(
      llm.backend === "prompt-api"
        ? "Chrome / Edge built-in AI"
        : llm.modelId?.split("/").pop() ?? "transformers.js (browser)",
    );
  }, []);

  const handleReligionToggle = (religion: ReligionKey) => {
    const updated = { ...enabledReligions, [religion]: !enabledReligions[religion] };
    setEnabledReligions(updated);
    saveEnabledReligions(updated);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <h1 className="text-xl font-semibold">Settings</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold mb-2">AI Model</h2>
            <p className="text-sm text-gray-400">
              Uses the browser Prompt API in Chrome or Edge when available, otherwise
              downloads a RAM-tiered Gemma 4 or Phi-4 model via transformers.js. Search uses public Searx mirrors
              only — no API keys required.
            </p>
            <p className="mt-3 text-sm text-gray-300">{aiBackend}</p>
            {deviceInfo && (
              <p className="mt-1 text-xs text-gray-500">{deviceInfo}</p>
            )}
          </div>

          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold mb-4">Enabled Religions</h2>
            <p className="text-sm text-gray-400 mb-4">
              Disabled religions are skipped during search (philosophy always runs).
            </p>

            <div className="grid grid-cols-2 gap-3">
              {RELIGION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer"
                >
                  <span className="font-medium">{RELIGION_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={enabledReligions[key]}
                    onChange={() => handleReligionToggle(key)}
                    className="w-4 h-4"
                  />
                </label>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
