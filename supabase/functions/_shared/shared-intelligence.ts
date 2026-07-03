export type ThemeId = "professional_blue" | "dark_modern" | "warm_minimal" | "custom";

export interface Theme {
  id: ThemeId;
  colors: {
    primary: string; secondary: string; accent: string;
    background: string; surface: string; text_primary: string; text_secondary: string;
    success: string; warning: string; error: string;
  };
  typography: {
    heading_font: string; body_font: string; mono_font: string; scale_ratio: number;
  };
  spacing: { grid_columns: number; gutter: number; margin: number };
  effects: { border_radius: number; shadow_depth: "light" | "medium" | "heavy"; glassmorphism: boolean };
}

const THEMES: Record<ThemeId, Theme> = {
  professional_blue: {
    id: "professional_blue",
    colors: { primary: "#2563eb", secondary: "#3b82f6", accent: "#f59e0b", background: "#ffffff", surface: "#f8fafc", text_primary: "#0f172a", text_secondary: "#64748b", success: "#22c55e", warning: "#f59e0b", error: "#ef4444" },
    typography: { heading_font: "Inter", body_font: "Inter", mono_font: "JetBrains Mono", scale_ratio: 1.25 },
    spacing: { grid_columns: 12, gutter: 24, margin: 48 },
    effects: { border_radius: 8, shadow_depth: "light", glassmorphism: false },
  },
  dark_modern: {
    id: "dark_modern",
    colors: { primary: "#6366f1", secondary: "#8b5cf6", accent: "#f59e0b", background: "#0f172a", surface: "#1e293b", text_primary: "#f8fafc", text_secondary: "#94a3b8", success: "#22c55e", warning: "#f59e0b", error: "#ef4444" },
    typography: { heading_font: "Inter", body_font: "Inter", mono_font: "JetBrains Mono", scale_ratio: 1.25 },
    spacing: { grid_columns: 12, gutter: 24, margin: 48 },
    effects: { border_radius: 12, shadow_depth: "medium", glassmorphism: true },
  },
  warm_minimal: {
    id: "warm_minimal",
    colors: { primary: "#ea580c", secondary: "#f97316", accent: "#0d9488", background: "#fafaf9", surface: "#f5f5f4", text_primary: "#292524", text_secondary: "#78716c", success: "#22c55e", warning: "#f59e0b", error: "#ef4444" },
    typography: { heading_font: "Georgia", body_font: "Inter", mono_font: "JetBrains Mono", scale_ratio: 1.25 },
    spacing: { grid_columns: 12, gutter: 24, margin: 48 },
    effects: { border_radius: 8, shadow_depth: "light", glassmorphism: false },
  },
  custom: {
    id: "custom",
    colors: { primary: "#6366f1", secondary: "#8b5cf6", accent: "#f59e0b", background: "#0f172a", surface: "#1e293b", text_primary: "#f8fafc", text_secondary: "#94a3b8", success: "#22c55e", warning: "#f59e0b", error: "#ef4444" },
    typography: { heading_font: "Inter", body_font: "Inter", mono_font: "JetBrains Mono", scale_ratio: 1.25 },
    spacing: { grid_columns: 12, gutter: 24, margin: 48 },
    effects: { border_radius: 12, shadow_depth: "medium", glassmorphism: true },
  },
};

export class DesignSystem {
  getTheme(id: ThemeId): Theme {
    return { ...THEMES[id] ?? THEMES.dark_modern };
  }

  generatePalette(baseColor: string, mood: "light" | "dark" | "vibrant"): { 50: string; 100: string; 200: string; 500: string; 700: string; 900: string } {
    return { 50: `${baseColor}1a`, 100: `${baseColor}33`, 200: `${baseColor}4d`, 500: baseColor, 700: `${baseColor}cc`, 900: `${baseColor}e6` };
  }

  suggestTypography(tone: "professional" | "creative" | "technical", medium: "print" | "screen"): { heading: string; body: string; mono: string } {
    if (medium === "print") return { heading: "Georgia", body: "Georgia", mono: "JetBrains Mono" };
    if (tone === "creative") return { heading: "Inter", body: "Inter", mono: "JetBrains Mono" };
    if (tone === "technical") return { heading: "Inter", body: "Inter", mono: "JetBrains Mono" };
    return { heading: "Inter", body: "Inter", mono: "JetBrains Mono" };
  }

