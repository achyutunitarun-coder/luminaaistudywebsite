import PptxGenJS from "pptxgenjs";
import type { LcBlock } from "./api";

interface SlideTheme {
  name: string;
  bg: string;
  bgAlt: string;
  surface: string;
  border: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMute: string;
  textDim: string;
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  coverBg: string;
  dramaticBg: string;
  isDark: boolean;
}

const SLIDE_THEMES: SlideTheme[] = [
  {
    name: "Deep Vault",
    bg: "0A0A0D", bgAlt: "0F0F13", surface: "12101A", border: "27272A",
    accent: "9D5CFF", accentSoft: "C39AFF",
    text: "F5F5F4", textMute: "A1A1AA", textDim: "71717A",
    displayFont: "Georgia", bodyFont: "Calibri", monoFont: "Consolas",
    coverBg: "0D0A14", dramaticBg: "0D0A14", isDark: true,
  },
  {
    name: "Light Board",
    bg: "FAFAF8", bgAlt: "F0F0ED", surface: "FFFFFF", border: "E4E4E0",
    accent: "6D28D9", accentSoft: "8B5CF6",
    text: "1A1A1A", textMute: "525252", textDim: "878787",
    displayFont: "Georgia", bodyFont: "Calibri", monoFont: "Consolas",
    coverBg: "F5F3FF", dramaticBg: "F0ECFF", isDark: false,
  },
  {
    name: "Ocean",
    bg: "08101A", bgAlt: "0C1622", surface: "0E1A2A", border: "1E2D42",
    accent: "38BDF8", accentSoft: "7DD3FC",
    text: "F0F9FF", textMute: "94A3B8", textDim: "64748B",
    displayFont: "Georgia", bodyFont: "Calibri", monoFont: "Consolas",
    coverBg: "06101E", dramaticBg: "040D1A", isDark: true,
  },
  {
    name: "Warm Earth",
    bg: "100E0C", bgAlt: "161412", surface: "1A1715", border: "2D2824",
    accent: "D97706", accentSoft: "F59E0B",
    text: "FDF5E6", textMute: "A8A29E", textDim: "78716C",
    displayFont: "Georgia", bodyFont: "Calibri", monoFont: "Consolas",
    coverBg: "0F0C09", dramaticBg: "0D0A07", isDark: true,
  },
  {
    name: "Forest",
    bg: "0A0F0A", bgAlt: "0E140E", surface: "121A12", border: "1F2A1F",
    accent: "4ADE80", accentSoft: "86EFAC",
    text: "F0FDF4", textMute: "A3BFA3", textDim: "6F8F6F",
    displayFont: "Georgia", bodyFont: "Calibri", monoFont: "Consolas",
    coverBg: "080D08", dramaticBg: "060B06", isDark: true,
  },
];

const W = 13.33;
const H = 7.5;

type Slide = any;

function pickTheme(seed?: string): SlideTheme {
  if (!seed) return SLIDE_THEMES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash) + seed.charCodeAt(i); hash |= 0; }
  return SLIDE_THEMES[Math.abs(hash) % SLIDE_THEMES.length];
}

function pickThemeForBlock(theme: SlideTheme, blockIdx: number): SlideTheme {
  if (blockIdx % 3 === 1 && theme !== SLIDE_THEMES[0]) {
    return SLIDE_THEMES[0];
  }
  return theme;
}

