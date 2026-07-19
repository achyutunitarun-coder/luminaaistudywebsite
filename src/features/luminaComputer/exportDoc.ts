import type { LcBlock } from "./api";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

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

    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?|[-*]\s+|---+\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

type DocTheme = {
  name: string;
  paper: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  rule: string;
  accent: string;
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  coverStyle: "minimal" | "striking" | "warm" | "technical";
  pageMargin: string;
  dropCap: boolean;
};

const DOC_THEMES: DocTheme[] = [
  {
    name: "Stripe Press",
    paper: "#faf8f3", ink: "#14141a", inkSoft: "#3a3a44", inkMute: "#6b6b76",
    rule: "#d9d5c9", accent: "#7040d8",
    displayFont: "'Fraunces', serif", bodyFont: "'Inter', system-ui, sans-serif", monoFont: "'JetBrains Mono', monospace",
    coverStyle: "minimal", pageMargin: "22mm", dropCap: true,
  },
  {
    name: "The Dark Side",
    paper: "#0d0d14", ink: "#e8e8ed", inkSoft: "#b8b8c3", inkMute: "#787883",
    rule: "#2a2a35", accent: "#6d5acf",
    displayFont: "'Fraunces', serif", bodyFont: "'Inter', system-ui, sans-serif", monoFont: "'JetBrains Mono', monospace",
    coverStyle: "striking", pageMargin: "20mm", dropCap: true,
  },
  {
    name: "Academic",
    paper: "#ffffff", ink: "#1a1a2e", inkSoft: "#3a3a4e", inkMute: "#6a6a7e",
    rule: "#d0d0d8", accent: "#c0392b",
    displayFont: "'Georgia', 'Times New Roman', serif", bodyFont: "'Georgia', 'Times New Roman', serif", monoFont: "'Courier New', monospace",
    coverStyle: "minimal", pageMargin: "25mm", dropCap: false,
  },
  {
    name: "Editorial",
    paper: "#f5f0eb", ink: "#1c1814", inkSoft: "#4a443e", inkMute: "#7a746e",
    rule: "#d4cdc4", accent: "#b85a30",
    displayFont: "'Playfair Display', 'Georgia', serif", bodyFont: "'Inter', system-ui, sans-serif", monoFont: "'JetBrains Mono', monospace",
    coverStyle: "warm", pageMargin: "22mm", dropCap: true,
  },
  {
    name: "Technical",
    paper: "#f8f9fa", ink: "#1a1d23", inkSoft: "#3d414a", inkMute: "#6c717a",
    rule: "#d1d5db", accent: "#2563eb",
    displayFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", monoFont: "'JetBrains Mono', monospace",
    coverStyle: "technical", pageMargin: "20mm", dropCap: false,
  },
];

function pickDocTheme(seed?: string): DocTheme {
  if (!seed) return DOC_THEMES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash) + seed.charCodeAt(i); hash |= 0; }
  return DOC_THEMES[Math.abs(hash) % DOC_THEMES.length];
}

function buildCover(theme: DocTheme, title: string, today: string, sectionsCount: number): string {
  const safeTitle = escapeHtml(title || "Untitled");
  switch (theme.coverStyle) {
    case "striking":
      return `
    <div class="cover cover-striking">
      <div class="cover-accent-bg"></div>
      <div class="cover-content">
        <div class="eyebrow">Lumina · Document</div>
        <h1>${safeTitle}</h1>
        <div class="cover-rule"></div>
        <div class="meta">
          <span>${sectionsCount} sections</span>
          <span>Issued · ${today}</span>
        </div>
      </div>
    </div>`;
    case "warm":
      return `
    <div class="cover cover-warm">
      <div class="eyebrow">Lumina · Document</div>
      <div class="cover-ornament">✦</div>
      <h1>${safeTitle}</h1>
      <p class="cover-date">${today}</p>
    </div>`;
    case "technical":
      return `
    <div class="cover cover-tech">
      <div class="eyebrow">LUMINA COMPUTER // DOCUMENT</div>
      <div class="tech-border"></div>
      <h1>${safeTitle}</h1>
      <div class="meta">
        <span>v1.0 · ${today}</span>
        <span>${sectionsCount} sections</span>
      </div>
    </div>`;
    default:
      return `
    <div class="cover">
      <div>
        <div class="eyebrow">Lumina · Document</div>
        <div class="cover-rule"></div>
        <h1>${safeTitle}</h1>
      </div>
      <div class="meta">
        <span>Issued · ${today}</span>
        <span>${sectionsCount} sections</span>
      </div>
    </div>`;
  }
}

