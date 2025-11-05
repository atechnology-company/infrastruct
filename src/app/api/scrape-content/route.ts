// --- Configurable site lists for each religion ---
const RELIGION_SITES: Record<string, string[]> = {
  judaism: [
    "sefaria.org",
    "chabad.org",
    "myjewishlearning.com",
    "askmoses.com",
    "dinonline.org",
    "jewishvirtuallibrary.com",
    "rabanan.org",
    "airish.org",
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
};


import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
export const dynamic = "force-dynamic";

// List of Searx mirrors (ordered by preference)
const SEARX_MIRRORS = [
  "https://priv.au/",
  "https://searx.tiekoetter.com/",
  "https://searxng.hweeren.com/",
  "https://searxng.f24o.zip/",
  "https://search.mdosch.de/",
  "https://www.gruble.de/",
  "https://search.leptons.xyz/",
  "https://search.rowie.at/",
  "https://find.xenorio.xyz/",
  "https://search.nordh.tech/",
  "https://search.im-in.space/",
  "https://search.canine.tools/",
  "https://searx.tuxcloud.net/",
  "https://searxng.deliberate.world/",
  "https://search.080609.xyz/",
  "https://baresearch.org/",
  "https://searx.perennialte.ch/",
  "https://search.ononoki.org/",
  "https://searx.namejeff.xyz/",
  "https://searx.stream/",
  "https://searx.lunar.icu/",
  "https://search.privacyredirect.com/",
  "https://search.sapti.me/",
  "https://searxng.biz/",
  "https://search.einfachzocken.eu/",
  "https://search.inetol.net/",
  "https://search.hbubli.cc/",
  "https://search.rhscz.eu/",
  "https://searx.rhscz.eu/",
  "https://searx.dresden.network/",
  "https://searx.foobar.vip/",
  "https://opnxng.com/",
  "https://searxng.site/",
  "https://search.citw.lgbt/",
  "https://kantan.cat/",
  "https://searx.ppeb.me/",
  "https://searxng.shreven.org/",
  "https://searx.ro/",
  "https://searxng.website/",
  "https://copp.gg/",
  "https://paulgo.io/",
  "https://searx.sev.monster/",
  "https://search.federicociro.com/",
  "https://northboot.xyz/",
  "https://searx.party/",
  "https://searx.juancord.xyz/",
  "https://searx.foss.family/",
  "https://darmarit.org/searx/",
  "https://search.nerdvpn.de/",
  "https://fairsuch.net/",
  "https://search.url4irl.com/",
  "https://searx.mxchange.org/",
  "https://s.mble.dk/",
  "https://ooglester.com/",
  "https://metacat.online/",
  "https://searx.thefloatinglab.world/",
  "https://searx.oloke.xyz/",
  "https://search.oh64.moe/",
  "https://searx.mbuf.net/",
  "https://etsi.me/",
  "https://sx.catgirl.cloud/",
  "https://searx.ox2.fr/",
  "https://s.datuan.dev/",
  "https://searx.ankha.ac/",
  "https://nyc1.sx.ggtyler.dev/",
  "https://searx.zhenyapav.com/",
  "https://search.indst.eu/",
  "https://seek.fyi/",
  "https://search.goober.cloud/",
  "https://search.ohaa.xyz/",
  "https://search.librenode.com/",
];


export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const query = req.nextUrl.searchParams.get("query");
  const mode = req.nextUrl.searchParams.get("mode") || "scrape";

  // Searx search only
  if (mode === "search" && query) {
    // SSE progressive mirror updates
    if (req.headers.get("accept") === "text/event-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const religion = req.nextUrl.searchParams.get("religion") || "";
          let siteFilters: string[] = [];
          if (religion && RELIGION_SITES[religion]) {
            siteFilters = RELIGION_SITES[religion];
          }
          let filterStr = "";
          if (siteFilters.length > 0) {
            filterStr = siteFilters.map((site) => `site:${site}`).join(" OR ");
          }
          const fullQuery = filterStr ? `${query} site:${siteFilters[0]}` : query;
          // Get numResults from query param (default 3)
          const numResults = parseInt(req.nextUrl.searchParams.get("numResults") || "3", 10);
          let lastError: any = null;
          let accumulatedResults: any[] = [];
          let usedMirrors: string[] = [];
          for (const mirror of SEARX_MIRRORS) {
            const base = mirror.endsWith("/") ? mirror : mirror + "/";
            const searxUrl = `${base}search?q=${encodeURIComponent(fullQuery)}&categories=general&language=en&safesearch=1&theme=simple`;
            // Stream current mirror being tried
            controller.enqueue(encoder.encode(`event: mirror\ndata: ${JSON.stringify({ mirror, url: searxUrl })}\n\n`));
            try {
              const res = await fetch(searxUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; infrastruct/0.1; +https://undivisible.dev)",
                  Accept: "text/html,application/xhtml+xml,application/xml",
                },
              });
              const html = await res.text();
              if (!res.ok) {
                lastError = new Error(`Searx search failed: ${res.status} ${res.statusText}`);
                continue;
              }
              // Parse HTML for links using Cheerio
              const $ = cheerio.load(html);
              const results: any[] = [];
              $("article.result").each((_, el) => {
                const link = $(el).find("a.url_header").attr("href");
                const title = $(el).find("h3 a").text();
                const snippet = $(el).find("p.content").text();
                if (link && title) {
                  results.push({ title, link, snippet });
                }
              });
              // --- Filter results to only preferred domains ---
              let preferredDomains = siteFilters;
              const filteredResults = results.filter(r => {
                try {
                  const urlObj = new URL(r.link);
                  return preferredDomains.some(domain => urlObj.hostname.includes(domain));
                } catch {
                  return false;
                }
              });
              if (filteredResults.length > 0) {
                // Deduplicate by link
                for (const r of filteredResults) {
                  if (!accumulatedResults.some((x) => x.link === r.link)) {
                    accumulatedResults.push(r);
                  }
                }
                usedMirrors.push(mirror);
                if (accumulatedResults.length >= numResults) {
                  controller.enqueue(encoder.encode(`event: results\ndata: ${JSON.stringify({ results: accumulatedResults.slice(0, numResults), usedEngine: "searx-html", usedMirrors })}\n\n`));
                  controller.close();
                  return;
                }
              } else {
                lastError = new Error(`Searx returned no valid results from ${mirror}`);
                continue;
              }
            } catch (err) {
              lastError = err;
              continue;
            }
          }
          // If all mirrors failed or not enough results
          controller.enqueue(encoder.encode(`event: results\ndata: ${JSON.stringify({ results: accumulatedResults, usedEngine: "searx-html", usedMirrors })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
    // Fallback: normal JSON response (for non-SSE clients)
    try {
      const religion = req.nextUrl.searchParams.get("religion") || "";
      let siteFilters: string[] = [];
      if (religion && RELIGION_SITES[religion]) {
        siteFilters = RELIGION_SITES[religion];
      }
      let filterStr = "";
      if (siteFilters.length > 0) {
        filterStr = siteFilters.map((site) => `site:${site}`).join(" OR ");
      }
      const fullQuery = filterStr ? `${query} site:${siteFilters[0]}` : query;
      let lastError: any = null;
      for (const mirror of SEARX_MIRRORS) {
        const base = mirror.endsWith("/") ? mirror : mirror + "/";
        const searxUrl = `${base}search?q=${encodeURIComponent(fullQuery)}&categories=general&language=en&safesearch=1&theme=simple`;
        try {
          const res = await fetch(searxUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; infrastruct/0.1; +https://undivisible.dev)",
              Accept: "text/html,application/xhtml+xml,application/xml",
            },
          });
          const html = await res.text();
          if (!res.ok) {
            lastError = new Error(`Searx search failed: ${res.status} ${res.statusText}`);
            continue;
          }
          // Parse HTML for links using Cheerio
          const $ = cheerio.load(html);
          const results: any[] = [];
          $("article.result").each((_, el) => {
            const link = $(el).find("a.url_header").attr("href");
            const title = $(el).find("h3 a").text();
            const snippet = $(el).find("p.content").text();
            if (link && title) {
              results.push({ title, link, snippet });
            }
          });
          if (results.length > 0) {
            return Response.json({ results, usedEngine: `searx-html`, usedMirror: mirror });
          } else {
            lastError = new Error(`Searx returned no valid results from ${mirror}`);
            continue;
          }
        } catch (err) {
          lastError = err;
          continue;
        }
      }
    }
    catch (error: any) {
      return Response.json(
        { error: "Failed to search with Searx mirrors", details: error?.message || String(error) },
        { status: 500 },
      );
    }
  }

  // ...existing code for scraping a specific URL...
  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let res;
    if (process.env.UNSAFE_FETCH === '1') {
      const https = await import('https');
      const agent = new https.Agent({ rejectUnauthorized: false });
      const fetchUnsafe = (await import('node-fetch')).default;
      res = await fetchUnsafe(url, {
        headers: {
          // Pretend to be a browser
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": url,
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
        },
        // Some sites block bots, so follow redirects
        redirect: "follow",
        agent,
      });
    } else {
      res = await fetch(url, {
        headers: {
          // Pretend to be a browser
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": url,
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
        },
        // Some sites block bots, so follow redirects
        redirect: "follow",
      });
    }

    let html = await res.text();
    // Log status and first 500 chars of response for all fetches
    console.log(`[SCRAPE FETCH] Status: ${res.status} ${res.statusText} for ${url}`);
    console.log(`[SCRAPE FETCH] Response: ${html.slice(0, 500)}`);

    const $ = cheerio.load(html);

    // Remove navigation, menu, sidebar blocks before extracting content
    $("nav, .menu, .navbar, .sidebar, aside, header, footer").remove();

    // Try multiple selectors for main content
    let content = "";
    let contentFound = false;
    const selectors = [
      ".content",
      "#content",
      ".main-content",
      "main",
      "article",
      "[role='main']"
    ];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length > 0) {
        // Concatenate all significant text blocks inside the container
        let blocks: string[] = [];
        el.find("p, div, section, span, li").each((_, block) => {
          const txt = $(block).text().replace(/\s+/g, " ").trim();
          if (txt.length > 80) blocks.push(txt);
        });
        // If no blocks found, fallback to full container text
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
      // Concatenate all significant text blocks in <body>
      let blocks: string[] = [];
      $("body p, body div, body section, body span, body li").each((_, block) => {
        const txt = $(block).text().replace(/\s+/g, " ").trim();
        if (txt.length > 80) blocks.push(txt);
      });
      // If no blocks found, fallback to full body text
      if (blocks.length === 0 && $("body").text().trim().length > 80) {
        blocks.push($("body").text().trim());
      }
      fallbackBody = blocks.join("\n\n");
      // Limit to first 2000 chars for summary
      if (fallbackBody.length > 2000) {
        fallbackBody = fallbackBody.slice(0, 2000) + "...";
      }
    }

    // Only return 200 if we have some content or title
    if ((contentFound && content) || fallbackBody || title) {
      console.log(`[SCRAPE SUCCESS] Returning content for ${url}`);
      return Response.json({
        url,
        title,
        content: contentFound ? content : fallbackBody,
        usedContentSelector: contentFound ? selectors.find(sel => $(sel).first().length > 0) : null,
      });
    } else {
      console.error(`[SCRAPE ERROR] No valid content scraped for ${url}`);
      console.error(`[SCRAPE ERROR] Details:`, { url, title, content, fallbackBody });
      return Response.json(
        { error: "No valid content scraped", details: { url, title, content, fallbackBody, status: res.status, response: html.slice(0, 500) } },
        { status: 500 },
      );
    }
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
