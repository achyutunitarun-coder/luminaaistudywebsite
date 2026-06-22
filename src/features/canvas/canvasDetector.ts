/**
 * Canvas detector - detects code artifacts in AI responses
 */

export interface DetectedArtifact {
  code: string;
  lang: string;
}

export function detectCanvas(text: string): DetectedArtifact | null {
  // Detect HTML code blocks
  const htmlMatch = text.match(/```html\s*\n([\s\S]*?)```/i);
  if (htmlMatch) {
    return { code: htmlMatch[1].trim(), lang: "html" };
  }

  // Detect JavaScript code blocks
  const jsMatch = text.match(/```(?:javascript|js)\s*\n([\s\S]*?)```/i);
  if (jsMatch) {
    return { code: jsMatch[1].trim(), lang: "javascript" };
  }

  // Detect CSS code blocks
  const cssMatch = text.match(/```css\s*\n([\s\S]*?)```/i);
  if (cssMatch) {
    return { code: cssMatch[1].trim(), lang: "css" };
  }

  // Detect full HTML documents
  const fullHtmlMatch = text.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
  if (fullHtmlMatch) {
    return { code: fullHtmlMatch[0], lang: "html" };
  }

  return null;
}

export function wrapAsHtmlDoc(code: string, lang: string): string {
  // If it's already a full HTML document, return as-is
  if (/<!doctype html|<html/i.test(code)) {
    return code;
  }

  // If it's a code snippet, wrap in a basic HTML template
  if (lang === "html" && !code.trim().startsWith("<")) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
  </style>
</head>
<body>
${code}
</body>
</html>`;
  }

  return code;
}
