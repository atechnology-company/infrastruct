export const RELIGION_KEYS = [
  "judaism",
  "christianity",
  "islam",
  "hinduism",
  "sikhism",
  "buddhism",
] as const;

export type ReligionKey = (typeof RELIGION_KEYS)[number];

export const DEFAULT_ENABLED_RELIGIONS: Record<ReligionKey, boolean> = {
  judaism: true,
  christianity: true,
  islam: true,
  hinduism: true,
  sikhism: true,
  buddhism: true,
};

const STORAGE_KEY = "infrastruct-religions";

export function loadEnabledReligions(): Record<ReligionKey, boolean> {
  if (typeof window === "undefined") {
    return { ...DEFAULT_ENABLED_RELIGIONS };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_ENABLED_RELIGIONS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULT_ENABLED_RELIGIONS };
}

export function saveEnabledReligions(enabled: Record<ReligionKey, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
}

export function isReligionKey(key: string): key is ReligionKey {
  return (RELIGION_KEYS as readonly string[]).includes(key);
}
