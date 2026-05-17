export type QueryGenerationErrorCode =
  | "refusal"
  | "timeout"
  | "parse"
  | "model";

export class QueryGenerationError extends Error {
  readonly code: QueryGenerationErrorCode;

  constructor(code: QueryGenerationErrorCode, message: string) {
    super(message);
    this.name = "QueryGenerationError";
    this.code = code;
  }

  get isRefusal(): boolean {
    return this.code === "refusal";
  }
}

const REFUSAL_PATTERNS: RegExp[] = [
  /\b(i\s+)?can(?:not|'t)\s+(?:help|assist|provide|generate|answer|comply)/i,
  /\b(i\s+)?am\s+unable\s+to\s+(?:help|assist|provide|generate|answer)/i,
  /\b(i\s+)?won(?:'t|t)\s+(?:help|assist|provide|generate|answer)/i,
  /\bnot\s+able\s+to\s+(?:help|assist|provide|generate|answer)/i,
  /\bdeclin(?:e|ed|ing)\s+to\s+(?:help|assist|provide|generate|answer)/i,
  /\brefus(?:e|ed|ing)\s+to\s+(?:help|assist|provide|generate|answer)/i,
  /\bagainst\s+(?:my\s+)?(?:policy|policies|guidelines|rules)/i,
  /\bcontent\s+polic(?:y|ies)/i,
  /\bsafety\s+(?:policy|policies|guidelines)/i,
  /\b(?:harmful|unsafe|inappropriate|offensive)\s+content/i,
  /\bnot\s+(?:allowed|permitted)\s+to\b/i,
  /\bcannot\s+generate\s+(?:that|this)\s+information/i,
  /\bcan(?:not|'t)\s+generate\s+(?:that|this)\s+information/i,
  /\bas\s+an\s+ai\b.*\b(?:cannot|can't|unable)\b/i,
];

export function detectRefusalInText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      const sentence = trimmed
        .split(/(?<=[.!?])\s+/)
        .find((s) => pattern.test(s))?.trim();
      return sentence && sentence.length < 400 ? sentence : trimmed.slice(0, 400).trim();
    }
  }

  return null;
}

export function detectRefusalInParsed(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;

  for (const key of ["error", "refusal", "message", "reason"]) {
    const field = obj[key];
    if (typeof field === "string" && field.trim()) {
      const refusal = detectRefusalInText(field);
      if (refusal) return refusal;
      if (key === "error" || key === "refusal") return field.trim();
    }
  }

  if (obj.queries && typeof obj.queries === "object") {
    const queries = obj.queries as Record<string, unknown>;
    const values = Object.values(queries);
    if (values.length > 0) {
      const allSkipped = values.every((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const q = entry as Record<string, unknown>;
        const num = Number(q.numResults ?? q.num_results);
        const query = String(q.query ?? "").trim();
        return num === 0 && query.length === 0;
      });
      if (allSkipped) {
        return "The model did not produce any search queries for this topic.";
      }
    }
  }

  return null;
}

export function userMessageForQueryError(err: QueryGenerationError): string {
  switch (err.code) {
    case "refusal":
      return err.message;
    case "timeout":
      return "The on-device model took too long to plan this search. Try again or use a shorter question.";
    case "parse":
      return "The model returned an invalid response when planning searches. Try again.";
    case "model":
    default:
      return err.message || "The on-device model could not plan this search.";
  }
}
