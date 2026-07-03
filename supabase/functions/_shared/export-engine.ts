import { designSystem, type ThemeId } from "./shared-intelligence.ts";

export type ExportFormat = "pptx" | "docx" | "xlsx" | "pdf" | "html" | "md" | "csv" | "google_slides" | "google_docs" | "google_sheets";

export interface ExportOptions {
  format: ExportFormat;
  theme?: ThemeId;
  filename?: string;
}

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
  mimeType: string;
}

interface SlideData {
  slide_number: number;
  type: string;
  layout: string;
  background?: { type: string; value: string; overlay_opacity?: number };
  elements: {
    type: "text" | "image" | "chart" | "shape";
    id: string;
    content: string;
    position: { x: number; y: number; width: number; height: number; unit: string };
    style?: Record<string, any>;
  }[];
}

interface SlidesDocument {
  metadata: { title: string; theme: string };
  slides: SlideData[];
  theme: { colors: Record<string, string>; typography: Record<string, string>; spacing: Record<string, number>; effects: Record<string, any> };
}

interface SheetData {
  name: string;
  headers: { column: string; name: string; formula?: string; format?: string; validation?: any }[];
  data: string[][];
  conditional_formatting?: any[];
  charts?: { type: string; title: string; data_range: string }[];
}

interface SheetsWorkbook {
  workbook: { name: string; theme: string };
  sheets: SheetData[];
}

export class ExportEngine {
  exportSlides(data: SlidesDocument, options: ExportOptions): ExportResult {
    switch (options.format) {
      case "pptx": return this.toPptx(data, options);
      case "google_slides": return this.toGoogleSlides(data, options);
      case "pdf": return this.toSlidesPdf(data, options);
      case "html": return this.toSlidesHtml(data, options);
      default: return this.toSlidesMarkdown(data, options);
    }
  }

  exportDocument(markdown: string, options: ExportOptions): ExportResult {
    switch (options.format) {
      case "docx": return this.toDocx(markdown, options);
      case "google_docs": return { format: "google_docs", content: markdown, filename: options.filename ?? "document.md", mimeType: "text/markdown" };
      case "pdf": return this.toDocPdf(markdown, options);
      case "html": return this.toDocHtml(markdown, options);
      default: return { format: "md", content: markdown, filename: `${options.filename ?? "document"}.md`, mimeType: "text/markdown" };
    }
  }

  exportSheet(data: SheetsWorkbook, options: ExportOptions): ExportResult {
    switch (options.format) {
      case "xlsx": return this.toXlsx(data, options);
      case "google_sheets": return { format: "google_sheets", content: JSON.stringify(data), filename: options.filename ?? "sheet.json", mimeType: "application/json" };
      case "csv": return this.toCsv(data, options);
      case "html": return this.toSheetHtml(data, options);
      default: return this.toCsv(data, options);
    }
  }

