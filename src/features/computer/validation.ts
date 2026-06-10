import type { LuminaFile } from "@/features/computer/parser";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  fix: string;
}

const STOPWORDS = new Set([
  "build", "make", "create", "generate", "design", "page", "app", "website", "tool",
  "interactive", "beautiful", "stunning", "production", "level", "with", "about", "for",
  "from", "into", "using", "please", "lumina", "computer", "full", "complete", "code",
]);

function requestKeywords(request: string): string[] {
  return Array.from(
    new Set(
      request
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 6 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 8);
}

function hasBalancedBraces(text: string) {
  let curly = 0;
  let round = 0;
  let square = 0;
  for (const ch of text) {
    if (ch === "{") curly++;
    if (ch === "}") curly--;
    if (ch === "(") round++;
    if (ch === ")") round--;
    if (ch === "[") square++;
    if (ch === "]") square--;
    if (curly < -2 || round < -2 || square < -2) return false;
  }
  return Math.abs(curly) <= 1 && Math.abs(round) <= 1 && Math.abs(square) <= 1;
}

export function validateLuminaProject(files: LuminaFile[], request: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const combined = files.map((f) => `\n--- ${f.path} ---\n${f.content}`).join("\n");
  const lowerCombined = combined.toLowerCase();
  const htmlFiles = files.filter((f) => f.lang === "html" || f.path.endsWith(".html"));
  const jsFiles = files.filter((f) => /\.(js|jsx|ts|tsx)$/i.test(f.path));

  if (files.length === 0) {
    issues.push({
      id: "no-files",
      severity: "error",
      title: "No files produced",
      detail: "The model response did not contain any complete Lumina file blocks.",
      fix: "Regenerate as full <lumina:file> blocks with index.html as the runnable entry point.",
    });
  }

  const openFiles = files.filter((f) => !f.done);
  if (openFiles.length) {
    issues.push({
      id: "unfinished-files",
      severity: "error",
      title: "Unfinished file block",
      detail: `${openFiles.map((f) => f.path).join(", ")} did not close cleanly.`,
      fix: "Finish the incomplete files or regenerate the project with fully closed tags and braces.",
    });
  }

  if (files.length > 0 && htmlFiles.length === 0 && /\b(app|website|page|dashboard|game|visuali[sz]er|ui|html)\b/i.test(request)) {
    issues.push({
      id: "missing-html-entry",
      severity: "error",
      title: "Missing runnable entry point",
      detail: "A visual application request must include an index.html file for preview.",
      fix: "Create a complete standalone index.html wired to all styles and scripts.",
    });
  }

  for (const file of htmlFiles) {
    const html = file.content.toLowerCase();
    if (!html.includes("<!doctype") || !html.includes("<html") || !html.includes("</html>")) {
      issues.push({
        id: `invalid-html-${file.path}`,
        severity: "error",
        title: "HTML document is incomplete",
        detail: `${file.path} must be a full document with <!doctype html>, <html>, and </html>.`,
        fix: "Regenerate the file as a complete standalone document.",
      });
    }
    if (!html.includes("<meta name=\"viewport\"") && !html.includes("<meta name='viewport'")) {
      issues.push({
        id: `missing-viewport-${file.path}`,
        severity: "warning",
        title: "Missing responsive viewport",
        detail: `${file.path} may render poorly on mobile without a viewport meta tag.`,
        fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />.",
      });
    }
  }

  const keywords = requestKeywords(request);
  const missingKeywords = keywords.filter((word) => !lowerCombined.includes(word));
  if (keywords.length > 0 && missingKeywords.length === keywords.length) {
    issues.push({
      id: "request-subject-missing",
      severity: "error",
      title: "Request subject is missing",
      detail: `The output does not visibly include the request topic (${keywords.slice(0, 4).join(", ")}).`,
      fix: "Put the user's exact subject in the H1, navigation, cards, data, and interactions.",
    });
  }

  if (/lorem ipsum|todo\b|coming soon|placeholder|item 1|item 2|rest unchanged|\.\.\.\s*(<|$)/i.test(combined)) {
    issues.push({
      id: "placeholder-content",
      severity: "error",
      title: "Placeholder or truncated content",
      detail: "Production output cannot contain lorem ipsum, TODOs, placeholder labels, ellipses, or rest-unchanged markers.",
      fix: "Replace every placeholder with realistic domain-specific content and complete implementation.",
    });
  }

  const visualRequest = /\b(app|website|page|dashboard|game|visuali[sz]er|ui|landing|tool|simulator)\b/i.test(request);
  if (visualRequest && combined.length > 0 && combined.length < 3500) {
    issues.push({
      id: "too-thin",
      severity: "warning",
      title: "Output is too thin",
      detail: "The artifact is below the expected density for a production visual build.",
      fix: "Add a richer layout, real data, interactive states, responsive behavior, and polished microcopy.",
    });
  }

  for (const file of jsFiles) {
    if (!hasBalancedBraces(file.content)) {
      issues.push({
        id: `unbalanced-code-${file.path}`,
        severity: "error",
        title: "Potential syntax break",
        detail: `${file.path} has suspiciously unbalanced braces or parentheses.`,
        fix: "Patch only the broken module and re-validate imports and runtime behavior.",
      });
    }
  }

  return issues;
}

export function buildRepairPrompt(request: string, files: LuminaFile[], issues: ValidationIssue[]) {
  const fileDump = files
    .map((f) => `<current-file path="${f.path}" lang="${f.lang}">\n${f.content}\n</current-file>`)
    .join("\n\n")
    .slice(0, 140_000);

  return `SELF_HEAL_LUMINA_PROJECT

Original user request:
${request}

Validator found these blocking issues:
${issues.map((i) => `- [${i.severity}] ${i.title}: ${i.detail} Fix: ${i.fix}`).join("\n")}

Current generated files:
${fileDump}

Repair directive:
Return a COMPLETE corrected Lumina project using <lumina:plan>, full <lumina:file> blocks, <lumina:action type="open" target="index.html" />, <lumina:action type="run" target="index.html" />, and <lumina:final>.
Do not apologize. Do not explain outside tags. Preserve working parts, but regenerate any broken/thin/generic module. The user's exact subject must be visible in the first viewport.`;
}

export function summarizeValidation(issues: ValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  if (!issues.length) return "Validation passed";
  return `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
}