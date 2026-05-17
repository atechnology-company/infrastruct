"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getDeviceCapabilitySnapshot, getLocalLlm } from "@/lib/local-llm";

type ReligionKey = "judaism" | "christianity" | "islam" | "hinduism" | "sikhism" | "buddhism";

interface SettingsPageProps {
    onBack: () => void;
}

const RELIGIONS: { key: ReligionKey; label: string }[] = [
    { key: "judaism", label: "Judaism" },
    { key: "christianity", label: "Christianity" },
    { key: "islam", label: "Islam" },
    { key: "hinduism", label: "Hinduism" },
    { key: "sikhism", label: "Sikhism" },
    { key: "buddhism", label: "Buddhism" },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [enabledReligions, setEnabledReligions] = useState<Record<ReligionKey, boolean>>({
        judaism: true,
        christianity: true,
        islam: true,
        hinduism: true,
        sikhism: true,
        buddhism: true,
    });
    const [aiBackend, setAiBackend] = useState<string>("checking...");
    const [deviceInfo, setDeviceInfo] = useState<string>("");

    useEffect(() => {
        const caps = getDeviceCapabilitySnapshot();
        setDeviceInfo(
            caps.deviceMemoryGb != null
                ? `Device RAM (reported): ~${caps.deviceMemoryGb} GB · tier: ${caps.tier}`
                : `Device RAM not reported · tier: ${caps.tier} (from CPU/GPU hints)`,
        );
    }, []);

    useEffect(() => {
        const savedReligions = localStorage.getItem("infrastruct-religions");
        if (savedReligions) {
            try {
                setEnabledReligions(JSON.parse(savedReligions));
            } catch { }
        }
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
                            : "Qwen3.5-3B (browser)",
                    );
                    clearInterval(id);
                }
            }, 500);
            return () => clearInterval(id);
        }
        setAiBackend(
            llm.backend === "prompt-api"
                ? "Chrome / Edge built-in AI"
                : "Qwen3.5-3B (browser)",
        );
    }, []);

    const handleReligionToggle = (religion: ReligionKey) => {
        const newEnabled = { ...enabledReligions, [religion]: !enabledReligions[religion] };
        setEnabledReligions(newEnabled);
        localStorage.setItem("infrastruct-religions", JSON.stringify(newEnabled));
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-black text-white"
        >
            <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto px-6 py-4"
                >
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span>Back</span>
                        </button>
                        <h1 className="text-xl font-semibold">Settings</h1>
                        <div className="w-20" />
                    </div>
                </motion.div>
            </div>

            <motion.div className="max-w-4xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                >
                    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
                        <h2 className="text-xl font-bold mb-2">AI Model</h2>
                        <p className="text-sm text-gray-400">
                            Uses the browser Prompt API in Chrome or Edge when available, otherwise
                            downloads Qwen3.5-3B via transformers.js.
                        </p>
                        <p className="mt-3 text-sm text-gray-300">{aiBackend}</p>
                        {deviceInfo && (
                            <p className="mt-1 text-xs text-gray-500">{deviceInfo}</p>
                        )}
                    </div>

                    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
                        <h2 className="text-xl font-bold mb-4">Enabled Religions</h2>
                        <p className="text-sm text-gray-400 mb-4">Select which religions to include in search results</p>

                        <div className="grid grid-cols-2 gap-3">
                            {RELIGIONS.map((r) => (
                                <label
                                    key={r.key}
                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer"
                                >
                                    <span className="font-medium">{r.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={enabledReligions[r.key]}
                                        onChange={() => handleReligionToggle(r.key)}
                                        className="w-4 h-4"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
