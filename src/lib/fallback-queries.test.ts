import { describe, expect, test } from "bun:test";
import { buildFallbackSearchQueries } from "./fallback-queries";

describe("buildFallbackSearchQueries", () => {
  test("returns all categories with prompt as query", () => {
    const { queries } = buildFallbackSearchQueries("homosexuality");
    expect(queries.philosophy.query).toBe("homosexuality");
    expect(queries.judaism.numResults).toBe(3);
  });

  test("zeros disabled religions", () => {
    const { queries } = buildFallbackSearchQueries("test", { judaism: false });
    expect(queries.judaism.numResults).toBe(0);
    expect(queries.christianity.numResults).toBe(3);
  });
});