function buildThemeCSS(theme: DocTheme): string {
  return `
  :root {
    --ink: ${theme.ink};
    --ink-soft: ${theme.inkSoft};
    --ink-mute: ${theme.inkMute};
    --paper: ${theme.paper};
    --rule: ${theme.rule};
    --accent: ${theme.accent};
    --display: ${theme.displayFont};
    --body: ${theme.bodyFont};
    --mono: ${theme.monoFont};
  }
  @page { size: A4; margin: ${theme.pageMargin}; }
  html, body { background: var(--paper); color: var(--ink); }
  body { font-family: var(--body); margin: 0; -webkit-font-smoothing: antialiased; font-feature-settings: "ss01","liga","kern"; line-height: 1.6; }

  .cover { min-height: 92vh; display: flex; flex-direction: column; justify-content: space-between; padding: 0 0 2rem; page-break-after: always; }
  .cover .eyebrow { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.24em; font-size: 10px; color: var(--accent); }
  .cover-rule { height: 1px; background: var(--ink); width: 42%; margin: 1.4rem 0 3rem; }
  .cover h1 { font-family: var(--display); font-weight: 500; font-size: 68px; line-height: 1.02; letter-spacing: -0.03em; color: var(--ink); margin: 0; max-width: 22ch; }
  .cover h1 em { font-style: italic; color: var(--accent); }
  .cover .meta { display: flex; justify-content: space-between; align-items: flex-end; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--ink-mute); border-top: 1px solid var(--rule); padding-top: 12px; }

  .cover-striking { position: relative; overflow: hidden; }
  .cover-striking .cover-accent-bg { position: absolute; top: -20%; right: -10%; width: 50%; height: 140%; background: linear-gradient(135deg, var(--accent) 0%, transparent 70%); opacity: 0.08; pointer-events: none; }
  .cover-striking .cover-content { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; min-height: 80vh; }
  .cover-striking h1 { font-size: 78px; letter-spacing: -0.04em; }

  .cover-warm { text-align: center; align-items: center; }
  .cover-warm h1 { font-size: 56px; text-align: center; }
  .cover-warm .cover-ornament { font-size: 48px; line-height: 1; margin: 2rem 0; color: var(--accent); opacity: 0.5; }
  .cover-warm .cover-date { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--ink-mute); }

  .cover-tech { }
  .cover-tech .tech-border { height: 4px; background: linear-gradient(90deg, var(--accent) 0%, var(--rule) 60%, transparent 100%); width: 100%; margin: 1rem 0 2rem; }
  .cover-tech h1 { font-family: var(--body); font-weight: 600; font-size: 52px; letter-spacing: -0.02em; text-transform: uppercase; }

  main { max-width: 62ch; margin: 0 auto; padding: 0 1rem; }

  .doc-section { page-break-inside: auto; margin: 0 0 2.4rem; }
  .doc-section + .doc-section { padding-top: 2rem; border-top: 1px solid var(--rule); }
  .doc-section::before {
    content: "§ " attr(data-idx);
    display: block;
    font-family: var(--mono);
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.22em;
    color: var(--accent); margin-bottom: 0.6rem;
  }

  h2 { font-family: var(--display); font-weight: 500; font-size: 34px; line-height: 1.12; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 1rem; }
  h3 { font-family: var(--display); font-weight: 500; font-size: 22px; line-height: 1.2; color: var(--ink); margin: 2rem 0 0.6rem; }
  p { font-size: 15.5px; line-height: 1.72; color: var(--ink-soft); margin: 0 0 1rem; hyphens: auto; text-align: justify; text-justify: inter-word; }
  ${theme.dropCap ? `.doc-section > h2 + p::first-letter { font-family: var(--display); font-weight: 500; float: left; font-size: 62px; line-height: 0.9; padding: 6px 10px 0 0; color: var(--ink); }` : ""}
  p > em:first-child:only-child, .doc-section > h2 + p:first-of-type em:first-child { font-family: var(--display); font-style: italic; color: var(--ink-mute); font-size: 17px; }
  strong { color: var(--ink); font-weight: 600; }
  em { color: var(--ink); }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  code { font-family: var(--mono); font-size: 12.5px; background: color-mix(in srgb, var(--ink) 5%, transparent); padding: 1px 5px; border-radius: 3px; }
  blockquote { font-family: var(--display); font-style: italic; font-weight: 400; font-size: 21px; line-height: 1.42; color: var(--ink); margin: 1.6rem 0; padding: 0 0 0 1.1rem; border-left: 2px solid var(--accent); }
  ul { list-style: none; padding: 0; margin: 1rem 0 1.2rem; }
  ul li { position: relative; padding-left: 1.4rem; margin: 0.35rem 0; font-size: 15px; line-height: 1.6; color: var(--ink-soft); }
  ul li::before { content: ""; position: absolute; left: 0; top: 0.72rem; width: 0.7rem; height: 1px; background: var(--accent); }
  hr { border: 0; height: 1px; background: var(--rule); margin: 2rem 0; }

  .slide-block { background: color-mix(in srgb, var(--ink) 3%, transparent); border: 1px solid var(--rule); border-radius: 8px; padding: 1.5rem; margin: 2rem 0; page-break-inside: avoid; }
  .slide-block h3 { margin-top: 0; font-size: 24px; }
  .slide-block .slide-stats { display: flex; gap: 1rem; flex-wrap: wrap; }
  .slide-block .slide-stat { flex: 1; min-width: 120px; padding: 0.5rem; border-left: 2px solid var(--accent); }
  .slide-block .slide-stat .value { font-size: 28px; font-weight: 600; font-family: var(--display); color: var(--ink); }

  .sheet-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 12px; font-family: var(--mono); }
  .sheet-table th { background: color-mix(in srgb, var(--accent) 10%, transparent); padding: 6px 10px; text-align: left; border-bottom: 2px solid var(--accent); font-weight: 600; color: var(--ink); }
  .sheet-table td { padding: 5px 10px; border-bottom: 1px solid var(--rule); }

  .code-block { background: color-mix(in srgb, var(--ink) 5%, transparent); border: 1px solid var(--rule); border-radius: 6px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
  .code-block pre { margin: 0; font-family: var(--mono); font-size: 12px; line-height: 1.5; }

  .colophon { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--rule); font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.22em; color: var(--ink-mute); display: flex; justify-content: space-between; }

  @media print {
    .cover { min-height: calc(297mm - 44mm); }
    .doc-section { break-inside: avoid-page; }
    h2, h3 { break-after: avoid; }
    blockquote, ul, p { orphans: 3; widows: 3; }
  }`;
}

