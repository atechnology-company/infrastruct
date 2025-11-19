import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextRequest } from "next/server";

// Utility to clean Gemini's markdown fencing
function cleanGeminiJson(text: string): string {
  // Remove triple backticks and optional "json" label
  return text
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

const gemini = createGoogleGenerativeAI({});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    console.log("[API] /generate-queries called with prompt:", prompt);

    // System prompt for generating search queries
    const systemPrompt = `You are Alif, the AI-powered search engine for Infrastruct.
Your task is to generate a list of concise search queries based on the user's prompt.
Each query should be suitable for searching across major world religions (Judaism, Christianity, Islam, Hinduism, Sikhism, Buddhism).
If the prompt contains multiple questions or topics, generate a separate query for each.

For each religion, also provide a number (1-5) for how many search results should be fetched for that query, based on how much information is likely needed to answer the prompt well.

RESPONSE FORMAT:
Respond with a single valid JSON object:
{
  "queries": {
    "judaism": { "query": string, "numResults": number },
    "christianity": { "query": string, "numResults": number },
    "islam": { "query": string, "numResults": number },
    "hinduism": { "query": string, "numResults": number },
    "sikhism": { "query": string, "numResults": number },
    "buddhism": { "query": string, "numResults": number },
    "philosophy": { "query": string, "numResults": number }
  }
}

Guidelines:
- Each query should be clear, specific, and suitable for comparative religious search.
- numResults should be between 1 and 5, and reflect the complexity or breadth of the topic for each religion.
- Do NOT include any text outside the JSON object.
`;

    const userPrompt = `User prompt: ${prompt}
Generate search queries and number of results as described above.`;

    let result;
    try {
      result = await generateText({
        model: gemini("gemini-2.5-flash-lite"),
        system: systemPrompt,
        prompt: userPrompt,
      });
      console.log("[API] /generate-queries Gemini result:", result.text);
    } catch (err) {
      console.error("[API] /generate-queries Gemini error:", err);
      return Response.json(
        {
          error: "Failed to generate queries from Gemini",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }

    let responseJson: any = undefined;
    try {
      responseJson = JSON.parse(cleanGeminiJson(result.text));
      console.log("[API] /generate-queries raw response:", responseJson);

      // If responseJson has a "queries" array, map to religion keys (legacy support)
      if (responseJson && Array.isArray(responseJson.queries)) {
        const religions = ["judaism", "christianity", "islam"];
        const mapped: Record<string, { query: string; numResults: number }> =
          {};
        religions.forEach((rel, i) => {
          mapped[rel] = { query: responseJson.queries[i] || "", numResults: 3 };
        });
        responseJson = { queries: mapped };
        console.log("[API] /generate-queries mapped queries:", responseJson);
      }

      // Validate that all religion keys are present and non-empty, and have numResults
      const valid =
        responseJson &&
        typeof responseJson === "object" &&
        responseJson.queries &&
        ["judaism", "christianity", "islam", "hinduism", "sikhism", "buddhism", "philosophy"].every(
          (k) =>
            responseJson.queries &&
            typeof responseJson.queries[k] === "object" &&
            typeof responseJson.queries[k].query === "string" &&
            responseJson.queries[k].query.length > 0 &&
            typeof responseJson.queries[k].numResults === "number",
        );
      if (!valid) {
        console.error(
          "[API] /generate-queries: Invalid queries format after mapping:",
          responseJson,
        );
        return Response.json(
          {
            error: "Invalid queries format from Gemini",
            details: responseJson,
          },
          { status: 500 },
        );
      }

      console.log("[API] /generate-queries response (final):", responseJson);
    } catch (e) {
      responseJson = {
        error: "AI response was not valid JSON",
        raw: result.text,
      };
      console.error("[API] /generate-queries invalid JSON:", result.text);
      return Response.json(responseJson, { status: 500 });
    }

    return Response.json(responseJson);
  } catch (error) {
    console.error("Generate Queries API error:", error);
    return Response.json(
      {
        error: "Failed to generate queries",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
