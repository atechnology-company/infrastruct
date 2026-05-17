# Infrastruct Setup Guide

## Environment Variables

No API keys are required for search (Searx mirrors) or AI (browser Prompt API / local Gemma 4 or Phi-4 via transformers.js).

Optional:

```bash
# Development only: disable TLS verification for difficult scrape targets
# UNSAFE_FETCH=1
```

Remove any legacy `PERPLEXITY_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `NEXT_PUBLIC_CSE_*` variables from Netlify — they are no longer used.

## Installation

```bash
bun install
bun dev
bun run build
bun start
bun test src/lib
```

## Search Architecture

1. **Searx meta-search** — public mirror rotation via `/api/scrape-content?mode=search` (SSE)
2. **Content scraping** — `/api/scrape-content?url=...`
3. **AI** — browser Prompt API (Chrome/Edge) or transformers.js Gemma 4 / Phi-4 (RAM-tiered)

## Enabled Religions

Toggle religions in Settings. Disabled traditions are skipped during search; philosophy always runs.