  private toPptx(data: SlidesDocument, options: ExportOptions): ExportResult {
    const theme = designSystem.getTheme((options.theme ?? data.metadata.theme ?? "dark_modern") as ThemeId);
    const c = theme.colors;
    const slidesXml = data.slides.map((slide, idx) => {
      const bgColor = slide.background?.value ?? c.background;
      const elementsXml = slide.elements.map((el) => {
        const style = el.style ?? {};
        const left = el.position.x;
        const top = el.position.y;
        const width = el.position.width;
        const height = el.position.height;
        const fontSize = style.font_size ?? 18;
        const fontWeight = style.font_weight ?? 400;
        const color = style.color ?? c.text_primary;
        const fontFamily = style.font_family ?? theme.typography.body_font;
        return `<p:sp>
          <p:nvSpPr><p:cNvPr id="${idx * 100 + slide.elements.indexOf(el) + 1}" name="Element ${slide.elements.indexOf(el) + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="${left}" y="${top}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr>
          <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="${fontSize * 100}" b="${fontWeight >= 600 ? 1 : 0}"${fontFamily ? ` latin="${fontFamily}"` : ""}><a:srgbClr val="${color.replace("#", "")}"/></a:rPr><a:t>${this.escapeXml(el.content)}</a:t></a:r></a:p></p:txBody>
        </p:sp>`;
      }).join("\n");
      return `<p:sld>
        <p:cSld><p:bg><a:solidFill><a:srgbClr val="${bgColor.replace("#", "")}"/></a:solidFill></p:bg><p:spTree>
          <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
          <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:grpSpPr>
          ${elementsXml}
        </p:spTree></p:cSld>
        <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
      </p:sld>`;
    }).join("\n");

    const pptxContent = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${data.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
    return { format: "pptx", content: pptxContent, filename: `${options.filename ?? data.metadata.title}.pptx`, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  }

  private toDocx(markdown: string, options: ExportOptions): ExportResult {
    const lines = markdown.split("\n");
    let bodyXml = "";
    let inTable = false;
    for (const line of lines) {
      if (line.startsWith("| ") && line.endsWith(" |")) {
        if (!inTable) { bodyXml += `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>`; inTable = true; }
        const cells = line.split("|").filter(Boolean).map((c) => c.trim().replace(/^[-:\s]+$/, ""));

        if (cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, "")))) continue;
        bodyXml += `<w:tr>${cells.map((c) => `<w:tc><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${this.escapeXml(c)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`;
      } else {
        if (inTable) { bodyXml += `</w:tbl>`; inTable = false; }
        if (line.startsWith("### ")) bodyXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="2563EB"/></w:rPr><w:t>${this.escapeXml(line.slice(4))}</w:t></w:r></w:p>`;
        else if (line.startsWith("## ")) bodyXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E3A5F"/></w:rPr><w:t>${this.escapeXml(line.slice(3))}</w:t></w:r></w:p>`;
        else if (line.startsWith("# ")) bodyXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F172A"/></w:rPr><w:t>${this.escapeXml(line.slice(2))}</w:t></w:r></w:p>`;
        else if (/^\d+\.\s/.test(line)) bodyXml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${this.escapeXml(line)}</w:t></w:r></w:p>`;
        else if (/^[-*]\s/.test(line)) bodyXml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>${this.escapeXml(line.slice(2))}</w:t></w:r></w:p>`;
        else if (line.trim()) bodyXml += `<w:p><w:r><w:t>${this.escapeXml(line)}</w:t></w:r></w:p>`;
      }
    }
    if (inTable) bodyXml += `</w:tbl>`;

    const docxContent = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
    return { format: "docx", content: docxContent, filename: `${options.filename ?? "document"}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }

  private toXlsx(data: SheetsWorkbook, options: ExportOptions): ExportResult {
    const sheetsXml = data.sheets.map((sheet, idx) => {
      const cols = sheet.headers.length;
      const rows = sheet.data.length + 1;
      const colXml = sheet.headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${h.format === "date" ? 14 : 12}" customWidth="1"/>`).join("");
      const rowXml = [
        `<row r="1">${sheet.headers.map((h, i) => `<c r="${String.fromCharCode(65 + i)}1" t="inlineStr"><is><t>${this.escapeXml(h.name)}</t></is></c>`).join("")}</row>`,
        ...sheet.data.map((row, ri) => `<row r="${ri + 2}">${row.map((cell, ci) => {
          const ref = `${String.fromCharCode(65 + ci)}${ri + 2}`;
          const isFormula = sheet.headers[ci]?.formula != null;
          if (isFormula) return `<c r="${ref}" t="str"><f>${this.escapeXml(sheet.headers[ci].formula!.replace(/ROW/g, String(ri + 2)))}</f></c>`;
          const num = parseFloat(cell);
          if (!isNaN(num) && cell.trim() !== "") return `<c r="${ref}" s="${sheet.headers[ci]?.format === "currency" ? 1 : sheet.headers[ci]?.format === "percentage" ? 2 : 0}"><v>${num}</v></c>`;
          if (cell.startsWith("=")) return `<c r="${ref}" t="str"><f>${this.escapeXml(cell.slice(1))}</f></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${this.escapeXml(cell)}</t></is></c>`;
        }).join("")}</row>`),
      ].join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="0"/></sheetPr>
  <cols>${colXml}</cols>
  <sheetData>${rowXml}</sheetData>
  ${sheet.conditional_formatting ? `<conditionalFormatting>${sheet.conditional_formatting.map((cf: any) =>
    `<cfRule type="colorScale" priority="1"><colorScale>${["min", "mid", "max"].filter((k) => cf[k]).map((k) => `<${k}><color rgb="FF${(cf[k].color ?? "FFFFFF").replace("#", "")}"/></${k}>`).join("")}</colorScale></cfRule>`
  ).join("")}</conditionalFormatting>` : ""}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75"/>
</worksheet>`;
    }).join("\n");

    const xlsxContent = sheetsXml;
    return { format: "xlsx", content: xlsxContent, filename: `${options.filename ?? data.workbook.name}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  private toCsv(data: SheetsWorkbook, _options: ExportOptions): ExportResult {
    const csvContent = data.sheets.map((sheet) => {
      const headerRow = sheet.headers.map((h) => this.escapeCsv(h.name)).join(",");
      const dataRows = sheet.data.map((row) => row.map((cell) => this.escapeCsv(cell)).join(","));
      return `"${sheet.name}"\n${headerRow}\n${dataRows.join("\n")}`;
    }).join("\n\n");
    return { format: "csv", content: csvContent, filename: `${data.workbook.name}.csv`, mimeType: "text/csv" };
  }

  private toSlidesMarkdown(data: SlidesDocument, _options: ExportOptions): ExportResult {
    const md = data.slides.map((s) => {
      const body = s.elements.filter((e) => e.type === "text").map((e) => e.content).join("\n\n");
      return `## ${s.type === "title" ? data.metadata.title : s.elements[0]?.content ?? `Slide ${s.slide_number}`}\n\n${body}${s.elements.some((e) => e.type === "chart") ? "\n\n*[chart]*" : ""}`;
    }).join("\n\n---\n\n");
    return { format: "md", content: `# ${data.metadata.title}\n\n${md}`, filename: `${options.filename ?? data.metadata.title}.md`, mimeType: "text/markdown" };
  }

  private toSlidesHtml(data: SlidesDocument, _options: ExportOptions): ExportResult {
    const theme = designSystem.getTheme((data.metadata.theme ?? "dark_modern") as ThemeId);
    const c = theme.colors;
    const slidesHtml = data.slides.map((s) => {
      const bg = s.background?.value ?? c.background;
      const elementsHtml = s.elements.map((el) => {
        const style = el.style ?? {};
        const pos = `left: ${el.position.x}${el.position.unit}; top: ${el.position.y}${el.position.unit}; width: ${el.position.width}${el.position.unit}; height: ${el.position.height}${el.position.unit}`;
        const textStyle = `font-family: ${style.font_family ?? theme.typography.body_font}; font-size: ${style.font_size ?? 18}px; font-weight: ${style.font_weight ?? 400}; color: ${style.color ?? c.text_primary}; text-align: ${style.text_align ?? "left"}`;
        return `<div class="slide-element" style="${pos}; ${textStyle}; position: absolute;">${el.content}</div>`;
      }).join("\n");
      return `<div class="slide" style="background: ${bg}; width: 1280px; height: 720px; position: relative; overflow: hidden; margin: 1rem auto; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">${elementsHtml}</div>`;
    }).join("\n");

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${data.metadata.title}</title><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f172a; font-family: ${theme.typography.body_font}, system-ui, sans-serif; padding: 2rem; }
.slide { transition: all 0.3s ease; }
.slide-element { transition: all 0.2s ease; }
@media print { body { background: white; padding: 0; } .slide { page-break-after: always; box-shadow: none; margin: 0; border-radius: 0; } }
</style></head><body><h1 style="color: ${c.text_primary}; text-align: center; margin-bottom: 2rem;">${data.metadata.title}</h1>${slidesHtml}</body></html>`;
    return { format: "html", content: html, filename: `${options.filename ?? data.metadata.title}.html`, mimeType: "text/html" };
  }

  private toSlidesPdf(data: SlidesDocument, options: ExportOptions): ExportResult {
    const html = this.toSlidesHtml(data, { ...options, format: "html" });
    return { format: "pdf", content: html.content, filename: `${options.filename ?? data.metadata.title}.pdf`, mimeType: "application/pdf" };
  }

  private toDocHtml(markdown: string, _options: ExportOptions): ExportResult {
    const html = markdown.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n\n/g, "</p><p>").replace(/^(.+)$/gm, (m) => m.startsWith("<") ? m : m.trim() ? m : "");
    const styled = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Georgia', serif; line-height: 1.6; color: #1a1a2e; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #0f172a; } h2 { font-size: 1.5rem; margin-top: 2rem; color: #1e293b; }
h3 { font-size: 1.2rem; margin-top: 1.5rem; color: #334155; } p { margin-bottom: 1rem; }
code { background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.9em; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; } th, td { border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
th { background: #f8fafc; font-weight: 600; }
@media print { body { margin: 0; padding: 1in; } }
</style></head><body><p>${html}</p></body></html>`;
    return { format: "html", content: styled, filename: `${_options.filename ?? "document"}.html`, mimeType: "text/html" };
  }

