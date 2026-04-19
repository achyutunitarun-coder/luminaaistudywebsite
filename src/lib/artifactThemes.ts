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
  { key: "academic-dark", label: "Academic Dark", swatches: ["#f8f7f2", "#1a1a2e", "#c8a84b"], bg: "#f8f7f2", fg: "#1a1a2e" },
  { key: "midnight-study", label: "Midnight Study", swatches: ["#0f0f1a", "#1a1a2e", "#7c3aed"], bg: "#0f0f1a", fg: "#e8e6f0" },
  { key: "clean-minimal", label: "Clean Minimal", swatches: ["#ffffff", "#fafafa", "#2563eb"], bg: "#ffffff", fg: "#0f172a" },
  { key: "nature-journal", label: "Nature Journal", swatches: ["#f0f4e8", "#ffffff", "#2d6a4f"], bg: "#f0f4e8", fg: "#1b4332" },
  { key: "vibrant-neon", label: "Vibrant Neon", swatches: ["#fafafa", "#f59e0b", "#ec4899"], bg: "#fafafa", fg: "#0f172a" },
  { key: "ib-official", label: "IB Official", swatches: ["#f5f5f0", "#003087", "#ffffff"], bg: "#f5f5f0", fg: "#003087" },
];

export const EXAM_THEMES: ThemePreview[] = [
  { key: "classic-paper", label: "Classic Paper", swatches: ["#f0ede6", "#1c1c1c", "#c8a84b"], bg: "#f0ede6", fg: "#1c1c1c" },
  { key: "dark-exam", label: "Dark Exam", swatches: ["#111827", "#1f2937", "#7c3aed"], bg: "#111827", fg: "#f9fafb" },
  { key: "blueprint", label: "Blueprint", swatches: ["#1e3a5f", "#1a3454", "#06b6d4"], bg: "#1e3a5f", fg: "#e0eeff" },
  { key: "newspaper", label: "Newspaper", swatches: ["#fffef7", "#000000", "#000000"], bg: "#fffef7", fg: "#000000" },
  { key: "modern-minimal", label: "Modern Minimal", swatches: ["#ffffff", "#f8fafc", "#0ea5e9"], bg: "#ffffff", fg: "#0f172a" },
  { key: "ib-official", label: "IB Official", swatches: ["#ffffff", "#003087", "#f5f5f0"], bg: "#ffffff", fg: "#003087" },
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
