// Export Lumina Computer slide blocks to a real .pptx file using pptxgenjs.
import PptxGenJS from "pptxgenjs";
import type { LcBlock } from "./api";

type SlideJson = {
  title?: string;
  bullets?: string[];
  speaker_notes?: string;
};

const BG = "0A0C15";
const SURFACE = "111827";
const ACCENT = "2DD4BF";     // teal-400
const ACCENT2 = "6366F1";    // indigo-500
const TEXT = "F8FAFC";
const MUTED = "94A3B8";

export async function exportSlidesToPptx(projectTitle: string, blocks: LcBlock[]) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.title = projectTitle;
  pptx.company = "Lumina Computer";

  // Title slide
  const cover = pptx.addSlide();
  cover.background = { color: BG };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: ACCENT },
  });
  cover.addText(projectTitle, {
    x: 0.7, y: 2.6, w: 12, h: 1.6,
    fontSize: 44, bold: true, color: TEXT, fontFace: "Inter",
  });
  cover.addText("Generated with Lumina Computer", {
    x: 0.7, y: 4.3, w: 12, h: 0.5,
    fontSize: 16, color: MUTED, fontFace: "Inter",
  });
  cover.addText(new Date().toLocaleDateString(), {
    x: 0.7, y: 6.6, w: 12, h: 0.4,
    fontSize: 12, color: MUTED, fontFace: "Inter",
  });

  const slides = blocks.filter((b) => b.block_type === "slide" && b.content_json);

  for (const [idx, block] of slides.entries()) {
    const data = (block.content_json ?? {}) as SlideJson;
    const s = pptx.addSlide();
    s.background = { color: BG };

    // Accent side bar
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.18, h: 7.5,
      fill: { color: idx % 2 === 0 ? ACCENT : ACCENT2 },
    });

    // Header/eyebrow
    s.addText(`SLIDE ${idx + 1} / ${slides.length}`, {
      x: 0.7, y: 0.45, w: 6, h: 0.35,
      fontSize: 11, color: MUTED, fontFace: "Inter",
      charSpacing: 4, bold: true,
    });

    // Title
    s.addText(data.title ?? block.title ?? `Slide ${idx + 1}`, {
      x: 0.7, y: 0.9, w: 12, h: 1.1,
      fontSize: 34, bold: true, color: TEXT, fontFace: "Inter",
    });

    // Divider
    s.addShape(pptx.ShapeType.rect, {
      x: 0.7, y: 2.05, w: 1.2, h: 0.06,
      fill: { color: ACCENT },
    });

    // Bullets
    const bullets = (data.bullets ?? []).filter(Boolean).slice(0, 6);
    if (bullets.length) {
      s.addText(
        bullets.map((b) => ({ text: b, options: { bullet: { code: "25AA" } } })),
        {
          x: 0.9, y: 2.4, w: 11.5, h: 4.6,
          fontSize: 20, color: TEXT, fontFace: "Inter",
          lineSpacingMultiple: 1.35, paraSpaceAfter: 8,
          valign: "top",
        }
      );
    } else {
      s.addText("(no content generated)", {
        x: 0.9, y: 2.4, w: 11.5, h: 4.6,
        fontSize: 18, color: MUTED, italic: true, fontFace: "Inter",
      });
    }

    // Speaker notes → PPTX notes pane
    if (data.speaker_notes) {
      s.addNotes(data.speaker_notes);
    }

    // Footer
    s.addText("Lumina Computer", {
      x: 0.7, y: 7.05, w: 6, h: 0.3,
      fontSize: 10, color: MUTED, fontFace: "Inter",
    });
    s.addText(`${idx + 1}`, {
      x: 12.3, y: 7.05, w: 0.5, h: 0.3,
      fontSize: 10, color: MUTED, fontFace: "Inter", align: "right",
    });

    // Model attribution chip
    if (block.model_used) {
      s.addText(block.model_used, {
        x: 8, y: 0.45, w: 4.6, h: 0.3,
        fontSize: 9, color: ACCENT, fontFace: "Inter",
        align: "right", italic: true,
      });
    }
  }

  const safe = projectTitle.replace(/[^\w\-. ]+/g, "").slice(0, 60) || "slides";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
