// Lumina Computer — adaptive, structure-agnostic PDF export.
// Renders whatever the AI produced (markdown docs, slides, sheets, site
// sections, agent artifacts, arbitrary JSON) into an editorial-quality PDF
// and downloads it directly — no popup windows, no fixed template.
import type { LcBlock } from "./api";

export type ProgressFn = (pct: number, label: string) => void;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/* ---------------- markdown → html (adaptive, no fixed shape) --------------- */
function inline(t: string) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md: string): string {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre data-lang="${esc(lang)}"><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (r: string) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(tableHtml(head, rows));
      continue;
    }
    if (/^-{3,}\s*$/.test(line) || /^\*{3,}\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lv = Math.min(h[1].length, 4); out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`); i++; }
      out.push(`<ul>${buf.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { buf.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}</li>`); i++; }
      out.push(`<ol>${buf.join("")}</ol>`);
      continue;
    }
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|\||-{3,}))/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

function tableHtml(head: string[], rows: any[][]) {
  const th = head.map((c) => `<th>${inline(String(c))}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(String(c ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/* ---------------- adaptive block → html ---------------- */
function humanKey(k: string) {
  return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function valueHtml(v: any): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return mdToHtml(v);
  if (typeof v === "number" || typeof v === "boolean") return `<p>${esc(v)}</p>`;
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    if (v.every((x) => typeof x !== "object" || x == null)) {
      return `<ul>${v.map((x) => `<li>${inline(String(x))}</li>`).join("")}</ul>`;
    }
    if (v.every((x) => Array.isArray(x))) {
      const rows = v as any[][];
      return tableHtml(rows[0].map(String), rows.slice(1));
    }
    const keys = Array.from(new Set(v.flatMap((o) => Object.keys(o ?? {}))));
    if (keys.length && keys.length <= 8) {
      return tableHtml(keys.map(humanKey), v.map((o) => keys.map((k) => stringifyCell(o?.[k]))));
    }
    return v.map((x) => valueHtml(x)).join("");
  }
  // object
  return Object.entries(v)
    .filter(([, val]) => val != null && val !== "")
    .map(([k, val]) => {
      const body = valueHtml(val);
      if (!body) return "";
      const simple = typeof val !== "object";
      return simple
        ? `<p class="kv"><span class="k">${esc(humanKey(k))}</span> ${inline(String(val))}</p>`
        : `<h4>${esc(humanKey(k))}</h4>${body}`;
    })
    .join("");
}

function stringifyCell(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") return Array.isArray(v) ? v.join(", ") : JSON.stringify(v);
  return String(v);
}

function blockHtml(block: LcBlock): string {
  const c: any = block.content_json ?? {};
  const type = block.block_type;

  // Markdown-first blocks (docs, agent notes, anything with markdown/body/text)
  const mdField = c.markdown ?? c.body ?? c.content ?? c.text;
  if (typeof mdField === "string" && mdField.trim()) {
    const hasTitle = /^#{1,3}\s/.test(mdField.trim());
    return `<section class="blk">${hasTitle ? "" : `<h2>${esc(c.title ?? block.title)}</h2>`}${mdToHtml(mdField)}</section>`;
  }

  if (type === "slide") {
    const parts: string[] = [`<h2>${esc(c.title ?? block.title)}</h2>`];
    if (c.subtitle) parts.push(`<p class="lede">${inline(String(c.subtitle))}</p>`);
    if (c.stat?.value) parts.push(`<p class="stat"><span>${esc(c.stat.value)}</span> ${esc(c.stat.label ?? "")}</p>`);
    if (c.quote?.text) parts.push(`<blockquote>${inline(String(c.quote.text))}${c.quote.attribution ? `<cite>— ${esc(c.quote.attribution)}</cite>` : ""}</blockquote>`);
    if (Array.isArray(c.bullets) && c.bullets.length) parts.push(`<ul>${c.bullets.map((b: any) => `<li>${inline(typeof b === "string" ? b : stringifyCell(b))}</li>`).join("")}</ul>`);
    const rest = { ...c };
    ["title", "subtitle", "stat", "quote", "bullets", "layout", "notes", "speaker_notes"].forEach((k) => delete rest[k]);
    parts.push(valueHtml(rest));
    const notes = c.notes ?? c.speaker_notes;
    if (notes) parts.push(`<p class="notes"><span class="k">Notes</span> ${inline(String(notes))}</p>`);
    return `<section class="blk">${parts.join("")}</section>`;
  }

  if (type === "sheet_tab") {
    const cols: string[] = (c.columns ?? []).map(String);
    const rows: any[][] = (c.rows ?? []).map((r: any) => (Array.isArray(r) ? r : [r]));
    return `<section class="blk"><h2>${esc(c.tab_name ?? block.title)}</h2>${cols.length ? tableHtml(cols, rows) : valueHtml(c)}</section>`;
  }

  if (type === "site_section") {
    const text = String(c.html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `<section class="blk"><h2>${esc(block.title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}</section>`;
  }

  const body = valueHtml(c);
  return `<section class="blk"><h2>${esc(block.title)}</h2>${body || "<p><em>No content.</em></p>"}</section>`;
}

const CSS = `
#lc-pdf-root{width:816px;background:#fff;color:#16181d;font-family:'Inter',ui-sans-serif,system-ui,sans-serif;font-size:10.5pt;line-height:1.6;padding:56px 64px;-webkit-font-smoothing:antialiased}
#lc-pdf-root *{box-sizing:border-box}
#lc-pdf-root .cover{border-bottom:2px solid #16181d;padding-bottom:22px;margin-bottom:34px}
#lc-pdf-root .eyebrow{font-family:'JetBrains Mono',monospace;font-size:7.5pt;letter-spacing:.18em;text-transform:uppercase;color:#7a7f8a;margin:0 0 12px}
#lc-pdf-root .doc-title{font-family:'Fraunces','Georgia',serif;font-size:30pt;line-height:1.1;font-weight:600;letter-spacing:-.02em;margin:0 0 10px;color:#0d0f14}
#lc-pdf-root .meta{font-family:'JetBrains Mono',monospace;font-size:8pt;color:#8a8f99;margin:0}
#lc-pdf-root .blk{margin:0 0 26px;page-break-inside:auto}
#lc-pdf-root h1,#lc-pdf-root h2{font-family:'Fraunces','Georgia',serif;font-weight:600;letter-spacing:-.015em;color:#0d0f14;page-break-after:avoid}
#lc-pdf-root h1{font-size:18pt;margin:26px 0 10px}
#lc-pdf-root h2{font-size:14.5pt;margin:22px 0 9px}
#lc-pdf-root h3{font-size:11.5pt;font-weight:600;margin:16px 0 6px;color:#22252c;page-break-after:avoid}
#lc-pdf-root h4{font-family:'JetBrains Mono',monospace;font-size:8.5pt;letter-spacing:.1em;text-transform:uppercase;color:#7a7f8a;margin:14px 0 5px}
#lc-pdf-root p{margin:0 0 9px}
#lc-pdf-root .lede{font-size:12pt;color:#4a4f59;line-height:1.5}
#lc-pdf-root .stat{font-family:'Fraunces',serif;font-size:22pt;color:#0d0f14;margin:12px 0}
#lc-pdf-root .stat span{font-weight:600}
#lc-pdf-root .kv .k,#lc-pdf-root .notes .k{font-family:'JetBrains Mono',monospace;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#8a8f99;margin-right:8px}
#lc-pdf-root .notes{color:#5a606b;font-size:9.5pt}
#lc-pdf-root ul,#lc-pdf-root ol{margin:6px 0 12px 20px;padding:0}
#lc-pdf-root li{margin:0 0 5px}
#lc-pdf-root blockquote{margin:14px 0;padding:2px 0 2px 18px;border-left:2px solid #c8ccd4;color:#4a4f59;font-family:'Fraunces',serif;font-size:12pt;font-style:italic}
#lc-pdf-root blockquote cite{display:block;margin-top:6px;font-family:'Inter',sans-serif;font-style:normal;font-size:9pt;color:#8a8f99}
#lc-pdf-root code{font-family:'JetBrains Mono',monospace;font-size:.85em;background:#f4f5f7;padding:1px 4px;border-radius:3px}
#lc-pdf-root pre{background:#0d0f14;color:#e7e9ee;padding:14px 16px;border-radius:6px;overflow:hidden;margin:12px 0;page-break-inside:avoid}
#lc-pdf-root pre code{background:none;color:inherit;font-size:8.5pt;white-space:pre-wrap;word-break:break-word}
#lc-pdf-root table{width:100%;border-collapse:collapse;margin:12px 0;font-size:9pt;page-break-inside:avoid}
#lc-pdf-root th{text-align:left;background:#0d0f14;color:#fff;font-weight:600;padding:7px 9px;font-size:8.5pt}
#lc-pdf-root td{padding:6px 9px;border-bottom:1px solid #e5e7eb;vertical-align:top}
#lc-pdf-root tbody tr:nth-child(even){background:#f8f9fb}
#lc-pdf-root hr{border:none;border-top:1px solid #e0e3e8;margin:22px 0}
#lc-pdf-root a{color:#16181d;text-decoration:underline}
#lc-pdf-root .foot{margin-top:34px;padding-top:14px;border-top:1px solid #e0e3e8;font-family:'JetBrains Mono',monospace;font-size:7.5pt;color:#a0a5ae;text-align:center}
`;

function ensureFonts() {
  const id = "lc-pdf-fonts";
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id;
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}

export function buildPdfHtml(title: string, blocks: LcBlock[]): string {
  const ready = blocks.filter((b) => b.content_json);
  const body = ready.map(blockHtml).filter(Boolean).join("\n");
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return `<div class="cover"><p class="eyebrow">Lumina Computer</p><h1 class="doc-title">${esc(title)}</h1><p class="meta">${date} · ${ready.length} section${ready.length === 1 ? "" : "s"}</p></div>${body}<p class="foot">Generated with Lumina · ${esc(title)}</p>`;
}

/**
 * Render blocks to a PDF and download it directly (blob + anchor, never a popup).
 */
export async function exportBlocksToPdf(
  title: string,
  blocks: LcBlock[],
  onProgress: ProgressFn = () => {},
): Promise<void> {
  const ready = blocks.filter((b) => b.content_json);
  if (ready.length === 0) throw new Error("Nothing to export yet — no generated content.");

  onProgress(10, "Collecting generated content…");
  const html = buildPdfHtml(title, ready);

  ensureFonts();
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.id = "lc-pdf-root";
  root.innerHTML = html;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:816px;background:#fff;pointer-events:none;z-index:-1";
  host.appendChild(style);
  host.appendChild(root);
  document.body.appendChild(host);

  try {
    onProgress(30, "Laying out pages…");
    try { await (document as any).fonts?.ready; } catch { /* noop */ }
    await new Promise((r) => setTimeout(r, 120));

    onProgress(50, "Rendering document…");
    const { default: html2pdf } = await import("html2pdf.js");
    const filename = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "document"}.pdf`;

    const worker = html2pdf()
      .set({
        margin: [0.45, 0.4, 0.55, 0.4],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 816 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      } as any)
      .from(root);

    const blob: Blob = await worker.outputPdf("blob");
    onProgress(85, "Preparing download…");

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    onProgress(100, "Downloaded");
  } finally {
    host.remove();
  }
}
