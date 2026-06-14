// Multi-file preview engine for Lumina Computer.
//
// Given the full generated file tree, produce a runnable HTML document
// where every relative <link href>, <script src>, and <img src> resolves
// to a blob URL backed by a sibling file in the tree. This lets multi-file
// HTML+CSS+JS projects render correctly without manual stitching.

import type { LuminaFile } from "./parser";

const MIME: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
};

function mimeFor(path: string, lang: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] || MIME[lang] || "text/plain";
}

function normalize(href: string, base: string): string {
  if (!href || /^(https?:|data:|blob:|#|mailto:|javascript:)/i.test(href)) return href;
  // Strip leading ./ and / for matching against tree paths
  let p = href.replace(/^\.\//, "").replace(/^\//, "");
  // Resolve relative to base dir
  const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
  if (!p.startsWith(baseDir) && baseDir && !href.startsWith("/")) {
    const candidate = baseDir + p;
    return candidate;
  }
  return p;
}

interface BuildResult {
  doc: string;
  blobUrls: string[]; // caller revokes when preview unmounts/refreshes
}

/**
 * Build a complete runnable preview document from a multi-file project.
 * Returns the rewritten entry HTML plus the list of blob URLs created
 * (caller should URL.revokeObjectURL() on each when done).
 */
export function buildMultiFilePreview(
  entry: LuminaFile,
  allFiles: LuminaFile[],
): BuildResult {
  const created: string[] = [];
  const byPath = new Map<string, LuminaFile>();
  for (const f of allFiles) byPath.set(f.path.replace(/^\.\//, "").replace(/^\//, ""), f);

  // Pre-create blob URLs for every non-HTML asset so HTML can reference them.
  const urlByPath = new Map<string, string>();
  for (const [path, f] of byPath) {
    if (f.lang === "html" && path === entry.path) continue;
    const blob = new Blob([f.content], { type: mimeFor(path, f.lang) });
    const url = URL.createObjectURL(blob);
    urlByPath.set(path, url);
    created.push(url);
  }

  let html = entry.content;
  if (!/<!doctype html/i.test(html) && !/<html[\s>]/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  }

  // Rewrite href/src attributes that point to sibling files.
  const ATTR_RX = /\b(href|src)\s*=\s*("([^"]+)"|'([^']+)')/gi;
  html = html.replace(ATTR_RX, (_full, attr, _quoted, dq, sq) => {
    const raw = dq ?? sq ?? "";
    const resolved = normalize(raw, entry.path);
    const hit = urlByPath.get(resolved);
    if (hit) return `${attr}="${hit}"`;
    return `${attr}="${raw}"`;
  });

  // Inline any unreferenced sibling CSS/JS as a safety net (so projects
  // that forgot to link still render correctly).
  const referencedPaths = new Set<string>();
  const REF_RX = /\b(?:href|src)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  for (const m of html.matchAll(REF_RX)) referencedPaths.add(m[1] ?? m[2] ?? "");

  for (const [path, f] of byPath) {
    if (path === entry.path) continue;
    const url = urlByPath.get(path);
    if (url && Array.from(referencedPaths).some((r) => r === url)) continue;
    if (f.lang === "css") {
      html = html.replace(/<\/head>/i, `<style data-from="${path}">\n${f.content}\n</style></head>`);
    } else if (f.lang === "js" && !path.endsWith(".module.js")) {
      html = html.replace(/<\/body>/i, `<script data-from="${path}">\n${f.content}\n<\/script></body>`);
    }
  }

  return { doc: html, blobUrls: created };
}
