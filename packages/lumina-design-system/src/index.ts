import type { DesignSystemThemeConfig as ThemeConfig, DesignSystemThemePreset as ThemePreset, ColorScale, SemanticTokens, TypographyTokens, SpacingTokens, MotionTokens, ShadowTokens, RadiusTokens } from '@lumina/types';

// Color scale generation (12-step Radix-style)
export function generateColorScale(baseHue: number, saturation: number, lightness: number): ColorScale {
  return {
    1:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 35, 98)}%)`,
    2:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 28, 95)}%)`,
    3:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 22, 92)}%)`,
    4:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 16, 88)}%)`,
    5:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 10, 84)}%)`,
    6:  `hsl(${baseHue}, ${saturation}%, ${Math.min(lightness + 5, 78)}%)`,
    7:  `hsl(${baseHue}, ${saturation}%, ${lightness}%)`,
    8:  `hsl(${baseHue}, ${saturation}%, ${Math.max(lightness - 5, 20)}%)`,
    9:  `hsl(${baseHue}, ${saturation}%, ${Math.max(lightness - 10, 15)}%)`,
    10: `hsl(${baseHue}, ${saturation}%, ${Math.max(lightness - 15, 10)}%)`,
    11: `hsl(${baseHue}, ${saturation}%, ${Math.max(lightness - 20, 6)}%)`,
    12: `hsl(${baseHue}, ${saturation}%, ${Math.max(lightness - 25, 3)}%)`,
  };
}

// Theme presets
export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  minimal: {
    name: 'Minimal',
    preset: 'minimal',
    colors: {
      primary: generateColorScale(220, 15, 50),
      neutral: generateColorScale(220, 5, 50),
      accent: generateColorScale(220, 15, 50),
      success: generateColorScale(142, 30, 45),
      warning: generateColorScale(38, 50, 50),
      error: generateColorScale(0, 50, 50),
      info: generateColorScale(220, 30, 50),
    },
    typography: {
      display: "'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.3, normal: 1.6, relaxed: 1.8 },
      letterSpacing: { tighter: '-0.05em', tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em', widest: '0.1em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '150ms', normal: '250ms', slow: '400ms', glacial: '800ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.5, 1.25, 0.75, 1.25)' },
    borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px', full: '9999px' },
    shadows: { 1: '0 1px 2px rgb(0 0 0 / 0.04)', 2: '0 1px 3px rgb(0 0 0 / 0.08)', 3: '0 4px 6px rgb(0 0 0 / 0.08)', 4: '0 10px 15px rgb(0 0 0 / 0.08)', 5: '0 20px 25px rgb(0 0 0 / 0.08)', 6: '0 25px 50px rgb(0 0 0 / 0.18)' },
    gradients: {},
    darkMode: true,
  },
  bold: {
    name: 'Bold',
    preset: 'bold',
    colors: {
      primary: generateColorScale(263, 70, 55),
      neutral: generateColorScale(263, 5, 50),
      accent: generateColorScale(174, 65, 50),
      success: generateColorScale(142, 71, 45),
      warning: generateColorScale(38, 92, 50),
      error: generateColorScale(0, 62, 50),
      info: generateColorScale(263, 70, 55),
    },
    typography: {
      display: "'Plus Jakarta Sans', system-ui, sans-serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.05, snug: 1.25, normal: 1.6, relaxed: 1.8 },
      letterSpacing: { tighter: '-0.04em', tight: '-0.02em', normal: '0', wide: '0.02em', wider: '0.04em', widest: '0.1em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '80ms', fast: '150ms', normal: '220ms', slow: '380ms', glacial: '800ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px', full: '9999px' },
    shadows: { 1: '0 1px 2px rgb(0 0 0 / 0.05)', 2: '0 2px 8px rgb(0 0 0 / 0.05)', 3: '0 4px 20px rgb(0 0 0 / 0.06)', 4: '0 8px 40px rgb(0 0 0 / 0.07)', 5: '0 16px 48px rgb(0 0 0 / 0.08)', 6: '0 24px 64px rgb(0 0 0 / 0.12)' },
    gradients: {},
    darkMode: true,
  },
  editorial: {
    name: 'Editorial',
    preset: 'editorial',
    colors: {
      primary: generateColorScale(30, 10, 45),
      neutral: generateColorScale(30, 5, 50),
      accent: generateColorScale(0, 40, 50),
      success: generateColorScale(142, 20, 45),
      warning: generateColorScale(38, 40, 50),
      error: generateColorScale(0, 40, 50),
      info: generateColorScale(30, 10, 45),
    },
    typography: {
      display: "'Instrument Serif', Georgia, serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '2rem', '4xl': '2.5rem', '5xl': '3.5rem' },
      lineHeight: { tight: 1.1, snug: 1.35, normal: 1.7, relaxed: 1.9 },
      letterSpacing: { tighter: '-0.03em', tight: '-0.015em', normal: '0', wide: '0.015em', wider: '0.03em', widest: '0.08em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 400, extrabold: 700 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '200ms', normal: '350ms', slow: '500ms', glacial: '1000ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '4px', md: '6px', lg: '10px', xl: '14px', '2xl': '20px', full: '9999px' },
    shadows: { 1: '0 1px 2px rgb(0 0 0 / 0.03)', 2: '0 1px 4px rgb(0 0 0 / 0.05)', 3: '0 4px 12px rgb(0 0 0 / 0.06)', 4: '0 8px 30px rgb(0 0 0 / 0.07)', 5: '0 16px 40px rgb(0 0 0 / 0.08)', 6: '0 24px 60px rgb(0 0 0 / 0.1)' },
    gradients: {},
    darkMode: true,
  },
  glassmorphic: {
    name: 'Glassmorphic',
    preset: 'glassmorphic',
    colors: {
      primary: generateColorScale(260, 60, 60),
      neutral: generateColorScale(260, 10, 50),
      accent: generateColorScale(200, 60, 55),
      success: generateColorScale(142, 60, 45),
      warning: generateColorScale(38, 80, 50),
      error: generateColorScale(0, 60, 50),
      info: generateColorScale(260, 60, 60),
    },
    typography: {
      display: "'Plus Jakarta Sans', system-ui, sans-serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.3, normal: 1.6, relaxed: 1.8 },
      letterSpacing: { tighter: '-0.04em', tight: '-0.02em', normal: '0', wide: '0.02em', wider: '0.04em', widest: '0.1em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '200ms', normal: '300ms', slow: '500ms', glacial: '800ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '28px', full: '9999px' },
    shadows: { 1: '0 1px 3px rgb(0 0 0 / 0.08)', 2: '0 4px 12px rgb(0 0 0 / 0.1)', 3: '0 8px 24px rgb(0 0 0 / 0.12)', 4: '0 16px 48px rgb(0 0 0 / 0.15)', 5: '0 24px 64px rgb(0 0 0 / 0.18)', 6: '0 32px 80px rgb(0 0 0 / 0.22)' },
    gradients: {},
    darkMode: true,
  },
  brutalist: {
    name: 'Brutalist',
    preset: 'brutalist',
    colors: {
      primary: generateColorScale(0, 0, 0),
      neutral: generateColorScale(0, 0, 50),
      accent: generateColorScale(60, 100, 50),
      success: generateColorScale(120, 100, 50),
      warning: generateColorScale(45, 100, 50),
      error: generateColorScale(0, 100, 50),
      info: generateColorScale(0, 0, 0),
    },
    typography: {
      display: "'JetBrains Mono', monospace",
      body: "'JetBrains Mono', monospace",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.7 },
      letterSpacing: { tighter: '-0.02em', tight: '-0.01em', normal: '0', wide: '0.01em', wider: '0.02em', widest: '0.05em' },
      weights: { normal: 400, medium: 500, semibold: 700, bold: 700, extrabold: 900 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '0ms', fast: '50ms', normal: '100ms', slow: '200ms', glacial: '500ms', easeStandard: 'linear', easeEnter: 'linear', easeExit: 'linear', easeSpring: 'linear' },
    borderRadius: { sm: '0px', md: '0px', lg: '0px', xl: '0px', '2xl': '0px', full: '9999px' },
    shadows: { 1: '2px 2px 0 rgb(0 0 0 / 0.1)', 2: '4px 4px 0 rgb(0 0 0 / 0.1)', 3: '6px 6px 0 rgb(0 0 0 / 0.1)', 4: '8px 8px 0 rgb(0 0 0 / 0.15)', 5: '12px 12px 0 rgb(0 0 0 / 0.15)', 6: '16px 16px 0 rgb(0 0 0 / 0.2)' },
    gradients: {},
    darkMode: false,
  },
  organic: {
    name: 'Organic',
    preset: 'organic',
    colors: {
      primary: generateColorScale(142, 30, 40),
      neutral: generateColorScale(30, 10, 50),
      accent: generateColorScale(30, 40, 50),
      success: generateColorScale(142, 30, 45),
      warning: generateColorScale(38, 40, 50),
      error: generateColorScale(0, 40, 50),
      info: generateColorScale(142, 30, 40),
    },
    typography: {
      display: "'Instrument Serif', Georgia, serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.35, normal: 1.7, relaxed: 1.9 },
      letterSpacing: { tighter: '-0.03em', tight: '-0.015em', normal: '0', wide: '0.015em', wider: '0.03em', widest: '0.08em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '200ms', normal: '350ms', slow: '500ms', glacial: '800ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '8px', md: '14px', lg: '20px', xl: '28px', '2xl': '36px', full: '9999px' },
    shadows: { 1: '0 1px 3px rgb(0 0 0 / 0.04)', 2: '0 2px 8px rgb(0 0 0 / 0.06)', 3: '0 6px 16px rgb(0 0 0 / 0.08)', 4: '0 12px 32px rgb(0 0 0 / 0.1)', 5: '0 20px 48px rgb(0 0 0 / 0.12)', 6: '0 28px 64px rgb(0 0 0 / 0.15)' },
    gradients: {},
    darkMode: true,
  },
  technical: {
    name: 'Technical',
    preset: 'technical',
    colors: {
      primary: generateColorScale(142, 60, 50),
      neutral: generateColorScale(220, 10, 50),
      accent: generateColorScale(142, 60, 50),
      success: generateColorScale(142, 60, 50),
      warning: generateColorScale(38, 80, 50),
      error: generateColorScale(0, 60, 50),
      info: generateColorScale(220, 30, 50),
    },
    typography: {
      display: "'JetBrains Mono', monospace",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.7 },
      letterSpacing: { tighter: '-0.02em', tight: '-0.01em', normal: '0', wide: '0.01em', wider: '0.02em', widest: '0.05em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '50ms', fast: '100ms', normal: '150ms', slow: '300ms', glacial: '500ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '2px', md: '4px', lg: '6px', xl: '8px', '2xl': '12px', full: '9999px' },
    shadows: { 1: '0 1px 2px rgb(0 0 0 / 0.05)', 2: '0 2px 4px rgb(0 0 0 / 0.08)', 3: '0 4px 8px rgb(0 0 0 / 0.1)', 4: '0 8px 16px rgb(0 0 0 / 0.12)', 5: '0 16px 32px rgb(0 0 0 / 0.15)', 6: '0 24px 48px rgb(0 0 0 / 0.2)' },
    gradients: {},
    darkMode: true,
  },
  luxury: {
    name: 'Luxury',
    preset: 'luxury',
    colors: {
      primary: generateColorScale(35, 50, 45),
      neutral: generateColorScale(220, 10, 15),
      accent: generateColorScale(35, 50, 45),
      success: generateColorScale(142, 30, 45),
      warning: generateColorScale(38, 50, 50),
      error: generateColorScale(0, 50, 50),
      info: generateColorScale(35, 50, 45),
    },
    typography: {
      display: "'Instrument Serif', Georgia, serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '2rem', '4xl': '2.5rem', '5xl': '3.5rem' },
      lineHeight: { tight: 1.1, snug: 1.35, normal: 1.7, relaxed: 1.9 },
      letterSpacing: { tighter: '-0.03em', tight: '-0.015em', normal: '0', wide: '0.015em', wider: '0.03em', widest: '0.1em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '200ms', normal: '400ms', slow: '600ms', glacial: '1000ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '4px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px', full: '9999px' },
    shadows: { 1: '0 1px 3px rgb(0 0 0 / 0.08)', 2: '0 2px 8px rgb(0 0 0 / 0.12)', 3: '0 6px 20px rgb(0 0 0 / 0.16)', 4: '0 12px 40px rgb(0 0 0 / 0.2)', 5: '0 20px 60px rgb(0 0 0 / 0.25)', 6: '0 30px 80px rgb(0 0 0 / 0.3)' },
    gradients: {},
    darkMode: true,
  },
  playful: {
    name: 'Playful',
    preset: 'playful',
    colors: {
      primary: generateColorScale(280, 70, 55),
      neutral: generateColorScale(280, 10, 50),
      accent: generateColorScale(320, 70, 55),
      success: generateColorScale(142, 60, 45),
      warning: generateColorScale(38, 80, 50),
      error: generateColorScale(340, 70, 50),
      info: generateColorScale(200, 70, 55),
    },
    typography: {
      display: "'Plus Jakarta Sans', system-ui, sans-serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.3, normal: 1.6, relaxed: 1.8 },
      letterSpacing: { tighter: '-0.03em', tight: '-0.015em', normal: '0', wide: '0.015em', wider: '0.03em', widest: '0.08em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '80ms', fast: '150ms', normal: '250ms', slow: '400ms', glacial: '700ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.5, 1.25, 0.75, 1.25)' },
    borderRadius: { sm: '12px', md: '16px', lg: '20px', xl: '24px', '2xl': '32px', full: '9999px' },
    shadows: { 1: '0 2px 4px rgb(0 0 0 / 0.06)', 2: '0 4px 8px rgb(0 0 0 / 0.08)', 3: '0 8px 16px rgb(0 0 0 / 0.1)', 4: '0 16px 32px rgb(0 0 0 / 0.12)', 5: '0 24px 48px rgb(0 0 0 / 0.15)', 6: '0 32px 64px rgb(0 0 0 / 0.18)' },
    gradients: {},
    darkMode: true,
  },
  custom: {
    name: 'Custom',
    preset: 'custom',
    colors: {
      primary: generateColorScale(220, 50, 50),
      neutral: generateColorScale(220, 10, 50),
      accent: generateColorScale(220, 50, 50),
      success: generateColorScale(142, 50, 45),
      warning: generateColorScale(38, 50, 50),
      error: generateColorScale(0, 50, 50),
      info: generateColorScale(220, 50, 50),
    },
    typography: {
      display: "'Plus Jakarta Sans', system-ui, sans-serif",
      body: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
      lineHeight: { tight: 1.1, snug: 1.3, normal: 1.6, relaxed: 1.8 },
      letterSpacing: { tighter: '-0.04em', tight: '-0.02em', normal: '0', wide: '0.02em', wider: '0.04em', widest: '0.1em' },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem' },
    motion: { instant: '100ms', fast: '150ms', normal: '250ms', slow: '400ms', glacial: '800ms', easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)', easeEnter: 'cubic-bezier(0, 0, 0.2, 1)', easeExit: 'cubic-bezier(0.4, 0, 1, 1)', easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px', full: '9999px' },
    shadows: { 1: '0 1px 2px rgb(0 0 0 / 0.05)', 2: '0 2px 8px rgb(0 0 0 / 0.06)', 3: '0 4px 20px rgb(0 0 0 / 0.08)', 4: '0 8px 40px rgb(0 0 0 / 0.1)', 5: '0 16px 48px rgb(0 0 0 / 0.12)', 6: '0 24px 64px rgb(0 0 0 / 0.18)' },
    gradients: {},
    darkMode: true,
  },
};

// CSS generation
export function generateCssVariables(theme: ThemeConfig): string {
  const lines: string[] = [];
  lines.push(':root {');

  // Color primitives
  const colorNames = ['primary', 'neutral', 'accent', 'success', 'warning', 'error', 'info'] as const;
  for (const name of colorNames) {
    const scale = theme.colors[name];
    if (scale) {
      for (let i = 1; i <= 12; i++) {
        lines.push(`  --color-${name}-${i}: ${scale[i as keyof ColorScale]};`);
      }
    }
  }

  // Semantic tokens
  lines.push(`  --bg-base: var(--color-neutral-1);`);
  lines.push(`  --bg-subtle: var(--color-neutral-2);`);
  lines.push(`  --bg-surface: var(--color-neutral-3);`);
  lines.push(`  --text-primary: var(--color-neutral-12);`);
  lines.push(`  --text-secondary: var(--color-neutral-11);`);
  lines.push(`  --text-muted: var(--color-neutral-9);`);
  lines.push(`  --border-default: var(--color-neutral-6);`);
  lines.push(`  --border-subtle: var(--color-neutral-4);`);
  lines.push(`  --interactive: var(--color-primary-9);`);
  lines.push(`  --interactive-hover: var(--color-primary-10);`);

  // Typography
  lines.push(`  --font-display: ${theme.typography.display};`);
  lines.push(`  --font-body: ${theme.typography.body};`);
  lines.push(`  --font-mono: ${theme.typography.mono};`);

  // Type scale
  for (const [key, value] of Object.entries(theme.typography.scale)) {
    lines.push(`  --text-${key}: ${value};`);
  }

  // Spacing
  for (const [key, value] of Object.entries(theme.spacing)) {
    lines.push(`  --space-${key}: ${value};`);
  }

  // Radius
  for (const [key, value] of Object.entries(theme.borderRadius)) {
    lines.push(`  --radius-${key}: ${value};`);
  }

  // Shadows
  for (const [key, value] of Object.entries(theme.shadows)) {
    lines.push(`  --shadow-${key}: ${value};`);
  }

  // Motion
  lines.push(`  --ease-standard: ${theme.motion.easeStandard};`);
  lines.push(`  --ease-enter: ${theme.motion.easeEnter};`);
  lines.push(`  --ease-exit: ${theme.motion.easeExit};`);
  lines.push(`  --ease-spring: ${theme.motion.easeSpring};`);
  lines.push(`  --duration-instant: ${theme.motion.instant};`);
  lines.push(`  --duration-fast: ${theme.motion.fast};`);
  lines.push(`  --duration-normal: ${theme.motion.normal};`);
  lines.push(`  --duration-slow: ${theme.motion.slow};`);

  lines.push('}');

  // Dark mode
  if (theme.darkMode) {
    lines.push('');
    lines.push('[data-theme="dark"] {');
    lines.push('  --bg-base: var(--color-neutral-12);');
    lines.push('  --bg-subtle: var(--color-neutral-11);');
    lines.push('  --bg-surface: var(--color-neutral-10);');
    lines.push('  --text-primary: var(--color-neutral-1);');
    lines.push('  --text-secondary: var(--color-neutral-2);');
    lines.push('  --text-muted: var(--color-neutral-4);');
    lines.push('  --border-default: var(--color-neutral-7);');
    lines.push('  --border-subtle: var(--color-neutral-8);');
    lines.push('  --interactive: var(--color-primary-7);');
    lines.push('  --interactive-hover: var(--color-primary-6);');
    lines.push('}');
  }

  return lines.join('\n');
}

export { type ThemeConfig };
