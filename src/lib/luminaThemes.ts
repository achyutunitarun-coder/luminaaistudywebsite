export type ThemeId = "cosmos" | "aurora" | "neon" | "editorial";

export interface LuminaTheme {
  id: ThemeId;
  label: string;
  bg: string;
  primary: string;
  accent: string;
  fontHead: string;
  fontBody: string;
  googleFonts: string;
  swatch: string; // gradient for circle button
}

export const THEMES: Record<ThemeId, LuminaTheme> = {
  cosmos: {
    id: "cosmos", label: "Cosmos",
    bg: "#04040E", primary: "#7B61FF", accent: "#00F5C4",
    fontHead: "'Exo 2', sans-serif", fontBody: "'Nunito', sans-serif",
    googleFonts: "https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;800&family=Nunito:wght@400;600;700&display=swap",
    swatch: "linear-gradient(135deg,#7B61FF,#00F5C4)",
  },
  aurora: {
    id: "aurora", label: "Aurora",
    bg: "#FDFAF3", primary: "#2D6A4F", accent: "#E07A5F",
    fontHead: "'Playfair Display', serif", fontBody: "'Lora', serif",
    googleFonts: "https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Playfair+Display:wght@600;800&display=swap",
    swatch: "linear-gradient(135deg,#2D6A4F,#E07A5F)",
  },
  neon: {
    id: "neon", label: "Neon",
    bg: "#050508", primary: "#FF006E", accent: "#00D9FF",
    fontHead: "'Orbitron', sans-serif", fontBody: "'Rajdhani', sans-serif",
    googleFonts: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;800&family=Rajdhani:wght@400;600&display=swap",
    swatch: "linear-gradient(135deg,#FF006E,#00D9FF)",
  },
  editorial: {
    id: "editorial", label: "Editorial",
    bg: "#F9F6EF", primary: "#1A1A2E", accent: "#C9973F",
    fontHead: "'Cormorant Garamond', serif", fontBody: "'DM Sans', sans-serif",
    googleFonts: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500&display=swap",
    swatch: "linear-gradient(135deg,#1A1A2E,#C9973F)",
  },
};

export const THEME_LIST = Object.values(THEMES);