export async function exportSlidesToPptx(projectTitle: string, blocks: LcBlock[], themeSeed?: string) {
  const baseTheme = pickTheme(themeSeed ?? projectTitle);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = projectTitle;
  pptx.company = "Lumina Computer";

  const slides = blocks.filter((b) => b.block_type === "slide" && b.content_json);

  let theme = baseTheme;
  addCoverSlide(pptx, projectTitle, theme);

  slides.forEach((block, idx) => {
    theme = blocks.length > 3 ? pickThemeForBlock(baseTheme, idx) : baseTheme;
    const c = block.content_json as any;
    const layout = c?.layout ?? inferLayout(c);
    const s = pptx.addSlide();
    paintBackground(s, layout === "cover" || layout === "section_divider", theme);

    addBrandMark(s, theme);
    addSlideIndex(s, idx + 1, slides.length, theme);

    if (c.eyebrow && layout !== "section_divider") {
      s.addText(String(c.eyebrow).toUpperCase(), {
        x: 0.7, y: 0.9, w: 12, h: 0.35,
        fontSize: 10, color: theme.accent, fontFace: theme.monoFont,
        charSpacing: 5, bold: true,
      });
    }

    switch (layout) {
      case "cover":            renderCover(s, c, theme); break;
      case "section_divider":  renderSectionDivider(s, c, theme); break;
      case "agenda":           renderAgenda(s, c, theme); break;
      case "kpi_grid":         renderKpiGrid(s, c, theme); break;
      case "comparison":       renderComparison(s, c, theme); break;
      case "timeline":         renderTimeline(s, c, theme); break;
      case "closing":          renderClosing(s, c, theme); break;
      case "stat":             renderStat(s, c, theme); break;
      case "quote":            renderQuote(s, c, theme); break;
      case "two_column":       renderTwoColumn(s, c, theme); break;
      case "bullets":          renderBullets(s, c, theme); break;
      case "image_split":      renderStatement(s, c, theme); break;
      default:                 renderStatement(s, c, theme); break;
    }

    if (c.footnote) {
      s.addText(String(c.footnote), {
        x: 0.7, y: 7.05, w: 12, h: 0.3,
        fontSize: 9, color: theme.textDim, fontFace: theme.monoFont,
        charSpacing: 3,
      });
    }
    if (c.speaker_notes) s.addNotes(String(c.speaker_notes));

    if (block.model_used) {
      s.addText(block.model_used, {
        x: W - 4.5, y: 7.15, w: 4.2, h: 0.25,
        fontSize: 8, color: theme.textDim, fontFace: theme.monoFont,
        align: "right", italic: true,
      });
    }
  });

  const safe = projectTitle.replace(/[^\w\-. ]+/g, "").slice(0, 60) || "slides";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}

function inferLayout(c: any): string {
  if (!c) return "statement";
  if (c.kpis?.length) return "kpi_grid";
  if (c.comparison) return "comparison";
  if (c.timeline?.length) return "timeline";
  if (c.agenda?.length) return "agenda";
  if (c.closing) return "closing";
  if (c.stat) return "stat";
  if (c.quote) return "quote";
  if (c.columns) return "two_column";
  if (c.bullets?.length) return "bullets";
  return "statement";
}

function paintBackground(s: Slide, dramatic: boolean, theme: SlideTheme) {
  s.background = { color: dramatic ? theme.dramaticBg : theme.bg };
  s.addShape("rect" as any, {
    x: 0.2, y: 0.2, w: W - 0.4, h: H - 0.4,
    line: { color: theme.isDark ? "1a1a20" : "e0e0e0", width: 0.5 }, fill: { type: "none" as any },
  });
}

function addBrandMark(s: Slide, theme: SlideTheme) {
  s.addShape("ellipse" as any, {
    x: 0.7, y: 0.5, w: 0.13, h: 0.13,
    fill: { color: theme.accent }, line: { color: theme.accent, width: 0 },
  });
  s.addText("LUMINA", {
    x: 0.9, y: 0.47, w: 3, h: 0.25,
    fontSize: 9, color: theme.textDim, fontFace: theme.monoFont,
    charSpacing: 6, bold: true,
  });
}

