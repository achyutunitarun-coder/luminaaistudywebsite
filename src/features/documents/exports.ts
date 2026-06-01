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

export function exportHTML(editorHtml: string, title: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif&family=JetBrains+Mono&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css">
<style>body{background:#0a0a0f;color:rgba(255,255,255,0.88);font-family:'Instrument Sans',system-ui,sans-serif;line-height:1.85;padding:56px 24px;max-width:740px;margin:0 auto}h1,h2,h3{font-family:'Instrument Serif',serif}h1{font-size:32px}h2{font-size:24px}h3{font-family:'Instrument Sans',sans-serif;font-weight:500;font-size:18px}pre{font-family:'JetBrains Mono',monospace;background:#141420;padding:16px;border-radius:8px;overflow:auto}</style>
</head><body><h1>${escapeHtml(title)}</h1>${editorHtml}</body></html>`;
  dl(new Blob([html], { type: "text/html" }), `${slug(title)}.html`);
}

export function exportPDF() {
  window.print();
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
