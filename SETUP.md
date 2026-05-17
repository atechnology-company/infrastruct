# Infrastruct Setup Guide

## Environment Variables

No API keys are required for search or AI (browser Prompt API / local Gemma 4 or Phi-4 via transformers.js).

Optional:

```bash
# Development only: disable TLS verification for difficult scrape targets
# UNSAFE_FETCH=1

# Optional: your own SearXNG instance (tried before public mirrors)
# SEARX_BASE_URL=https://search.example.com
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

1. **Server-side web search** — DuckDuckGo HTML (primary) + SearXNG JSON/HTML fallbacks via `/api/scrape-content?mode=search`
2. **Content scraping** — `/api/scrape-content?url=...`
3. **AI** — browser Prompt API (Chrome/Edge) or transformers.js Gemma 4 / Phi-4 (RAM-tiered)

## Enabled Religions

Toggle religions in Settings. Disabled traditions are skipped during search; philosophy always runs.
