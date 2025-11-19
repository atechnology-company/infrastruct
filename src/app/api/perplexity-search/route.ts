import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";
const PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search";

// Religion-specific authoritative sources
const RELIGION_SITES: Record<string, string[]> = {
    judaism: [
        "sefaria.org",
        "chabad.org",
        "myjewishlearning.com",
        "askmoses.com",
        "dinonline.org",
        "jewishvirtuallibrary.com",
    ],
    christianity: [
        "biblegateway.com",
        "christianity.com",
        "gotquestions.org",
        "catholic.com",
        "orthodoxwiki.org",
    ],
    islam: [
        "quran.com",
        "islamqa.info",
        "islamweb.net",
        "al-islam.org",
        "sunnah.com",
    ],
    hinduism: [
        "vedabase.io",
        "hinduwebsite.com",
        "bhagavad-gita.org",
        "vedanta.org",
        "hinduismtoday.com",
    ],
    sikhism: [
        "sikhnet.com",
        "sikhs.org",
        "searchgurbani.com",
        "srigranth.org",
        "sikhiwiki.org",
    ],
    buddhism: [
        "accesstoinsight.org",
        "dhammatalks.org",
        "buddhanet.net",
        "tricycle.org",
        "suttacentral.net",
    ],
};

export async function POST(req: NextRequest) {
    try {
        const { query, religion, numResults = 5 } = await req.json();

        if (!PERPLEXITY_API_KEY) {
            return Response.json(
                { error: "Perplexity API key not configured" },
                { status: 500 }
            );
        }

        console.log(`[Perplexity] Searching for ${religion}: ${query}`);

        // Get religion-specific sites for domain filtering
        const siteFilters = RELIGION_SITES[religion] || [];
        const domains = siteFilters.slice(0, 10); // Max 20 domains, using 10 for safety

        // Construct search query with religion context
        const searchQuery = `${religion} ${query}`;

        const response = await fetch(PERPLEXITY_SEARCH_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: searchQuery,
                max_results: Math.min(numResults, 10),
                max_tokens_per_page: 1024,
                domains: domains.length > 0 ? domains : undefined,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Perplexity] API error: ${response.status} ${errorText}`);
            return Response.json(
                {
                    error: "Perplexity API request failed",
                    details: errorText,
                    status: response.status
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log(`[Perplexity] Response:`, JSON.stringify(data, null, 2));

        // Extract results from Perplexity Search API response
        const searchResults = data.results || [];
        const results = searchResults.map((result: any, idx: number) => ({
            title: result.title || `${religion} Source ${idx + 1}`,
            link: result.url || "",
            snippet: result.snippet || result.text || "",
        }));

        return Response.json({
            results,
            usedEngine: "perplexity",
            rawResponse: data,
        });

    } catch (error: any) {
        console.error("[Perplexity] Error:", error);
        return Response.json(
            {
                error: "Failed to search with Perplexity",
                details: error?.message || String(error),
            },
            { status: 500 }
        );
    }
}
