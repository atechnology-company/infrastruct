export function cleanModelJson(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```+(json)?\s*/i, "");
  cleaned = cleaned.replace(/```+\s*$/i, "");
  cleaned = cleaned.replace(/^`+|`+$/g, "");
  return cleaned.trim();
}

export function parseModelJson<T>(text: string): T {
  return JSON.parse(cleanModelJson(text)) as T;
}