function renderNonDocBlock(block: LcBlock): string {
  const c = block.content_json;
  if (!c) return "";
  switch (block.block_type) {
    case "slide": {
      const layout = c.layout ?? "statement";
      let body = "";
      if (layout === "stat" && c.stat) {
        body = `<div class="slide-stats"><div class="slide-stat"><div class="value">${escapeHtml(String(c.stat.value ?? ""))}</div><div class="label">${escapeHtml(String(c.stat.label ?? ""))}</div></div></div>`;
      } else if (c.kpis?.length) {
        body = `<div class="slide-stats">${c.kpis.map((k: any) => `<div class="slide-stat"><div class="value">${escapeHtml(String(k.value ?? ""))}</div><div class="label">${escapeHtml(String(k.label ?? ""))}</div>${k.delta ? `<div class="delta">${escapeHtml(String(k.delta))}</div>` : ""}</div>`).join("")}</div>`;
      } else if (c.bullets?.length) {
        body = `<ul>${c.bullets.map((b: string) => `<li>${escapeHtml(String(b))}</li>`).join("")}</ul>`;
      } else if (c.quote) {
        body = `<blockquote>“${escapeHtml(String(c.quote.text ?? ""))}”<br>— ${escapeHtml(String(c.quote.attribution ?? ""))}</blockquote>`;
      }
      return `<div class="slide-block"><h3>${escapeHtml(String(c.title ?? block.title ?? ""))}</h3>${body}</div>`;
    }
    case "sheet_tab": {
      const cols = c.columns ?? [];
      const rows = c.rows ?? [];
      if (!cols.length) return "";
      return `<div class="sheet-table"><table><thead><tr>${cols.map((col: string) => `<th>${escapeHtml(String(col))}</th>`).join("")}</tr></thead><tbody>${rows.map((row: any[]) => `<tr>${row.map((cell: any) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    case "site_section": {
      const html = c.html ?? "";
      return html ? `<div class="code-block"><pre><code>${escapeHtml(html.slice(0, 2000))}${html.length > 2000 ? "\n<!-- truncated -->" : ""}</code></pre></div>` : "";
    }
    default:
      return `<div class="code-block"><pre><code>${escapeHtml(JSON.stringify(c, null, 2))}</code></pre></div>`;
  }
}

export function exportDocToPdf(title: string, blocks: LcBlock[], themeSeed?: string, preOpenedWin?: Window | null) {
  const theme = pickDocTheme(themeSeed ?? title);

  const docSections = blocks
    .filter((b) => b.block_type === "doc_section" && b.content_json?.markdown)
    .map((b, idx) => {
      const html = mdToHtml(String(b.content_json.markdown ?? ""));
      return `<section class="doc-section" data-idx="${idx + 1}">${html}</section>`;
    })
    .join("\n");

  const nonDocBlocks = blocks
    .filter((b) => b.block_type !== "doc_section" && b.content_json)
    .map((b) => renderNonDocBlock(b))
    .join("\n");

  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const safeTitle = escapeHtml(title || "Untitled");

  const cover = buildCover(theme, title, today, blocks.length);
  const themeCSS = buildThemeCSS(theme);

  // Load theme fonts based on theme choice
  const fontLoads: string[] = [];
  if (theme.displayFont.includes("Playfair")) {
    fontLoads.push('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">');
  }
  if (theme.displayFont.includes("Fraunces")) {
    fontLoads.push('<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&display=swap" rel="stylesheet">');
  }
  if (theme.bodyFont.includes("Inter") || theme.displayFont.includes("Inter")) {
    fontLoads.push('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">');
  }
  if (theme.monoFont.includes("JetBrains")) {
    fontLoads.push('<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">');
  }

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontLoads.join("\n")}
<style>${themeCSS}</style>
</head>
<body>
  ${cover}

  <main>
    ${docSections}
    ${nonDocBlocks ? `<div class="doc-section" style="border-top: 2px solid var(--accent); padding-top: 1rem;"><h2>Supplementary Materials</h2>${nonDocBlocks}</div>` : ""}
    <div class="colophon">
      <span>End of document</span>
      <span>${theme.name} · ${today}</span>
    </div>
  </main>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function(){ window.focus(); window.print(); }, 600);
    });
  </script>
</body>
</html>`;

  const win = preOpenedWin ?? window.open("", "_blank");
  if (!win) throw new Error("Popup blocked — allow popups to export PDF");
  win.document.open();
  win.document.write(doc);
  win.document.close();
}
