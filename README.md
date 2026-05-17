# Infrastruct

Logic-based belief-agnostic jurisprudence framework that interprets divine sources through clear logical systems.

## Stack

- Next.js 15 (App Router)
- React 19 + TypeScript
- Browser AI: Chrome/Edge Prompt API, or transformers.js (Gemma 4 / Phi-4, RAM-tiered)
- Search: Searx mirrors (no API key)
- Deploy: Netlify + Bun

## Develop

```bash
bun install
bun dev
```

See [SETUP.md](./SETUP.md) for details.

## v0.2.1

- Browser-local AI (Prompt API + Gemma 4 / Phi-4 fallback)
- Searx-only search
- RAM-aware model selection
- Religion toggles in settings
