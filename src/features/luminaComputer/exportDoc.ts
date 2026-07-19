// Lumina Computer — Doc → beautiful printable PDF via the browser's native
// PDF engine. Zero dependencies. Opens a print window styled like Stripe Press /
// The New Yorker — real typography, drop caps, pull quotes, running head.

import type { LcBlock } from "./api";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

/**
 * Very small markdown → HTML converter tuned for our doc sections.
 * Handles: ## / ### headings, **bold**, *italic* / _italic_, `code`,
 * > blockquote, unordered lists, paragraphs, --- rules.
 */
function mdToHtml(md: string): string {
  const src = md.replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  const inline = (t: string) =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^##\s+/.test(line)) { out.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`); i++; continue; }
    if (/^###\s+/.test(line)) { out.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push('<hr />'); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      out.push(`<ul>${buf.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }

    // paragraph — collect until blank line
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?|[-*]\s+|---+\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function exportDocToPdf(title: string, blocks: LcBlock[], preOpenedWin?: Window | null) {
  const sections = blocks
    .filter((b) => b.block_type === "doc_section" && b.content_json?.markdown)
    .map((b, idx) => {
      const html = mdToHtml(String(b.content_json.markdown ?? ""));
      return `<section class="doc-section" data-idx="${idx + 1}">${html}</section>`;
    })
    .join("\n");

  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const safeTitle = escapeHtml(title || "Untitled");

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #14141a;
    --ink-soft: #3a3a44;
    --ink-mute: #6b6b76;
    --paper: #faf8f3;
    --rule: #d9d5c9;
    --accent: #7040d8;
  }
  @page { size: A4; margin: 22mm 22mm 22mm 22mm; }
  html, body { background: var(--paper); color: var(--ink); }
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; -webkit-font-smoothing: antialiased; font-feature-settings: "ss01","liga","kern"; }

  .cover {
    min-height: 92vh;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 0 0 2rem;
    page-break-after: always;
  }
  .cover .eyebrow {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    text-transform: uppercase; letter-spacing: 0.24em; font-size: 10px;
    color: var(--accent);
  }
  .cover .rule { height: 1px; background: var(--ink); width: 42%; margin: 1.4rem 0 3rem; }
  .cover h1 {
    font-family: 'Fraunces', serif;
    font-weight: 500; font-size: 68px; line-height: 1.02;
    letter-spacing: -0.03em; color: var(--ink); margin: 0;
    max-width: 22ch;
  }
  .cover h1 em { font-style: italic; color: var(--accent); }
  .cover .meta {
    display: flex; justify-content: space-between; align-items: flex-end;
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.2em; color: var(--ink-mute);
    border-top: 1px solid var(--rule); padding-top: 12px;
  }

  main { max-width: 62ch; margin: 0 auto; }

  .doc-section { page-break-inside: auto; margin: 0 0 2.4rem; }
  .doc-section + .doc-section { padding-top: 2rem; border-top: 1px solid var(--rule); }
  .doc-section[data-idx]::before {
    content: "§ " attr(data-idx);
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.22em;
    color: var(--accent); margin-bottom: 0.6rem;
  }

  h2 {
    font-family: 'Fraunces', serif; font-weight: 500;
    font-size: 34px; line-height: 1.12; letter-spacing: -0.02em;
    color: var(--ink); margin: 0 0 1rem;
  }
  h3 {
    font-family: 'Fraunces', serif; font-weight: 500;
    font-size: 22px; line-height: 1.2; color: var(--ink);
    margin: 2rem 0 0.6rem;
  }
  p {
    font-size: 15.5px; line-height: 1.72; color: var(--ink-soft);
    margin: 0 0 1rem; hyphens: auto; text-align: justify;
    text-justify: inter-word;
  }
  /* Drop-cap on first paragraph of each section */
  .doc-section > h2 + p::first-letter {
    font-family: 'Fraunces', serif; font-weight: 500;
    float: left; font-size: 62px; line-height: 0.9;
    padding: 6px 10px 0 0; color: var(--ink);
  }
  p > em:first-child:only-child, .doc-section > h2 + p:first-of-type em:first-child {
    font-family: 'Fraunces', serif; font-style: italic; color: var(--ink-mute);
    font-size: 17px;
  }
  strong { color: var(--ink); font-weight: 600; }
  em { color: var(--ink); }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(112,64,216,0.35); }
  code {
    font-family: 'JetBrains Mono', monospace; font-size: 12.5px;
    background: rgba(20,20,26,0.05); padding: 1px 5px; border-radius: 3px;
  }
  blockquote {
    font-family: 'Fraunces', serif; font-style: italic; font-weight: 400;
    font-size: 21px; line-height: 1.42; color: var(--ink);
    margin: 1.6rem 0; padding: 0 0 0 1.1rem;
    border-left: 2px solid var(--accent);
  }
  ul { list-style: none; padding: 0; margin: 1rem 0 1.2rem; }
  ul li {
    position: relative; padding-left: 1.4rem; margin: 0.35rem 0;
    font-size: 15px; line-height: 1.6; color: var(--ink-soft);
  }
  ul li::before {
    content: ""; position: absolute; left: 0; top: 0.72rem;
    width: 0.7rem; height: 1px; background: var(--accent);
  }
  hr { border: 0; height: 1px; background: var(--rule); margin: 2rem 0; }

  .colophon {
    margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--rule);
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.22em; color: var(--ink-mute);
    display: flex; justify-content: space-between;
  }

  @media print {
    .cover { min-height: calc(297mm - 44mm); }
    .doc-section { break-inside: avoid-page; }
    h2, h3 { break-after: avoid; }
    blockquote, ul, p { orphans: 3; widows: 3; }
  }
</style>
</head>
<body>
  <div class="cover">
    <div>
      <div class="eyebrow">Lumina · Document</div>
      <div class="rule"></div>
      <h1>${safeTitle}</h1>
    </div>
    <div class="meta">
      <span>Issued · ${today}</span>
      <span>Lumina Computer</span>
    </div>
  </div>

  <main>
    ${sections}
    <div class="colophon">
      <span>End of document</span>
      <span>${today}</span>
    </div>
  </main>

  <script>
    // Give fonts a beat to hydrate before print dialog opens.
    window.addEventListener('load', function() {
      setTimeout(function(){ window.focus(); window.print(); }, 600);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup blocked — allow popups to export PDF");
  win.document.open();
  win.document.write(doc);
  win.document.close();
}
