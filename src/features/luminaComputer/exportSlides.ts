// Export Lumina Computer slide blocks to a real .pptx with per-layout rendering.
// Mirrors the on-screen SlideCanvas (Deep Vault palette + Fraunces/Inter/JetBrains Mono).
import PptxGenJS from "pptxgenjs";
import type { LcBlock } from "./api";

const BG        = "0A0A0D";
const BG_ALT    = "0F0F13";
const SURFACE   = "12101A";
const BORDER    = "27272A";
const ACCENT    = "9D5CFF";
const ACCENT_SOFT = "C39AFF";
const TEXT      = "F5F5F4";
const TEXT_MUTE = "A1A1AA";
const TEXT_DIM  = "71717A";

// Slide is 13.33" x 7.5" (LAYOUT_WIDE)
const W = 13.33;
const H = 7.5;

const FONT_DISPLAY = "Georgia";          // Fraunces stand-in — most systems render it
const FONT_BODY    = "Calibri";          // Inter stand-in
const FONT_MONO    = "Consolas";

type Slide = any;

export async function exportSlidesToPptx(projectTitle: string, blocks: LcBlock[]) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = projectTitle;
  pptx.company = "Lumina Computer";

  const slides = blocks.filter((b) => b.block_type === "slide" && b.content_json);

  // Cover
  addCoverSlide(pptx, projectTitle);

  slides.forEach((block, idx) => {
    const c = block.content_json as any;
    const layout = c?.layout ?? inferLayout(c);
    const s = pptx.addSlide();
    paintBackground(s, layout === "cover" || layout === "section_divider");

    // Header brand + slide index
    addBrandMark(s);
    addSlideIndex(s, idx + 1, slides.length);

    // Eyebrow
    if (c.eyebrow && layout !== "section_divider") {
      s.addText(String(c.eyebrow).toUpperCase(), {
        x: 0.7, y: 0.9, w: 12, h: 0.35,
        fontSize: 10, color: ACCENT, fontFace: FONT_MONO,
        charSpacing: 5, bold: true,
      });
    }

    switch (layout) {
      case "cover":            renderCover(s, c); break;
      case "section_divider":  renderSectionDivider(s, c); break;
      case "agenda":           renderAgenda(s, c); break;
      case "kpi_grid":         renderKpiGrid(s, c); break;
      case "comparison":       renderComparison(s, c); break;
      case "timeline":         renderTimeline(s, c); break;
      case "closing":          renderClosing(s, c); break;
      case "stat":             renderStat(s, c); break;
      case "quote":            renderQuote(s, c); break;
      case "two_column":       renderTwoColumn(s, c); break;
      case "bullets":          renderBullets(s, c); break;
      default:                 renderStatement(s, c); break;
    }

    // Footnote / speaker notes
    if (c.footnote) {
      s.addText(String(c.footnote), {
        x: 0.7, y: 7.05, w: 12, h: 0.3,
        fontSize: 9, color: TEXT_DIM, fontFace: FONT_MONO,
        charSpacing: 3,
      });
    }
    if (c.speaker_notes) s.addNotes(String(c.speaker_notes));

    // Model attribution (tiny)
    if (block.model_used) {
      s.addText(block.model_used, {
        x: W - 4.5, y: 7.15, w: 4.2, h: 0.25,
        fontSize: 8, color: TEXT_DIM, fontFace: FONT_MONO,
        align: "right", italic: true,
      });
    }
  });

  const safe = projectTitle.replace(/[^\w\-. ]+/g, "").slice(0, 60) || "slides";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}

// ─── helpers ─────────────────────────────────────────────────────────────

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

function paintBackground(s: Slide, dramatic: boolean) {
  s.background = { color: dramatic ? "0D0A14" : BG };
  // subtle inner frame
  s.addShape("rect" as any, {
    x: 0.2, y: 0.2, w: W - 0.4, h: H - 0.4,
    line: { color: "1a1a20", width: 0.5 }, fill: { type: "none" as any },
  });
}

function addBrandMark(s: Slide) {
  s.addShape("ellipse" as any, {
    x: 0.7, y: 0.5, w: 0.13, h: 0.13,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });
  s.addText("LUMINA", {
    x: 0.9, y: 0.47, w: 3, h: 0.25,
    fontSize: 9, color: TEXT_DIM, fontFace: FONT_MONO,
    charSpacing: 6, bold: true,
  });
}

