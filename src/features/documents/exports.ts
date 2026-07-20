import html2pdf from "html2pdf.js";

function dl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMarkdown(editorHtml: string, title: string) {
  const div = document.createElement("div");
  div.innerHTML = editorHtml;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = Array.from(el.childNodes).map(walk).join("");
    switch (el.tagName) {
      case "H1": return `\n# ${inner}\n\n`;
      case "H2": return `\n## ${inner}\n\n`;
      case "H3": return `\n### ${inner}\n\n`;
      case "STRONG":
      case "B": return `**${inner}**`;
      case "EM":
      case "I": return `*${inner}*`;
      case "U": return `<u>${inner}</u>`;
      case "LI": return `- ${inner}\n`;
      case "UL":
      case "OL": return `\n${inner}\n`;
      case "PRE": return `\n\`\`\`\n${el.textContent}\n\`\`\`\n\n`;
      case "CODE": return `\`${inner}\``;
      case "BR": return "\n";
      case "P":
      case "DIV": return `${inner}\n\n`;
      default: return inner;
    }
  };
  const md = `# ${title}\n\n${walk(div).trim()}\n`;
  dl(new Blob([md], { type: "text/markdown" }), `${slug(title)}.md`);
}

function mckinseyStyles() {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, 'Helvetica Neue', sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #1d1d1d;
      background: #fff;
      width: 100%;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      padding: 42px 52px 52px;
    }
    .doc-title {
      font-weight: 700;
      font-size: 20pt;
      line-height: 1.15;
      color: #0a1f3f;
      margin-bottom: 2px;
      letter-spacing: -0.01em;
    }
    .doc-meta {
      font-size: 8pt;
      color: #8f9bae;
      margin-bottom: 24px;
      letter-spacing: 0.04em;
    }
    h1 {
      font-weight: 600;
      font-size: 13pt;
      line-height: 1.2;
      color: #0a1f3f;
      margin: 28px 0 10px;
    }
    h2 {
      font-weight: 600;
      font-size: 11pt;
      line-height: 1.25;
      color: #1a2b4e;
      margin: 20px 0 6px;
    }
    h3 {
      font-weight: 600;
      font-size: 10pt;
      line-height: 1.3;
      color: #2c3e5c;
      margin: 16px 0 4px;
    }
    p { margin: 0 0 8px; text-align: left; }
    strong { color: #0a1f3f; }
    ul, ol { margin: 4px 0 10px 20px; }
    li { margin-bottom: 3px; }
    blockquote {
      font-style: italic;
      color: #5a6a82;
      border-left: 2px solid #bac3d1;
      padding: 4px 0 4px 16px;
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9pt;
    }
    table th {
      background: #eef1f6;
      color: #0a1f3f;
      font-weight: 600;
      text-align: left;
      padding: 6px 10px;
      font-size: 8pt;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    table td {
      padding: 5px 10px;
      border-bottom: 1px solid #e2e6ed;
      vertical-align: top;
    }
    table tr:last-child td { border-bottom: none; }
    pre {
      background: #f5f6f8;
      border: 1px solid #e2e6ed;
      border-radius: 3px;
      padding: 10px 12px;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 8.5pt;
      line-height: 1.5;
      margin: 10px 0;
      color: #1d1d1d;
    }
    code {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 0.85em;
      background: #f5f6f8;
      padding: 1px 4px;
      border-radius: 2px;
      color: #b91c1c;
    }
    hr { border: none; height: 1px; background: #e2e6ed; margin: 20px 0; }
  `;
}

function mckinseyPage(title: string, content: string) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${mckinseyStyles()}</style>
</head><body>
<div class="page">
<div class="doc-title">${escapeHtml(title)}</div>
<div class="doc-meta">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
${content}
</div>
</body></html>`;
}

export async function exportPDF(editorHtml: string, title: string) {
  const content = editorHtml
    .replace(/<h1>/gi, '<h1>')
    .replace(/<h2>/gi, '<h2>')
    .replace(/<h3>/gi, '<h3>')
    .replace(/<blockquote>/gi, '<blockquote>')
    .replace(/<table[^>]*>/gi, '<table>')
    .replace(/<pre>/gi, '<pre>')
    .replace(/<code>/gi, '<code>');

  const html = mckinseyPage(title, content);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:816px;background:#fff;z-index:-1";
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        margin: [0.4, 0.5, 0.5, 0.5],
        filename: `${slug(title)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 816, windowWidth: 816 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(wrapper)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}

export function exportHTML(editorHtml: string, title: string) {
  const content = editorHtml
    .replace(/<h1>/gi, '<h1>')
    .replace(/<h2>/gi, '<h2>')
    .replace(/<h3>/gi, '<h3>')
    .replace(/<blockquote>/gi, '<blockquote>')
    .replace(/<table[^>]*>/gi, '<table>')
    .replace(/<pre>/gi, '<pre>')
    .replace(/<code>/gi, '<code>');

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  ${mckinseyStyles()}
  .page { max-width: 740px; margin: 0 auto; }
  @media print {
    body { color: #000; }
    h1, h2, h3 { page-break-after: avoid; }
    pre, table, blockquote { page-break-inside: avoid; }
  }
</style>
</head><body>
<div class="page">
<div class="doc-title">${escapeHtml(title)}</div>
<div class="doc-meta">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
${content}
</div>
</body></html>`;
  dl(new Blob([html], { type: "text/html" }), `${slug(title)}.html`);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
