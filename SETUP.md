# Infrastruct Setup Guide

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Gemini API Key (required)
# Get from: https://makersuite.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# Perplexity API Key (optional but recommended for better search results)
# Get from: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Google Custom Search Engine (CSE) IDs (legacy, optional - Searx is used as fallback)
# These are only used if Perplexity API is not available
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
NEXT_PUBLIC_CSE_ID_JUDAISM=your_judaism_cse_id
NEXT_PUBLIC_CSE_ID_CHRISTIANITY=your_christianity_cse_id
NEXT_PUBLIC_CSE_ID_ISLAM=your_islam_cse_id
NEXT_PUBLIC_CSE_ID_HINDUISM=your_hinduism_cse_id
NEXT_PUBLIC_CSE_ID_SIKHISM=your_sikhism_cse_id
NEXT_PUBLIC_CSE_ID_BUDDHISM=your_buddhism_cse_id

# Optional: Set to '1' to disable SSL certificate verification (for development only)
# UNSAFE_FETCH=0
```

## Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Supported Religions

Infrastruct now supports 6 major world religions:

### Abrahamic Traditions
- **Judaism** - Blue theme
- **Christianity** - Amber theme  
- **Islam** - Green theme

### Dharmic Traditions
- **Hinduism** - Orange theme
- **Sikhism** - Yellow theme
- **Buddhism** - Purple theme

## Search Architecture

1. **Primary**: Perplexity API (if configured) - Provides high-quality, cited search results
2. **Fallback**: Searx meta-search - Uses multiple public Searx instances for privacy-focused search
3. **Content Scraping**: Extracts and preprocesses content from authoritative religious sources

## Philosophical Frameworks

The system utilizes multiple philosophical approaches:

### Western/Abrahamic
- Moral Realism
- Rationalist Ethics
- Value Pluralism
- Divine Command Theory
- Utilitarianism

### Eastern/Dharmic
- Dharma Ethics
- Karma Theory
- Middle Way Philosophy
- Ahimsa (Non-violence)
- Seva (Selfless Service)
