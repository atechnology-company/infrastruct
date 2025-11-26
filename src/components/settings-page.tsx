"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

type Backend = "nextjs" | "vlang";
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
    const [backend, setBackend] = useState<Backend>("nextjs");
    const [vServerStatus, setVServerStatus] = useState<"checking" | "online" | "offline">("checking");
    const [enabledReligions, setEnabledReligions] = useState<Record<ReligionKey, boolean>>({
        judaism: true,
        christianity: true,
        islam: true,
        hinduism: true,
        sikhism: true,
        buddhism: true,
    });

    // Load saved preferences
    useEffect(() => {
        const savedBackend = localStorage.getItem("infrastruct-backend") as Backend;
        if (savedBackend) setBackend(savedBackend);

        const savedReligions = localStorage.getItem("infrastruct-religions");
        if (savedReligions) {
            try {
                setEnabledReligions(JSON.parse(savedReligions));
            } catch { }
        }
    }, []);

    // Check V server status
    useEffect(() => {
        const checkVServer = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const res = await fetch("http://localhost:3001/health", {
                    method: "GET",
                    signal: controller.signal,
                    mode: 'cors',
                });

                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "ok") {
                        setVServerStatus("online");
                    } else {
                        setVServerStatus("offline");
                    }
                } else {
                    setVServerStatus("offline");
                }
            } catch (err) {
                console.log("V server check failed:", err);
                setVServerStatus("offline");
            }
        };

        checkVServer();
        const interval = setInterval(checkVServer, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleBackendChange = (newBackend: Backend) => {
        setBackend(newBackend);
        localStorage.setItem("infrastruct-backend", newBackend);

        if (typeof window !== "undefined") {
            (window as any).__INFRASTRUCT_API_BASE__ =
                newBackend === "vlang" ? "http://localhost:3001" : "";
        }
    };

    const handleReligionToggle = (religion: ReligionKey) => {
        const newEnabled = { ...enabledReligions, [religion]: !enabledReligions[religion] };
        setEnabledReligions(newEnabled);
        localStorage.setItem("infrastruct-religions", JSON.stringify(newEnabled));
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-6 py-4">
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
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                >
                    {/* Backend Selection */}
                    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
                        <h2 className="text-xl font-bold mb-4">Backend Server</h2>

                        <div className="space-y-3">
                            <label className="flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer">
                                <div>
                                    <div className="font-semibold">Next.js</div>
                                    <div className="text-sm text-gray-400">Production backend (recommended)</div>
                                </div>
                                <input
                                    type="radio"
                                    name="backend"
                                    checked={backend === "nextjs"}
                                    onChange={() => handleBackendChange("nextjs")}
                                    className="w-4 h-4"
                                />
                            </label>

                            <label className={`flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-gray-600 ${vServerStatus === "offline" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        V
                                        <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">
                                            EXPERIMENTAL
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${vServerStatus === "online" ? "bg-green-500" : vServerStatus === "checking" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}></div>
                                        {vServerStatus === "online" ? "Server Online (port 3001)" : vServerStatus === "checking" ? "Checking..." : "Server Offline"}
                                    </div>
                                </div>
                                <input
                                    type="radio"
                                    name="backend"
                                    checked={backend === "vlang"}
                                    onChange={() => handleBackendChange("vlang")}
                                    disabled={vServerStatus === "offline"}
                                    className="w-4 h-4"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Religion Toggles */}
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
            </div>
        </div>
    );
}
