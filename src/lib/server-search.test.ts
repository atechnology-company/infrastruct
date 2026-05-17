import { describe, expect, test } from "bun:test";
import { buildScopedSearchQuery, siteFiltersForReligion } from "@/lib/religion-sites";

describe("buildScopedSearchQuery", () => {
  test("adds site OR clause for religions", () => {
    const q = buildScopedSearchQuery("kashrut", ["chabad.org", "sefaria.org"]);
    expect(q).toContain("kashrut");
    expect(q).toContain("site:chabad.org");
    expect(q).toContain(" OR ");
  });

  test("leaves philosophy unscoped", () => {
    expect(buildScopedSearchQuery("ethics", siteFiltersForReligion("philosophy"))).toBe(
      "ethics",
    );
  });
});
