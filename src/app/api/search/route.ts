import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextRequest } from "next/server";

const gemini = createGoogleGenerativeAI({});

function cleanGeminiJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { query, sources } = await req.json();
    console.log("[API] /search called with query:", query);
    console.log("[API] /search received sources:", sources?.length || 0, "items");

    const systemPrompt = `You are Alif, the AI-powered search engine for Infrastruct, a logic-based belief-agnostic jurisprudence framework. Your role is to interpret various divine sources through clear logical systems to create coherent legal guidance.

    CORE PRINCIPLES:
    - Encompasses major world religions (Abrahamic and Dharmic traditions)
    - Logic-filtered approach to religious texts
    - Comparative and friendly analysis
    - Explains rather than dictates
    - Utilizes: Moral Realism, Rationalist Ethics, Value Pluralism, Utilitarianism, Dharma Ethics, Karma Theory, Middle Way Philosophy, Ahimsa (Non-violence), Seva (Selfless Service), Virtue Ethics

    METHODOLOGY:
    1. Analyze the query to understand the core ethical/legal question.
    2. Search across traditions (Judaism, Christianity, Islam, Hinduism, Sikhism, Buddhism).
    3. Present findings from each tradition with their reasoning.
    4. Provide logical analysis that respects all perspectives.
    5. Offer practical guidance based on logical consistency.
    6. Apply value pluralism and other logical frameworks: If the evidence, logic, or values allow for more than one reasonable answer, you MUST present multiple plausible conclusions, not just one. Each conclusion should be logically valid and reflect a different way of resolving the question, especially where traditions or ethical systems diverge.

    RESPONSE FORMAT:
    Respond with a single valid JSON object with the following structure:

        {
          "title": string,
          "sections": {
            "judaism": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "permitted" | "forbidden" | "disliked" | "unsure" | "encouraged" | "obligatory" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Judaism, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Judaism, referenced in the summary by [Judaism, n]
            },
            "christianity": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "permitted" | "forbidden" | "disliked" | "unsure" | "encouraged" | "obligatory" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Christianity, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Christianity, referenced in the summary by [Christianity, n]
            },
            "islam": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "permitted" | "forbidden" | "disliked" | "unsure" | "encouraged" | "obligatory" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Islam, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Islam, referenced in the summary by [Islam, n]
            },
            "hinduism": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "dharmic" | "adharmic" | "neutral" | "unsure" | "encouraged" | "obligatory" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Hinduism, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Hinduism, referenced in the summary by [Hinduism, n]
            },
            "sikhism": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "permitted" | "forbidden" | "discouraged" | "unsure" | "encouraged" | "obligatory" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Sikhism, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Sikhism, referenced in the summary by [Sikhism, n]
            },
            "buddhism": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": "skillful" | "unskillful" | "neutral" | "unsure" | "encouraged" | "essential" | null,
              "summary": string, // markdown supported, must use in-text referencing like [Buddhism, 1], etc.
              "sources": [{ "title": string, "url": string }] // array of sources for Buddhism, referenced in the summary by [Buddhism, n]
            },
            "philosophy": {
              "featured_quote": string,
              "featured_quote_source": { "title": string, "url": string },
              "status": null,
              "summary": string, // markdown supported, must use in-text referencing like [Philosophy, 1], etc. CRITICAL: Include direct quotes from relevant secular philosophers with proper attribution. Format: "As [Philosopher Name] argued, '[quote]'". DO NOT include religious figures. Choose philosophers relevant to the query and integrate their perspectives with actual quotes.
              "sources": [{ "title": string, "url": string }] // array of sources for Philosophy, referenced in the summary by [Philosophy, n]
            }
          },
          "conclusions": [
            {
              "label": string, // AI-determined topic or theme label that best captures this conclusion (e.g., "Universal Compassion", "Conditional Liberation", "Ethical Duty", "Personal Freedom")
              "summary": string // markdown summary exploring this perspective using logical reasoning and cross-religious comparison, must use in-text referencing like [Judaism, 1], [Islam, 2], [Hinduism, 3], etc.
            }
            // ...AI should determine how many conclusions are needed based on the complexity and diversity of perspectives
          ]
        }

        - All in-text references must use the format [Religion, n], e.g., [Islam, 1], [Judaism, 2], [Hinduism, 3], [Buddhism, 1].
        - Each religion's sources must be kept in a separate array under that religion's section.
        - In summaries and conclusions, [Religion, n] must refer to the nth source in that religion's sources array.
        - In the conclusion, you may reference sources from any religion using this format.
        - Each "summary" must be markdown-formatted and use in-text referencing (e.g., [Religion, n]) that matches the sources array for that religion.
        - "featured_quote" should be the most representative quote for that tradition's answer and should be prominent.
        - "featured_quote_source" must be an object with the title and url of the source for the featured quote, and should be displayed directly under the quote.
        - "status" can be a single word from the allowed values, or null if not applicable. If null, do not display a status badge. For questions where a status is not meaningful (e.g., "Who is God?"), you MUST set status to null. Note that different religions use different status terminology (e.g., "dharmic/adharmic" for Hinduism, "skillful/unskillful" for Buddhism).
        - "sources" must be an array of objects, each with a "title" and "url", referenced in the summary using [Religion, n], and must include all sources referenced in any summary or conclusion for that religion.
        - "conclusions" should be AI-determined thematic perspectives that synthesize the religious viewpoints. The AI should decide how many conclusions are needed (typically 1-4) based on the diversity of perspectives and complexity of the question. Each conclusion should represent a distinct logical framework or ethical approach, respecting value pluralism. DO NOT force multiple conclusions if the perspectives converge on a single answer.

    Remember: You serve logicians who want to follow world religions but struggle with inconsistencies. Help them navigate objective morality while respecting their desire for spiritual truth and ethical living.`;

    // Format sources for the prompt
    let sourcesContext = "";
    if (sources && Array.isArray(sources) && sources.length > 0) {
      sourcesContext = "\n\nSCRAPED CONTENT FROM RELIGIOUS SOURCES:\n";
      sources.forEach((source: any, idx: number) => {
        if (source.snippet && source.religion) {
          sourcesContext += `\n[${source.religion} - Source ${idx + 1}]\nTitle: ${source.title || 'Unknown'}\nURL: ${source.link || 'Unknown'}\nEngine: ${source.engine || 'Unknown'}\nContent: ${source.snippet.substring(0, 2000)}...\n`;
        }
      });
      sourcesContext += "\nPlease analyze the above scraped content and synthesize it into your response. Use the URLs provided as sources in your citations.\n";
    }

    const prompt = `Query: ${query}
${sourcesContext}
Please provide a comprehensive analysis following the Infrastruct methodology. Include perspectives from Judaism, Christianity, Islam, Hinduism, Sikhism, Buddhism, and Philosophy where relevant, followed by logical synthesis.

Your response MUST be a single valid JSON object as described in the RESPONSE FORMAT above. Do not include any text outside the JSON object. All summaries must support markdown and in-text referencing (e.g., [1], [2], etc. matching the sources array). For each featured quote, include a featured_quote_source object with the title and url of the source. Sources must be objects with title and url. Status can be null if not applicable.
`;

    console.log("[API] /search calling Gemini with prompt length:", prompt.length);
    console.log("[API] /search sources context length:", sourcesContext.length);

    // Use Gemini via ai-sdk
    const result = await generateText({
      model: gemini("gemini-2.5-flash-lite"),
      system: systemPrompt,
      prompt,
    });

    console.log("[API] /search Gemini response received, length:", result.text.length);
    console.log("[API] /search Gemini response preview:", result.text.substring(0, 200));

    // Try to parse the response as JSON, fallback to raw text if parsing fails
    let responseJson;
    try {
      const cleaned = cleanGeminiJson(result.text);
      console.log("[API] /search cleaned JSON preview:", cleaned.substring(0, 200));
      responseJson = JSON.parse(cleaned);
      // If legacy "conclusion" field exists, convert to array for compatibility
      if (
        responseJson &&
        typeof responseJson.conclusion === "string" &&
        !responseJson.conclusions
      ) {
        responseJson.conclusions = [
          { label: "Conclusion", summary: responseJson.conclusion },
        ];
      }
      console.log("[API] /search successfully parsed JSON");
    } catch (e) {
      console.error("[API] /search JSON parse error:", e);
      console.error("[API] /search raw response:", result.text);
      responseJson = {
        error: "AI response was not valid JSON",
        raw: result.text,
      };
    }

    return Response.json({ response: responseJson });
  } catch (error) {
    console.error("[API] /search error:", error);
    return Response.json(
      { error: "Failed to generate response", details: String(error) },
      { status: 500 }
    );
  }
}
