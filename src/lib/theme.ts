export type AccentTheme = "magenta" | "orange" | "yellow" | "purple";

export const ACCENT_THEMES: Record<AccentTheme, { label: string; hex: string }> = {
  magenta: { label: "Magenta", hex: "#d400ff" },
  orange: { label: "Orange", hex: "#ff6600" },
  yellow: { label: "Yellow", hex: "#ffcc00" },
  purple: { label: "Purple", hex: "#9d00ff" },
};

// Exported so the boot script in __root.tsx — which must read the same key
// before first paint, to avoid a flash of the default theme — stays in sync.
export const ACCENT_THEME_STORAGE_KEY = "promptstar:accent-theme";
const STORAGE_KEY = ACCENT_THEME_STORAGE_KEY;

function isAccentTheme(value: string): value is AccentTheme {
  return value in ACCENT_THEMES;
}

export function getStoredAccentTheme(): AccentTheme {
  if (typeof window === "undefined") return "magenta";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored !== null && isAccentTheme(stored) ? stored : "magenta";
}

// The brand's lead colour lives in --magenta (and --primary/--ring track it).
// Re-pointing just that one custom property — registered as an animatable
// <color> via @property in styles.css — lets every existing text-magenta /
// bg-magenta / ring-magenta usage repaint smoothly without remapping the
// rest of the four-colour palette (which would flatten the contrast it relies on).
export function applyAccentTheme(theme: AccentTheme): void {
  document.documentElement.style.setProperty("--magenta", ACCENT_THEMES[theme].hex);
}

export function persistAccentTheme(theme: AccentTheme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
}