function addSlideIndex(s: Slide, i: number, total: number, theme: SlideTheme) {
  s.addText(`${String(i).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: W - 2.2, y: 0.5, w: 1.5, h: 0.25,
    fontSize: 9, color: theme.textDim, fontFace: theme.monoFont,
    align: "right", charSpacing: 4,
  });
}

function addAccentRule(s: Slide, x: number, y: number, theme: SlideTheme, w = 1.2) {
  s.addShape("rect" as any, {
    x, y, w, h: 0.04,
    fill: { color: theme.accent }, line: { color: theme.accent, width: 0 },
  });
}

function renderCover(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 2.6, w: 11, h: 2.4,
    fontSize: 60, bold: false, color: theme.text, fontFace: theme.displayFont,
    charSpacing: -2,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 5.2, w: 10, h: 1,
      fontSize: 18, color: theme.textMute, fontFace: theme.bodyFont,
    });
  }
  addAccentRule(s, 0.7, 6.5, theme, 1.6);
}

function renderSectionDivider(s: Slide, c: any, theme: SlideTheme) {
  if (c.eyebrow) {
    s.addText(String(c.eyebrow), {
      x: 0.7, y: 2.1, w: 6, h: 1.4,
      fontSize: 72, color: theme.accent, fontFace: theme.displayFont, transparency: 40,
    });
  }
  s.addText(c.title ?? "", {
    x: 0.7, y: 3.4, w: 11, h: 2.6,
    fontSize: 52, color: theme.text, fontFace: theme.displayFont,
    charSpacing: -1,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 5.9, w: 10, h: 0.8,
      fontSize: 16, color: theme.textDim, fontFace: theme.bodyFont,
    });
  }
}

function renderAgenda(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "Agenda", {
    x: 0.7, y: 1.4, w: 11, h: 1.2,
    fontSize: 40, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  const items = (c.agenda ?? []).slice(0, 8);
  const half = Math.ceil(items.length / 2);
  items.forEach((a: any, i: number) => {
    const col = i < half ? 0 : 1;
    const row = i % half;
    const x = 0.7 + col * 6.2;
    const y = 3.2 + row * 0.75;
    s.addShape("rect" as any, {
      x, y: y - 0.08, w: 5.5, h: 0.02,
      fill: { color: theme.border }, line: { color: theme.border, width: 0 },
    });
    s.addText(a.n ?? String(i + 1).padStart(2, "0"), {
      x, y, w: 0.6, h: 0.5, fontSize: 11, color: theme.accent, fontFace: theme.monoFont, bold: true,
    });
    s.addText(a.title ?? "", {
      x: x + 0.7, y, w: 4.7, h: 0.35,
      fontSize: 17, color: theme.text, fontFace: theme.displayFont,
    });
    if (a.note) {
      s.addText(a.note, {
        x: x + 0.7, y: y + 0.3, w: 4.7, h: 0.3,
        fontSize: 11, color: theme.textDim, fontFace: theme.bodyFont,
      });
    }
  });
}

function renderKpiGrid(s: Slide, c: any, theme: SlideTheme) {
  if (c.title) {
    s.addText(c.title, {
      x: 0.7, y: 1.4, w: 11, h: 1.1,
      fontSize: 34, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
    });
  }
  const kpis = (c.kpis ?? []).slice(0, 4);
  const cols = kpis.length >= 4 ? 4 : Math.max(kpis.length, 1);
  const gap = 0.25;
  const totalW = 12;
  const cardW = (totalW - gap * (cols - 1)) / cols;
  const startX = (W - totalW) / 2;
  kpis.forEach((k: any, i: number) => {
    const x = startX + i * (cardW + gap);
    const y = 3.2;
    s.addShape("rect" as any, {
      x, y, w: cardW, h: 0.03,
      fill: { color: theme.border }, line: { color: theme.border, width: 0 },
    });
    s.addText(k.value ?? "", {
      x, y: y + 0.2, w: cardW, h: 1.4,
      fontSize: 48, color: theme.text, fontFace: theme.displayFont, charSpacing: -2,
    });
    s.addText(k.label ?? "", {
      x, y: y + 1.7, w: cardW, h: 0.8,
      fontSize: 12, color: theme.textMute, fontFace: theme.bodyFont,
    });
    if (k.delta) {
      s.addText(String(k.delta).toUpperCase(), {
        x, y: y + 2.5, w: cardW, h: 0.3,
        fontSize: 9, color: theme.accent, fontFace: theme.monoFont, charSpacing: 4, bold: true,
      });
    }
  });
}

function renderComparison(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.1,
    fontSize: 36, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  const cmp = c.comparison ?? {};
  (["left", "right"] as const).forEach((side, i) => {
    const col = cmp[side]; if (!col) return;
    const accent = i === 1;
    const x = 0.7 + i * 6.2;
    const y = 3.1;
    s.addShape("rect" as any, {
      x, y, w: 5.9, h: 3.6,
      fill: { color: accent ? theme.surface : (theme.isDark ? "0C0C10" : "F5F5F0") },
      line: { color: accent ? theme.accent : theme.border, width: accent ? 1 : 0.5 },
    });
    s.addText(`${accent ? "After" : "Before"} · ${col.heading ?? ""}`.toUpperCase(), {
      x: x + 0.3, y: y + 0.25, w: 5.3, h: 0.3,
      fontSize: 9, color: accent ? theme.accent : theme.textDim, fontFace: theme.monoFont, charSpacing: 4, bold: true,
    });
    const points = (col.points ?? []).slice(0, 5);
    s.addText(
      points.map((p: string) => ({ text: p, options: { bullet: { code: "25AA" }, breakLine: true } })),
      {
        x: x + 0.3, y: y + 0.75, w: 5.3, h: 2.7,
        fontSize: 13, color: theme.text, fontFace: theme.bodyFont,
        paraSpaceAfter: 6, valign: "top",
      }
    );
  });
}

function renderTimeline(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.1,
    fontSize: 36, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  const items = (c.timeline ?? []).slice(0, 6);
  const n = items.length || 1;
  const trackY = 3.9;
  s.addShape("rect" as any, {
    x: 0.7, y: trackY, w: 11.9, h: 0.02,
    fill: { color: theme.border }, line: { color: theme.border, width: 0 },
  });
  const colW = 11.9 / n;
  items.forEach((t: any, i: number) => {
    const x = 0.7 + i * colW;
    s.addShape("ellipse" as any, {
      x: x + 0.02, y: trackY - 0.06, w: 0.14, h: 0.14,
      fill: { color: theme.accent }, line: { color: theme.accent, width: 0 },
    });
    s.addText(String(t.when ?? "").toUpperCase(), {
      x, y: trackY + 0.25, w: colW - 0.3, h: 0.3,
      fontSize: 10, color: theme.textDim, fontFace: theme.monoFont, charSpacing: 3, bold: true,
    });
    s.addText(t.what ?? "", {
      x, y: trackY + 0.6, w: colW - 0.3, h: 1.8,
      fontSize: 13, color: theme.text, fontFace: theme.bodyFont, valign: "top",
    });
  });
}

function renderClosing(s: Slide, c: any, theme: SlideTheme) {
  s.addText("CLOSING", {
    x: 0.7, y: 2.1, w: 4, h: 0.35,
    fontSize: 10, color: theme.accent, fontFace: theme.monoFont, charSpacing: 5, bold: true,
  });
  s.addText(c.closing?.message ?? c.title ?? "", {
    x: 0.7, y: 2.7, w: 11, h: 3,
    fontSize: 54, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  if (c.closing?.cta) {
    s.addShape("roundRect" as any, {
      x: 0.7, y: 5.9, w: 4.5, h: 0.6,
      fill: { type: "none" as any }, line: { color: theme.border, width: 0.75 },
      rectRadius: 0.3,
    });
    s.addShape("ellipse" as any, {
      x: 0.95, y: 6.13, w: 0.14, h: 0.14,
      fill: { color: theme.accent }, line: { color: theme.accent, width: 0 },
    });
    s.addText(c.closing.cta, {
      x: 1.2, y: 5.98, w: 4, h: 0.45,
      fontSize: 14, color: theme.text, fontFace: theme.bodyFont, valign: "middle",
    });
  }
}

function renderStat(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.stat?.value ?? "", {
    x: 0.7, y: 2.2, w: 12, h: 3,
    fontSize: 140, color: theme.text, fontFace: theme.displayFont, charSpacing: -6,
  });
  s.addText(c.stat?.label ?? "", {
    x: 0.7, y: 5.2, w: 10, h: 1,
    fontSize: 18, color: theme.textMute, fontFace: theme.bodyFont,
  });
  if (c.stat?.source) {
    s.addText(`Source · ${c.stat.source}`.toUpperCase(), {
      x: 0.7, y: 6.2, w: 10, h: 0.3,
      fontSize: 9, color: theme.textDim, fontFace: theme.monoFont, charSpacing: 3,
    });
  }
}

function renderQuote(s: Slide, c: any, theme: SlideTheme) {
  s.addText(`\u201C${c.quote?.text ?? ""}\u201D`, {
    x: 0.9, y: 2.4, w: 11.5, h: 3.2,
    fontSize: 40, italic: true, color: theme.text, fontFace: theme.displayFont,
    charSpacing: -1,
  });
  addAccentRule(s, 0.9, 5.9, theme, 0.5);
  s.addText(`— ${c.quote?.attribution ?? ""}`.toUpperCase(), {
    x: 0.9, y: 6.05, w: 11, h: 0.35,
    fontSize: 10, color: theme.textDim, fontFace: theme.monoFont, charSpacing: 4,
  });
}

function renderTwoColumn(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.4,
    fontSize: 40, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  const cols = (c.columns ?? []).slice(0, 2);
  cols.forEach((col: any, i: number) => {
    const x = 0.7 + i * 6.2;
    s.addShape("rect" as any, {
      x, y: 3.3, w: 0.02, h: 2.8,
      fill: { color: theme.border }, line: { color: theme.border, width: 0 },
    });
    s.addText(col.heading ?? "", {
      x: x + 0.2, y: 3.3, w: 5.7, h: 0.5,
      fontSize: 20, color: theme.text, fontFace: theme.displayFont, bold: false,
    });
    s.addText(col.body ?? "", {
      x: x + 0.2, y: 3.85, w: 5.7, h: 2.3,
      fontSize: 14, color: theme.textMute, fontFace: theme.bodyFont, valign: "top",
    });
  });
}

function renderBullets(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11.5, h: 1.4,
    fontSize: 40, color: theme.text, fontFace: theme.displayFont, charSpacing: -1,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 2.55, w: 10.5, h: 0.6,
      fontSize: 14, color: theme.textMute, fontFace: theme.bodyFont,
    });
  }
  const bullets = (c.bullets ?? []).slice(0, 6);
  bullets.forEach((b: string, i: number) => {
    const y = 3.3 + i * 0.55;
    s.addText(String(i + 1).padStart(2, "0"), {
      x: 0.7, y: y + 0.05, w: 0.5, h: 0.35,
      fontSize: 10, color: theme.accent, fontFace: theme.monoFont, bold: true,
    });
    s.addText(b, {
      x: 1.3, y, w: 11, h: 0.5,
      fontSize: 17, color: theme.text, fontFace: theme.bodyFont, valign: "middle",
    });
  });
}

function renderStatement(s: Slide, c: any, theme: SlideTheme) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 2.3, w: 12, h: 3.6,
    fontSize: 62, color: theme.text, fontFace: theme.displayFont, charSpacing: -2,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 6, w: 11, h: 0.8,
      fontSize: 17, color: theme.textMute, fontFace: theme.bodyFont,
    });
  }
}

function addCoverSlide(pptx: PptxGenJS, title: string, theme: SlideTheme) {
  const s = pptx.addSlide();
  s.background = { color: theme.coverBg };
  s.addShape("rect" as any, {
    x: 0.2, y: 0.2, w: W - 0.4, h: H - 0.4,
    line: { color: theme.isDark ? "1a1a20" : "d0d0d0", width: 0.5 }, fill: { type: "none" as any },
  });
  addBrandMark(s, theme);
  s.addText("DECK", {
    x: W - 2.2, y: 0.5, w: 1.5, h: 0.25,
    fontSize: 9, color: theme.textDim, fontFace: theme.monoFont,
    align: "right", charSpacing: 4,
  });
  s.addText(title, {
    x: 0.7, y: 2.6, w: 11, h: 2.6,
    fontSize: 62, color: theme.text, fontFace: theme.displayFont, charSpacing: -2,
  });
  s.addText(`Generated with Lumina Computer · ${theme.name}`, {
    x: 0.7, y: 5.4, w: 10, h: 0.5,
    fontSize: 15, color: theme.textMute, fontFace: theme.bodyFont,
  });
  addAccentRule(s, 0.7, 6.4, theme, 1.8);
  s.addText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }).toUpperCase(), {
    x: 0.7, y: 6.6, w: 6, h: 0.3,
    fontSize: 10, color: theme.textDim, fontFace: theme.monoFont, charSpacing: 4,
  });
}