function addSlideIndex(s: Slide, i: number, total: number) {
  s.addText(`${String(i).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: W - 2.2, y: 0.5, w: 1.5, h: 0.25,
    fontSize: 9, color: TEXT_DIM, fontFace: FONT_MONO,
    align: "right", charSpacing: 4,
  });
}

function addAccentRule(s: Slide, x: number, y: number, w = 1.2) {
  s.addShape("rect" as any, {
    x, y, w, h: 0.04,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });
}

// ─── renderers ───────────────────────────────────────────────────────────

function renderCover(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 2.6, w: 11, h: 2.4,
    fontSize: 60, bold: false, color: TEXT, fontFace: FONT_DISPLAY,
    charSpacing: -2,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 5.2, w: 10, h: 1,
      fontSize: 18, color: TEXT_MUTE, fontFace: FONT_BODY,
    });
  }
  addAccentRule(s, 0.7, 6.5, 1.6);
}

function renderSectionDivider(s: Slide, c: any) {
  if (c.eyebrow) {
    s.addText(String(c.eyebrow), {
      x: 0.7, y: 2.1, w: 6, h: 1.4,
      fontSize: 72, color: ACCENT, fontFace: FONT_DISPLAY, transparency: 40,
    });
  }
  s.addText(c.title ?? "", {
    x: 0.7, y: 3.4, w: 11, h: 2.6,
    fontSize: 52, color: TEXT, fontFace: FONT_DISPLAY,
    charSpacing: -1,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 5.9, w: 10, h: 0.8,
      fontSize: 16, color: TEXT_DIM, fontFace: FONT_BODY,
    });
  }
}

function renderAgenda(s: Slide, c: any) {
  s.addText(c.title ?? "Agenda", {
    x: 0.7, y: 1.4, w: 11, h: 1.2,
    fontSize: 40, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  const items = (c.agenda ?? []).slice(0, 8);
  const half = Math.ceil(items.length / 2);
  items.forEach((a: any, i: number) => {
    const col = i < half ? 0 : 1;
    const row = i % half;
    const x = 0.7 + col * 6.2;
    const y = 3.2 + row * 0.75;
    // divider rule
    s.addShape("rect" as any, {
      x, y: y - 0.08, w: 5.5, h: 0.02,
      fill: { color: BORDER }, line: { color: BORDER, width: 0 },
    });
    s.addText(a.n ?? String(i + 1).padStart(2, "0"), {
      x, y, w: 0.6, h: 0.5, fontSize: 11, color: ACCENT, fontFace: FONT_MONO, bold: true,
    });
    s.addText(a.title ?? "", {
      x: x + 0.7, y, w: 4.7, h: 0.35,
      fontSize: 17, color: TEXT, fontFace: FONT_DISPLAY,
    });
    if (a.note) {
      s.addText(a.note, {
        x: x + 0.7, y: y + 0.3, w: 4.7, h: 0.3,
        fontSize: 11, color: TEXT_DIM, fontFace: FONT_BODY,
      });
    }
  });
}

function renderKpiGrid(s: Slide, c: any) {
  if (c.title) {
    s.addText(c.title, {
      x: 0.7, y: 1.4, w: 11, h: 1.1,
      fontSize: 34, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
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
    // top rule
    s.addShape("rect" as any, {
      x, y, w: cardW, h: 0.03,
      fill: { color: BORDER }, line: { color: BORDER, width: 0 },
    });
    s.addText(k.value ?? "", {
      x, y: y + 0.2, w: cardW, h: 1.4,
      fontSize: 48, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -2,
    });
    s.addText(k.label ?? "", {
      x, y: y + 1.7, w: cardW, h: 0.8,
      fontSize: 12, color: TEXT_MUTE, fontFace: FONT_BODY,
    });
    if (k.delta) {
      s.addText(String(k.delta).toUpperCase(), {
        x, y: y + 2.5, w: cardW, h: 0.3,
        fontSize: 9, color: ACCENT, fontFace: FONT_MONO, charSpacing: 4, bold: true,
      });
    }
  });
}

function renderComparison(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.1,
    fontSize: 36, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  const cmp = c.comparison ?? {};
  (["left", "right"] as const).forEach((side, i) => {
    const col = cmp[side]; if (!col) return;
    const accent = i === 1;
    const x = 0.7 + i * 6.2;
    const y = 3.1;
    s.addShape("rect" as any, {
      x, y, w: 5.9, h: 3.6,
      fill: { color: accent ? SURFACE : "0C0C10" },
      line: { color: accent ? ACCENT : BORDER, width: accent ? 1 : 0.5 },
    });
    s.addText(`${accent ? "After" : "Before"} · ${col.heading ?? ""}`.toUpperCase(), {
      x: x + 0.3, y: y + 0.25, w: 5.3, h: 0.3,
      fontSize: 9, color: accent ? ACCENT : TEXT_DIM, fontFace: FONT_MONO, charSpacing: 4, bold: true,
    });
    const points = (col.points ?? []).slice(0, 5);
    s.addText(
      points.map((p: string) => ({ text: p, options: { bullet: { code: "25AA" }, breakLine: true } })),
      {
        x: x + 0.3, y: y + 0.75, w: 5.3, h: 2.7,
        fontSize: 13, color: TEXT, fontFace: FONT_BODY,
        paraSpaceAfter: 6, valign: "top",
      }
    );
  });
}

function renderTimeline(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.1,
    fontSize: 36, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  const items = (c.timeline ?? []).slice(0, 6);
  const n = items.length || 1;
  const trackY = 3.9;
  s.addShape("rect" as any, {
    x: 0.7, y: trackY, w: 11.9, h: 0.02,
    fill: { color: BORDER }, line: { color: BORDER, width: 0 },
  });
  const colW = 11.9 / n;
  items.forEach((t: any, i: number) => {
    const x = 0.7 + i * colW;
    s.addShape("ellipse" as any, {
      x: x + 0.02, y: trackY - 0.06, w: 0.14, h: 0.14,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText(String(t.when ?? "").toUpperCase(), {
      x, y: trackY + 0.25, w: colW - 0.3, h: 0.3,
      fontSize: 10, color: TEXT_DIM, fontFace: FONT_MONO, charSpacing: 3, bold: true,
    });
    s.addText(t.what ?? "", {
      x, y: trackY + 0.6, w: colW - 0.3, h: 1.8,
      fontSize: 13, color: TEXT, fontFace: FONT_BODY, valign: "top",
    });
  });
}

function renderClosing(s: Slide, c: any) {
  s.addText("CLOSING", {
    x: 0.7, y: 2.1, w: 4, h: 0.35,
    fontSize: 10, color: ACCENT, fontFace: FONT_MONO, charSpacing: 5, bold: true,
  });
  s.addText(c.closing?.message ?? c.title ?? "", {
    x: 0.7, y: 2.7, w: 11, h: 3,
    fontSize: 54, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  if (c.closing?.cta) {
    s.addShape("roundRect" as any, {
      x: 0.7, y: 5.9, w: 4.5, h: 0.6,
      fill: { type: "none" as any }, line: { color: BORDER, width: 0.75 },
      rectRadius: 0.3,
    });
    s.addShape("ellipse" as any, {
      x: 0.95, y: 6.13, w: 0.14, h: 0.14,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText(c.closing.cta, {
      x: 1.2, y: 5.98, w: 4, h: 0.45,
      fontSize: 14, color: TEXT, fontFace: FONT_BODY, valign: "middle",
    });
  }
}

function renderStat(s: Slide, c: any) {
  s.addText(c.stat?.value ?? "", {
    x: 0.7, y: 2.2, w: 12, h: 3,
    fontSize: 140, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -6,
  });
  s.addText(c.stat?.label ?? "", {
    x: 0.7, y: 5.2, w: 10, h: 1,
    fontSize: 18, color: TEXT_MUTE, fontFace: FONT_BODY,
  });
  if (c.stat?.source) {
    s.addText(`Source · ${c.stat.source}`.toUpperCase(), {
      x: 0.7, y: 6.2, w: 10, h: 0.3,
      fontSize: 9, color: TEXT_DIM, fontFace: FONT_MONO, charSpacing: 3,
    });
  }
}

function renderQuote(s: Slide, c: any) {
  s.addText(`\u201C${c.quote?.text ?? ""}\u201D`, {
    x: 0.9, y: 2.4, w: 11.5, h: 3.2,
    fontSize: 40, italic: true, color: TEXT, fontFace: FONT_DISPLAY,
    charSpacing: -1,
  });
  addAccentRule(s, 0.9, 5.9, 0.5);
  s.addText(`— ${c.quote?.attribution ?? ""}`.toUpperCase(), {
    x: 0.9, y: 6.05, w: 11, h: 0.35,
    fontSize: 10, color: TEXT_DIM, fontFace: FONT_MONO, charSpacing: 4,
  });
}

function renderTwoColumn(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11, h: 1.4,
    fontSize: 40, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  const cols = (c.columns ?? []).slice(0, 2);
  cols.forEach((col: any, i: number) => {
    const x = 0.7 + i * 6.2;
    s.addShape("rect" as any, {
      x, y: 3.3, w: 0.02, h: 2.8,
      fill: { color: BORDER }, line: { color: BORDER, width: 0 },
    });
    s.addText(col.heading ?? "", {
      x: x + 0.2, y: 3.3, w: 5.7, h: 0.5,
      fontSize: 20, color: TEXT, fontFace: FONT_DISPLAY, bold: false,
    });
    s.addText(col.body ?? "", {
      x: x + 0.2, y: 3.85, w: 5.7, h: 2.3,
      fontSize: 14, color: TEXT_MUTE, fontFace: FONT_BODY, valign: "top",
    });
  });
}

function renderBullets(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 1.4, w: 11.5, h: 1.4,
    fontSize: 40, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -1,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 2.55, w: 10.5, h: 0.6,
      fontSize: 14, color: TEXT_MUTE, fontFace: FONT_BODY,
    });
  }
  const bullets = (c.bullets ?? []).slice(0, 6);
  bullets.forEach((b: string, i: number) => {
    const y = 3.3 + i * 0.55;
    s.addText(String(i + 1).padStart(2, "0"), {
      x: 0.7, y: y + 0.05, w: 0.5, h: 0.35,
      fontSize: 10, color: ACCENT, fontFace: FONT_MONO, bold: true,
    });
    s.addText(b, {
      x: 1.3, y, w: 11, h: 0.5,
      fontSize: 17, color: TEXT, fontFace: FONT_BODY, valign: "middle",
    });
  });
}

function renderStatement(s: Slide, c: any) {
  s.addText(c.title ?? "", {
    x: 0.7, y: 2.3, w: 12, h: 3.6,
    fontSize: 62, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -2,
  });
  if (c.subtitle) {
    s.addText(c.subtitle, {
      x: 0.7, y: 6, w: 11, h: 0.8,
      fontSize: 17, color: TEXT_MUTE, fontFace: FONT_BODY,
    });
  }
}

function addCoverSlide(pptx: PptxGenJS, title: string) {
  const s = pptx.addSlide();
  s.background = { color: "0D0A14" };
  s.addShape("rect" as any, {
    x: 0.2, y: 0.2, w: W - 0.4, h: H - 0.4,
    line: { color: "1a1a20", width: 0.5 }, fill: { type: "none" as any },
  });
  addBrandMark(s);
  s.addText("DECK", {
    x: W - 2.2, y: 0.5, w: 1.5, h: 0.25,
    fontSize: 9, color: TEXT_DIM, fontFace: FONT_MONO,
    align: "right", charSpacing: 4,
  });
  s.addText(title, {
    x: 0.7, y: 2.6, w: 11, h: 2.6,
    fontSize: 62, color: TEXT, fontFace: FONT_DISPLAY, charSpacing: -2,
  });
  s.addText("Generated with Lumina Computer", {
    x: 0.7, y: 5.4, w: 10, h: 0.5,
    fontSize: 15, color: TEXT_MUTE, fontFace: FONT_BODY,
  });
  addAccentRule(s, 0.7, 6.4, 1.8);
  s.addText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }).toUpperCase(), {
    x: 0.7, y: 6.6, w: 6, h: 0.3,
    fontSize: 10, color: TEXT_DIM, fontFace: FONT_MONO, charSpacing: 4,
  });
}
