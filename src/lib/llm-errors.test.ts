import { describe, expect, test } from "bun:test";
import {
  detectRefusalInParsed,
  detectRefusalInText,
  QueryGenerationError,
} from "./llm-errors";

describe("detectRefusalInText", () => {
  test("detects policy refusal", () => {
    expect(
      detectRefusalInText("I can't help with that request due to content policy."),
    ).toContain("can't help");
  });

  test("ignores normal json", () => {
    expect(detectRefusalInText('{"queries":{"judaism":{"query":"test","numResults":1}}}')).toBeNull();
  });
});

describe("detectRefusalInParsed", () => {
  test("detects error field", () => {
    expect(
      detectRefusalInParsed({ error: "I cannot generate that information." }),
    ).toContain("cannot generate");
  });
});

describe("QueryGenerationError", () => {
  test("marks refusal code", () => {
    const err = new QueryGenerationError("refusal", "blocked");
    expect(err.isRefusal).toBe(true);
  });
});
