export const RELIGION_SITES: Record<string, string[]> = {
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
  hinduism: [
    "vedabase.io",
    "hinduwebsite.com",
    "bhagavad-gita.org",
    "swaminarayan.faith",
    "vedanta.org",
    "hinduismtoday.com",
    "sacred-texts.com",
  ],
  sikhism: [
    "sikhnet.com",
    "sikhs.org",
    "searchgurbani.com",
    "srigranth.org",
    "sikhiwiki.org",
    "gurugranthsahib.org",
  ],
  buddhism: [
    "accesstoinsight.org",
    "dhammatalks.org",
    "buddhanet.net",
    "tricycle.org",
    "lionsroar.com",
    "suttacentral.net",
  ],
};

export function siteFiltersForReligion(religion: string): string[] {
  if (!religion || religion === "philosophy") return [];
  return RELIGION_SITES[religion] ?? [];
}

export function buildScopedSearchQuery(query: string, siteFilters: string[]): string {
  const trimmed = query.trim();
  if (siteFilters.length === 0) return trimmed;
  const siteClause = siteFilters.map((site) => `site:${site}`).join(" OR ");
  return `${trimmed} (${siteClause})`;
}
