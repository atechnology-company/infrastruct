import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { runServerSearch } from "@/lib/server-search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const query = req.nextUrl.searchParams.get("query");
  const mode = req.nextUrl.searchParams.get("mode") || "scrape";

  if (mode === "search" && query) {
    try {
      const religion = req.nextUrl.searchParams.get("religion") || "";
      const numResults = parseInt(
        req.nextUrl.searchParams.get("numResults") || "3",
        10,
      );
      const data = await runServerSearch({ query, religion, numResults });
      return Response.json(data);
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error);
      return Response.json(
        { error: "Search failed", details },
        { status: 502 },
      );
    }
  }

  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let res;
    const fetchHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: url,
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    };

    if (process.env.UNSAFE_FETCH === "1") {
      const { Agent } = await import("undici");
      const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      res = await fetch(url, {
        headers: fetchHeaders,
        redirect: "follow",
        // @ts-expect-error undici dispatcher is supported by Node fetch
        dispatcher,
      });
    } else {
      res = await fetch(url, {
        headers: fetchHeaders,
        redirect: "follow",
      });
    }

    const html = await res.text();
    console.log(`[SCRAPE FETCH] Status: ${res.status} ${res.statusText} for ${url}`);
    console.log(`[SCRAPE FETCH] Response: ${html.slice(0, 500)}`);

    const $ = cheerio.load(html);

    $("nav, .menu, .navbar, .sidebar, aside, header, footer").remove();

    let content = "";
    let contentFound = false;
    const selectors = [
      ".content",
      "#content",
      ".main-content",
      "main",
      "article",
      "[role='main']",
    ];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length > 0) {
        const blocks: string[] = [];
        el.find("p, div, section, span, li").each((_, block) => {
          const txt = $(block).text().replace(/\s+/g, " ").trim();
          if (txt.length > 80) blocks.push(txt);
        });
        if (blocks.length === 0 && el.text().trim().length > 80) {
          blocks.push(el.text().trim());
        }
        if (blocks.length > 0) {
          content = blocks.join("\n\n");
          contentFound = true;
          break;
        }
      }
    }

    let title = $("title").first().text().trim();
    if (!title) {
      title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        "";
    }

    let fallbackBody = "";
    if (!contentFound) {
      $("script, style, noscript").remove();
      const blocks: string[] = [];
      $("body p, body div, body section, body span, body li").each((_, block) => {
        const txt = $(block).text().replace(/\s+/g, " ").trim();
        if (txt.length > 80) blocks.push(txt);
      });
      if (blocks.length === 0 && $("body").text().trim().length > 80) {
        blocks.push($("body").text().trim());
      }
      fallbackBody = blocks.join("\n\n");
      if (fallbackBody.length > 2000) {
        fallbackBody = fallbackBody.slice(0, 2000) + "...";
      }
    }

    if ((contentFound && content) || fallbackBody || title) {
      console.log(`[SCRAPE SUCCESS] Returning content for ${url}`);
      return Response.json({
        url,
        title,
        content: contentFound ? content : fallbackBody,
        usedContentSelector: contentFound
          ? selectors.find((sel) => $(sel).first().length > 0)
          : null,
      });
    }

    console.error(`[SCRAPE ERROR] No valid content scraped for ${url}`);
    return Response.json(
      {
        error: "No valid content scraped",
        details: {
          url,
          title,
          content,
          fallbackBody,
          status: res.status,
          response: html.slice(0, 500),
        },
      },
      { status: 500 },
    );
  } catch (error: unknown) {
    return Response.json(
      {
        error: "Failed to scrape content",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