  private toDocPdf(markdown: string, options: ExportOptions): ExportResult {
    const html = this.toDocHtml(markdown, { ...options, format: "html" });
    return { format: "pdf", content: html.content, filename: `${options.filename ?? "document"}.pdf`, mimeType: "application/pdf" };
  }

  private toGoogleSlides(data: SlidesDocument, _options: ExportOptions): ExportResult {
    const requests = data.slides.flatMap((slide, idx) => {
      const createSlide = [{ createSlide: { objectId: `slide_${idx + 1}`, insertionIndex: idx } }];
      const elements = slide.elements.map((el) => ({
        createShape: {
          objectId: el.id,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: `slide_${idx + 1}`,
            size: { width: { magnitude: el.position.width, unit: "PT" }, height: { magnitude: el.position.height, unit: "PT" } },
            transform: { scaleX: 1, scaleY: 1, translateX: el.position.x, translateY: el.position.y, unit: "PT" },
          },
          text: el.content,
        },
      }));
      return [...createSlide, ...elements];
    });
    return { format: "google_slides", content: JSON.stringify({ requests }), filename: `${data.metadata.title}.json`, mimeType: "application/json" };
  }

  private toSheetHtml(data: SheetsWorkbook, _options: ExportOptions): ExportResult {
    const sheetsHtml = data.sheets.map((sheet) => {
      const headerRow = `<tr>${sheet.headers.map((h) => `<th>${this.escapeXml(h.name)}</th>`).join("")}</tr>`;
      const dataRows = sheet.data.map((row) => `<tr>${row.map((cell) => `<td>${this.escapeXml(cell)}</td>`).join("")}</tr>`).join("\n");
      return `<h2>${this.escapeXml(sheet.name)}</h2><table><thead>${headerRow}</thead><tbody>${dataRows}</tbody></table>`;
    }).join("\n");
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${data.workbook.name}</title><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
h1 { margin-bottom: 1rem; color: #0f172a; } h2 { margin: 2rem 0 0.5rem; color: #1e293b; }
table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.9rem; }
th { background: #f8fafc; font-weight: 600; color: #1e293b; position: sticky; top: 0; }
tr:nth-child(even) { background: #f8fafc; }
tr:hover { background: #eef2ff; }
</style></head><body><h1>${this.escapeXml(data.workbook.name)}</h1>${sheetsHtml}</body></html>`;
    return { format: "html", content: html, filename: `${options.filename ?? data.workbook.name}.html`, mimeType: "text/html" };
  }

  private escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  private escapeCsv(s: string): string {
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
}

export const exportEngine = new ExportEngine();