  getShadows(depth: "light" | "medium" | "heavy"): { sm: string; md: string; lg: string; xl: string } {
    return {
      light: { sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)", md: "0 4px 6px -1px rgb(0 0 0 / 0.1)", lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)", xl: "0 20px 25px -5px rgb(0 0 0 / 0.1)" },
      medium: { sm: "0 1px 3px 0 rgb(0 0 0 / 0.1)", md: "0 4px 8px -2px rgb(0 0 0 / 0.15)", lg: "0 12px 20px -4px rgb(0 0 0 / 0.15)", xl: "0 24px 30px -6px rgb(0 0 0 / 0.15)" },
      heavy: { sm: "0 2px 4px 0 rgb(0 0 0 / 0.15)", md: "0 6px 12px -2px rgb(0 0 0 / 0.2)", lg: "0 16px 24px -4px rgb(0 0 0 / 0.2)", xl: "0 32px 40px -8px rgb(0 0 0 / 0.2)" },
    }[depth];
  }
}

export class ContentAnalyzer {
  extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  }

  determineTone(text: string): "formal" | "conversational" | "technical" | "persuasive" {
    const lower = text.toLowerCase();
    const formal = /\b(however|therefore|furthermore|consequently|nevertheless|regarding)\b/g;
    const conversational = /\b(you know|like|basically|actually|honestly|anyway)\b/g;
    const technical = /\b(algorithm|function|implementation|architecture|protocol|schema|config)\b/g;
    const persuasive = /\b(believe|must|should|need|important|crucial|essential|transform)\b/g;
    const scores = { formal: (lower.match(formal) ?? []).length, conversational: (lower.match(conversational) ?? []).length, technical: (lower.match(technical) ?? []).length, persuasive: (lower.match(persuasive) ?? []).length };
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as any ?? "formal";
  }

  suggestStructure(contentType: "report" | "essay" | "guide" | "proposal", length: "short" | "medium" | "long"): string[] {
    const structures: Record<string, Record<string, string[]>> = {
      report: { short: ["Executive Summary", "Key Findings", "Recommendations"], medium: ["Executive Summary", "Background", "Analysis", "Findings", "Recommendations", "Conclusion"], long: ["Executive Summary", "Introduction", "Methodology", "Analysis", "Findings", "Discussion", "Recommendations", "Conclusion", "Appendix"] },
      essay: { short: ["Introduction", "Body", "Conclusion"], medium: ["Introduction", "Argument", "Counter-Argument", "Synthesis", "Conclusion"], long: ["Introduction", "Background", "Main Argument", "Supporting Evidence", "Counter-Arguments", "Rebuttal", "Conclusion", "References"] },
      guide: { short: ["Overview", "Steps", "Summary"], medium: ["Introduction", "Prerequisites", "Step-by-Step", "Troubleshooting", "Next Steps"], long: ["Introduction", "Prerequisites", "Step-by-Step Guide", "Advanced Topics", "Troubleshooting", "FAQ", "Appendix"] },
      proposal: { short: ["Problem", "Solution", "Budget"], medium: ["Executive Summary", "Problem Statement", "Proposed Solution", "Timeline", "Budget", "Next Steps"], long: ["Executive Summary", "Introduction", "Problem Statement", "Proposed Solution", "Methodology", "Timeline", "Budget", "Team", "Risks", "Conclusion"] },
    };
    return structures[contentType]?.[length] ?? structures.report.medium;
  }

  estimateReadingTime(text: string): string {
    const words = text.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min`;
  }
}

export class ResearchEngine {
  async search(query: string, _sources?: string[], _depth?: string): Promise<{ title: string; snippet: string; url: string }[]> {
    return [{ title: "Search Result", snippet: `Results for: ${query}`, url: "#" }];
  }

  extractEntities(text: string): { people: string[]; organizations: string[]; locations: string[]; dates: string[] } {
    const people = text.match(/([A-Z][a-z]+)\s([A-Z][a-z]+)/g) ?? [];
    const orgs = text.match(/([A-Z][A-Za-z]+(?: Inc| Corp| Ltd| LLC| GmbH| SA| SE)?)/g) ?? [];
    const dates = text.match(/\b(20\d{2})[-/]\d{2}[-/]\d{2}\b/g) ?? [];
    return { people: people.slice(0, 10), organizations: orgs.slice(0, 10), locations: [], dates: dates.slice(0, 10) };
  }
}

export const designSystem = new DesignSystem();
export const contentAnalyzer = new ContentAnalyzer();
export const researchEngine = new ResearchEngine();
