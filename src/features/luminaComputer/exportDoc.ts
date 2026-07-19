// Lumina Computer — DOCX export using docx-js (per DOCX skill spec)
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak, Table, TableRow, TableCell, WidthType, BorderStyle,
  Header, Footer, PageNumber, TabStopPosition, TabStopType,
  ShadingType, convertInchesToTwip,
} from "docx";
import type { LcBlock } from "./api";

const FONT_BODY = "Calibri";
const FONT_DISPLAY = "Georgia";
const FONT_MONO = "Courier New";

function mdToDocx(md: string): (Paragraph | Table)[] {
  const src = md.replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");
  const result: (Paragraph | Table)[] = [];
  let i = 0;

  const inline = (t: string): (TextRun | string)[] => {
    const runs: (TextRun | string)[] = [];
    let remaining = t;
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(remaining)) !== null) {
      if (match.index > last) runs.push(remaining.slice(last, match.index));
      if (match[1]?.startsWith("**")) {
        runs.push(new TextRun({ text: match[2], bold: true }));
      } else if (match[1]?.startsWith("*")) {
        runs.push(new TextRun({ text: match[3], italics: true }));
      } else if (match[1]?.startsWith("`")) {
        runs.push(new TextRun({ text: match[4], font: FONT_MONO, size: 20 }));
      } else if (match[1]?.startsWith("[")) {
        runs.push(new TextRun({ text: match[5], style: "Hyperlink" }));
      }
      last = re.lastIndex;
    }
    if (last < remaining.length) runs.push(remaining.slice(last));
    return runs;
  };

  const buildParagraph = (text: string, heading?: HeadingLevel): Paragraph => {
    const runs = inline(text);
    const children = runs.map((r) => r instanceof TextRun ? r : new TextRun({ text: r as string }));
    return new Paragraph({
      ...(heading ? { heading } : {}),
      children,
      spacing: { after: heading ? 200 : 120 },
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^##\s+/.test(line)) {
      result.push(buildParagraph(line.replace(/^##\s+/, ""), HeadingLevel.HEADING_2));
      i++; continue;
    }
    if (/^###\s+/.test(line)) {
      result.push(buildParagraph(line.replace(/^###\s+/, ""), HeadingLevel.HEADING_3));
      i++; continue;
    }
    if (/^---+\s*$/.test(line)) {
      result.push(new Paragraph({
        children: [], spacing: { before: 200, after: 200 },
        thematicBreak: true,
      }));
      i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      result.push(new Paragraph({
        children: [new TextRun({ text: buf.join(" "), italics: true, size: 24 })],
        indent: { left: convertInchesToTwip(0.5) },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      for (const item of buf) {
        result.push(new Paragraph({
          children: [new TextRun({ text: item })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }));
      }
      continue;
    }
    const buf: string[] = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?|[-*]\s+|---+\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    result.push(buildParagraph(buf.join(" ")));
  }
  return result;
}

export async function exportDocToDocx(title: string, blocks: LcBlock[], themeSeed?: string) {
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const docSections = blocks
    .filter((b) => b.block_type === "doc_section" && b.content_json?.markdown)
    .map((b) => mdToDocx(String(b.content_json.markdown ?? "")))
    .flat();

  const sections = [
    {
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1.25) },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: title, font: FONT_BODY, size: 18, color: "999999" })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [new TextRun({ text: "Page ", size: 18 }), PageNumber.CURRENT],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: [
        new Paragraph({ spacing: { before: 2000 } }),
        new Paragraph({ children: [new TextRun({ text: title, font: FONT_DISPLAY, size: 52, bold: true })], spacing: { after: 120 } }),
        new Paragraph({
          children: [],
          spacing: { before: 60, after: 300 },
          border: { bottom: { color: "C49B3F", size: 6, space: 1 } },
        }),
        new Paragraph({ children: [new TextRun({ text: today, font: FONT_BODY, size: 22, color: "666666" })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `${blocks.length} sections`, font: FONT_BODY, size: 20, color: "999999" })], spacing: { after: 600 } }),
        new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 200 } }),
        ...docSections,
        new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 600 } }),
        new Paragraph({
          children: [new TextRun({ text: "End of document", font: FONT_BODY, size: 18, color: "999999", italics: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ];

  const doc = new Document({
    title,
    creator: "Lumina Computer",
    styles: {
      default: {
        document: {
          run: { font: FONT_BODY, size: 22 },
        },
      },
    },
    sections,
  });

  const blob = await Packer.toBlob(doc);
  const safe = title.replace(/[^\w\-. ]+/g, "").slice(0, 60) || "document";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
