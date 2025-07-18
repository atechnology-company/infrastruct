import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Fetch the HTML content
    const res = await fetch(url, {
      headers: {
        // Pretend to be a browser
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
      // Some sites block bots, so follow redirects
      redirect: "follow",
    });

    if (!res.ok) {
      return Response.json(
        { error: `Failed to fetch URL: ${res.status} ${res.statusText}` },
        { status: 500 },
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try to extract .content div
    let content = "";
    let contentFound = false;
    const contentDiv = $(".content").first();
    if (contentDiv.length > 0) {
      content = contentDiv.text().trim();
      contentFound = true;
    }

    // Fallback: extract <title> and a summary of <body>
    let title = $("title").first().text().trim();
    if (!title) {
      // Try Open Graph title
      title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        "";
    }

    let fallbackBody = "";
    if (!contentFound) {
      // Remove script/style/noscript tags for cleaner text
      $("script, style, noscript").remove();
      fallbackBody = $("body").text().replace(/\s+/g, " ").trim();
      // Limit to first 800 chars for summary
      if (fallbackBody.length > 800) {
        fallbackBody = fallbackBody.slice(0, 800) + "...";
      }
    }

    return Response.json({
      url,
      title,
      content: contentFound ? content : fallbackBody,
      usedContentDiv: contentFound,
    });
  } catch (error: any) {
    return Response.json(
      {
        error: "Failed to scrape content",
        details: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
