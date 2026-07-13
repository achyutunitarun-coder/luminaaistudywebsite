import hljs from 'highlight.js';
import chalk from 'chalk';

export function highlightCode(code, language) {
  try {
    const lang = language || detectLanguage(code);
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(code, { language: lang });
      return applyTerminalColors(result.value);
    }
  } catch {}
  return code;
}

function detectLanguage(code) {
  if (/^import\s+|^export\s+|^const\s+\w+\s*=|^function\s|^class\s|=>/.test(code)) return 'javascript';
  if (/^from\s+|^def\s+|^import\s+\w+$/.test(code)) return 'python';
  if (/^#include|^using\s+namespace|^int\s+main/.test(code)) return 'cpp';
  if (/^package\s+|^import\s+java/.test(code)) return 'java';
  if (/^fn\s+|^let\s+|^mut\s+|^impl\s+/.test(code)) return 'rust';
  if (/^<[^>]+>/.test(code)) return 'html';
  return null;
}

function applyTerminalColors(html) {
  return html
    .replace(/<span class="hljs-keyword">([^<]+)<\/span>/g, (_, m) => chalk.magenta(m))
    .replace(/<span class="hljs-string">([^<]+)<\/span>/g, (_, m) => chalk.green(m))
    .replace(/<span class="hljs-number">([^<]+)<\/span>/g, (_, m) => chalk.yellow(m))
    .replace(/<span class="hljs-comment">([^<]+)<\/span>/g, (_, m) => chalk.gray(m))
    .replace(/<span class="hljs-title">([^<]+)<\/span>/g, (_, m) => chalk.blue(m))
    .replace(/<span class="hljs-built_in">([^<]+)<\/span>/g, (_, m) => chalk.cyan(m))
    .replace(/<span class="hljs-attr">([^<]+)<\/span>/g, (_, m) => chalk.red(m))
    .replace(/<span class="hljs-selector-tag">([^<]+)<\/span>/g, (_, m) => chalk.magenta(m))
    .replace(/<span class="hljs-selector-class">([^<]+)<\/span>/g, (_, m) => chalk.yellow(m))
    .replace(/<span class="hljs-([^"]+)">([^<]+)<\/span>/g, (_, __, m) => chalk.white(m));
}
