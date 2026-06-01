// Detect the LAST html/jsx/svg fenced code block in an assistant message.
const FENCE_RE = /```(html|jsx|svg)\s*\n([\s\S]*?)```/gi;

export type CanvasDetected = { lang: "html" | "jsx" | "svg"; code: string };

export function detectCanvas(text: string): CanvasDetected | null {
  let last: CanvasDetected | null = null;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(text)) !== null) {
    last = { lang: m[1].toLowerCase() as "html" | "jsx" | "svg", code: m[2].trim() };
  }
  if (!last || last.code.length < 30) return null;
  return last;
}

export function wrapAsHtmlDoc(code: string, lang: "html" | "jsx" | "svg"): string {
  if (lang === "html" && /<!doctype html|<html[\s>]/i.test(code)) return code;
  if (lang === "svg") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:90vw;max-height:90vh}</style></head><body>${code}</body></html>`;
  }
  if (lang === "jsx") {
    // Render JSX via Babel + React from CDN
    return `<!doctype html><html><head><meta charset="utf-8"><script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body{margin:0;font-family:-apple-system,system-ui,sans-serif}</style></head><body><div id="root"></div><script type="text/babel" data-presets="react">
${code}
const __root = ReactDOM.createRoot(document.getElementById('root'));
try { __root.render(React.createElement(typeof App!=='undefined'?App:(()=>React.createElement('div',{style:{padding:24}},'No <App/> export found.')))); } catch(e){ document.getElementById('root').innerText = String(e); }
</script></body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${code}</body></html>`;
}
