import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/onnxruntime-web/ },
      { module: /node_modules\/@huggingface\/transformers/ },
    ];
    return config;
  },
  turbopack: {
    resolveAlias: {
      sharp: { browser: "" },
      "onnxruntime-node": { browser: "" },
    },
  },
};

export default nextConfig;
