// Theme registry for HTML notes & exam paper generation
export type ThemeKind = "notes" | "exam";

export interface ThemePreview {
  key: string;
  label: string;
  swatches: string[]; // 3 colors for the preview chip
  bg: string;
  fg: string;
}

export const NOTES_THEMES: ThemePreview[] = [
  { key: "academic-dark", label: "Academic", swatches: ["#f8f7f2", "#1a1a2e", "#c8a84b"], bg: "#f8f7f2", fg: "#1a1a2e" },
  { key: "midnight-study", label: "Midnight", swatches: ["#0f0f1a", "#1a1a2e", "#7c3aed"], bg: "#0f0f1a", fg: "#e8e6f0" },
  { key: "clean-minimal", label: "Minimal", swatches: ["#ffffff", "#fafafa", "#2563eb"], bg: "#ffffff", fg: "#0f172a" },
  { key: "nature-journal", label: "Nature", swatches: ["#f0f4e8", "#ffffff", "#2d6a4f"], bg: "#f0f4e8", fg: "#1b4332" },
  { key: "vibrant-neon", label: "Neon Pop", swatches: ["#fafafa", "#f59e0b", "#ec4899"], bg: "#fafafa", fg: "#0f172a" },
  { key: "ib-official", label: "IB Official", swatches: ["#f5f5f0", "#003087", "#ffffff"], bg: "#f5f5f0", fg: "#003087" },
  { key: "boxed-grid", label: "Boxed Grid", swatches: ["#ffffff", "#cbd5e1", "#4f46e5"], bg: "#ffffff", fg: "#1e293b" },
  { key: "tabular-notes", label: "Tabular", swatches: ["#fafafa", "#1e3a8a", "#e2e8f0"], bg: "#fafafa", fg: "#1e3a8a" },
  { key: "comic-book", label: "Comic", swatches: ["#fffbeb", "#dc2626", "#facc15"], bg: "#fffbeb", fg: "#000000" },
  { key: "terminal-code", label: "Terminal", swatches: ["#0d0d0d", "#22c55e", "#fbbf24"], bg: "#0d0d0d", fg: "#22c55e" },
  { key: "magazine-editorial", label: "Magazine", swatches: ["#fdf6e3", "#b91c1c", "#1c1917"], bg: "#fdf6e3", fg: "#1c1917" },
  { key: "kawaii-pastel", label: "Kawaii", swatches: ["#fff5f7", "#ecfdf5", "#f9a8d4"], bg: "#fff5f7", fg: "#831843" },
];

export const EXAM_THEMES: ThemePreview[] = [
  { key: "classic-paper", label: "Classic", swatches: ["#f0ede6", "#1c1c1c", "#c8a84b"], bg: "#f0ede6", fg: "#1c1c1c" },
  { key: "dark-exam", label: "Dark", swatches: ["#111827", "#1f2937", "#7c3aed"], bg: "#111827", fg: "#f9fafb" },
  { key: "blueprint", label: "Blueprint", swatches: ["#1e3a5f", "#1a3454", "#06b6d4"], bg: "#1e3a5f", fg: "#e0eeff" },
  { key: "newspaper", label: "Newspaper", swatches: ["#fffef7", "#000000", "#000000"], bg: "#fffef7", fg: "#000000" },
  { key: "modern-minimal", label: "Minimal", swatches: ["#ffffff", "#f8fafc", "#0ea5e9"], bg: "#ffffff", fg: "#0f172a" },
  { key: "ib-official", label: "IB Official", swatches: ["#ffffff", "#003087", "#f5f5f0"], bg: "#ffffff", fg: "#003087" },
  { key: "table-grid-exam", label: "Table Grid", swatches: ["#ffffff", "#1e3a8a", "#f1f5f9"], bg: "#ffffff", fg: "#1e3a8a" },
  { key: "card-deck-exam", label: "Card Deck", swatches: ["#f1f5f9", "#ffffff", "#059669"], bg: "#f1f5f9", fg: "#0f172a" },
  { key: "two-column-booklet", label: "Booklet", swatches: ["#fdf6e3", "#78350f", "#fef3c7"], bg: "#fdf6e3", fg: "#78350f" },
  { key: "vintage-typewriter", label: "Typewriter", swatches: ["#f5efe0", "#1c1917", "#dc2626"], bg: "#f5efe0", fg: "#1c1917" },
  { key: "neo-brutalist", label: "Brutalist", swatches: ["#fef3c7", "#000000", "#ec4899"], bg: "#fef3c7", fg: "#000000" },
  { key: "scientific-lab", label: "Lab", swatches: ["#ffffff", "#1e40af", "#dbeafe"], bg: "#ffffff", fg: "#1e40af" },
];

const GENERATE_KEYWORDS = [
  "generate notes", "generate exam", "generate a", "make notes", "create notes",
  "make an exam", "create exam", "study notes", "exam paper", "give me notes",
  "make a paper", "practice exam", "revision notes", "topic notes",
  "notes for", "exam for", "worksheet", "make a test paper", "generate paper",
];

export function detectGenerateIntent(message: string): boolean {
  const l = message.toLowerCase();
  return GENERATE_KEYWORDS.some(kw => l.includes(kw));
}
