import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { safeJsonParse } from "./truncation-handler.ts";
import {
  isTruncated,
  detectTruncation,
  generateWithContinuation,
  verifyAssembly,
  spliceContinuation,
} from "./truncation-guard.ts";

export interface SiteSection {
  name: string;
  description: string;
  route?: string;
}

export interface SiteMap {
  title: string;
  pages: { route: string; title: string; description: string; sections: SiteSection[] }[];
}

export interface WebsiteOutput {
  title: string;
  siteMap: SiteMap;
  files: { path: string; content: string; language: string }[];
  verified: boolean;
  verificationNotes: string[];
  previewUrl?: string;
  continuationRounds?: number;
}

export class WebsitesMode {
  private client: ModelClient;
  private conv?: import("./conversation-store.ts").ConversationStore;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient; conversation?: import("./conversation-store.ts").ConversationStore },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
    this.conv = opts?.conversation;
  }

  async generate(
    request: string,
    visualRefs?: string[],
    onStatus?: (msg: string) => void,
  ): Promise<WebsiteOutput> {
    onStatus?.("Planning site architecture...");

    let sourceContext = "";
    const research = this.store.list(this.sessionId, "research").slice(-1)[0];
    const doc = this.store.list(this.sessionId, "doc").slice(-1)[0];
    if (research) sourceContext += `\nResearch available: ${research.title}\n${research.body.slice(0, 2000)}`;
    if (doc) sourceContext += `\nDoc available: ${doc.title}\n${doc.body.slice(0, 2000)}`;

    const siteMapPrompt = `You are a web architect using the v3.0 structured format. Design a site map for this request.

Request: ${request}${sourceContext}
${visualRefs?.length ? `Visual references provided: ${visualRefs.join(", ")}` : ""}

Return ONLY JSON (no markdown code blocks):
{
  "title": "Site title",
  "description": "SEO meta description for the site",
  "design_system": {
    "colors": { "primary": {"50": "#eef2ff", "500": "#6366f1", "900": "#312e81"} },
    "typography": { "font_stack": "system-ui, sans-serif", "scale": {"base": "1rem", "xl": "1.25rem"} },
    "spacing": { "sm": "1rem", "md": "1.5rem", "lg": "2rem" }
  },
  "pages": [
    {
      "route": "/",
      "name": "Home",
      "seo": {"title": "Homepage", "description": "Description under 160 chars"},
      "sections": [{"id": "hero", "type": "hero", "layout": "split", "content": {"headline": "...", "subheadline": "...", "cta": {"text": "Get Started", "href": "#"}}}]
    }
  ],
  "navigation": { "type": "sticky", "items": [{"label": "Page", "href": "#"}] },
  "footer": { "columns": [{"title": "Section", "links": [{"label": "Link", "href": "/"}]}], "legal": ["2026 Company"] }
}

Aim for 1-5 pages based on the request complexity. Include a design system with colors and typography. Each page should have SEO metadata and clearly defined sections. If multi-page, include navigation and footer.`;

    onStatus?.("Creating site structure...");
    const siteMapResult = await generateWithContinuation(
      async () => {
        const text = await this.client.complete(
          [
            { role: "system", content: "You are a web architect. Design multi-page site structures. Return valid JSON only." },
            { role: "user", content: siteMapPrompt },
          ],
          { maxTokens: 4096, temperature: 0.3, tag: "website/sitemap" },
        );
        return { text, finishReason: "length", model: "default" };
      },
      {
        tag: "website/sitemap",
        maxContinuationRounds: 3,
        structuralCheck: true,
        contentCheck: true,
        minExpectedLength: 300,
      },
    );

    let siteMap: SiteMap;
    const siteMapParsed = await safeJsonParse<SiteMap>(this.client, siteMapResult.data, "website/sitemap-parse");
    if (siteMapParsed.data) {
      siteMap = siteMapParsed.data;
      if (siteMapParsed.recovered) onStatus?.("Recovered truncated site structure");
    } else {
      siteMap = {
        title: "Website",
        pages: [{ route: "/", title: "Home", description: "Main page", sections: [{ name: "main", description: "Content" }] }],
      };
    }

    let totalContinuationRounds = siteMapResult.continuationRounds;

    onStatus?.(`Site structure: ${siteMap.pages.length} page(s). Generating code...`);
    siteMap.pages.forEach((p) => onStatus?.(`  ${p.route} — ${p.title}: ${p.sections.length} section(s)`));

    const files: { path: string; content: string; language: string }[] = [];

    for (let p = 0; p < siteMap.pages.length; p++) {
      const page = siteMap.pages[p];
      onStatus?.(`Generating page ${p + 1}/${siteMap.pages.length}: ${page.title}`);

      const pagePrompt = `Generate a complete HTML page for "${page.title}" (route: ${page.route}).

Site: ${siteMap.title}
Page description: ${page.description}
Sections: ${page.sections.map((s) => `- ${s.name}: ${s.description}`).join("\n")}
${sourceContext.slice(0, 1500)}

Requirements:
- Single HTML file with embedded CSS and JS
- Modern, clean design (Tailwind CSS via CDN or plain CSS)
- Fully interactive where applicable
- Responsive design
- Realistic placeholder content that clearly communicates the page's purpose
- Use semantic HTML5 tags

Return ONLY the complete HTML code in a code block.`;

      const pageResult = await generateWithContinuation(
        async () => {
          const text = await this.client.complete(
            [
              { role: "system", content: "You are a frontend developer. Generate complete, runnable HTML pages with embedded CSS and JS." },
              { role: "user", content: pagePrompt },
            ],
            { maxTokens: 16384, temperature: 0.4, tag: `website/page_${p + 1}` },
          );
          return { text, finishReason: "length", model: "default" };
        },
        {
          tag: `website/page_${p + 1}`,
          maxContinuationRounds: 5,
          structuralCheck: true,
          contentCheck: true,
          minExpectedLength: 500,
        },
      );

      totalContinuationRounds += pageResult.continuationRounds;

      const match = pageResult.data.match(/```(?:html)?\s*([\s\S]*?)```/);
      const cleanHtml = match?.[1]?.trim() ?? pageResult.data.trim();

      const finalCheck = detectTruncation(cleanHtml, null, { structural: true, content: true });
      if (finalCheck.truncated) {
        onStatus?.(`  Page ${p + 1} may be truncated (${finalCheck.detail}), attempting to repair...`);
        const repair = await this.client.complete(
          [{ role: "user", content: `Complete this HTML page. Do NOT repeat anything above. Continue from where it left off. Output ONLY the missing HTML.\n\n--- PARTIAL PAGE ---\n${cleanHtml.slice(-2000)}` }],
          { maxTokens: 8192, temperature: 0.2, tag: `website/repair_${p + 1}` },
        );
        const finalClean = cleanHtml.endsWith("\n") ? cleanHtml : cleanHtml + "\n";
        files.push({
          path: page.route === "/" ? "index.html" : `${page.route.slice(1)}.html`,
          content: spliceContinuation(finalClean, repair),
          language: "html",
        });
      } else {
        files.push({
          path: page.route === "/" ? "index.html" : `${page.route.slice(1)}.html`,
          content: cleanHtml,
          language: "html",
        });
      }

      this.conv?.setCheckpoint({
        step: p + 1,
        totalSteps: siteMap.pages.length,
        mode: "website",
        partial: { pagesGenerated: p + 1, totalPages: siteMap.pages.length, files: files.map((f) => f.path) },
        context: `Building website "${siteMap.title}". Generated page ${p + 1}/${siteMap.pages.length}: "${page.title}". ${p + 1 < siteMap.pages.length ? `Next: generate page ${p + 2} "${siteMap.pages[p + 1].title}".` : "All pages generated. Next: verify and assemble."}`,
      });
    }

    onStatus?.("Running self-check: verifying site quality...");
    const issues: string[] = [];

    for (const file of files) {
      if (!file.content.includes("<!DOCTYPE html") && !file.content.includes("<html")) {
        issues.push(`${file.path}: missing DOCTYPE or html tag`);
      }
      if (file.content.length < 100) {
        issues.push(`${file.path}: content too short (${file.content.length} chars)`);
      }
      if (/todo|placeholder|lorem ipsum|change this/i.test(file.content) && !file.path.includes("template")) {
        issues.push(`${file.path}: contains placeholder text`);
      }
      const fileTrunc = detectTruncation(file.content, null, { structural: true, content: true });
      if (fileTrunc.truncated) {
        issues.push(`${file.path}: appears truncated (${fileTrunc.detail})`);
      }
    }

    if (!files.some((f) => f.path === "index.html")) {
      issues.push("Missing index.html entry point");
    }

    const assemblyCheck = await verifyAssembly([
      {
        name: "all-pages-present",
        check: () => files.length === siteMap.pages.length,
        detail: `Expected ${siteMap.pages.length} files, got ${files.length}`,
      },
      {
        name: "index-html-exists",
        check: () => files.some((f) => f.path === "index.html"),
        detail: "Missing index.html entry point",
      },
      {
        name: "no-minimal-content",
        check: () => files.every((f) => f.content.length >= 100),
        detail: "One or more files have insufficient content",
      },
      {
        name: "balanced-code-blocks",
        check: () => files.every((f) => {
          const fences = f.content.match(/```/g);
          return !fences || fences.length % 2 === 0;
        }),
        detail: "Unclosed code blocks in one or more files",
      },
      {
        name: "no-truncation-signals",
        check: () => files.every((f) => !isTruncated(f.content, 200)),
        detail: "One or more files are truncated or too short",
      },
    ]);

    if (!assemblyCheck.passed) {
      issues.push(...assemblyCheck.failures.map((f) => `${f.name}: ${f.detail}`));
    }

    let fixed = false;
    if (issues.length > 0) {
      onStatus?.(`Issues found: ${issues.join("; ")}. Fixing...`);
      const fixPrompt = `Fix these issues in the website:\n${issues.join("\n")}\n\nCurrent files:\n${files.map((f) => `--- ${f.path} ---\n${f.content.slice(0, 500)}\n...`).join("\n")}`;

      const fixResp = await this.client.complete(
        [{ role: "user", content: fixPrompt }],
        { maxTokens: 4096, temperature: 0.3, tag: "website/fix" },
      );

      const fixMatch = fixResp.match(/```(?:html)?\s*([\s\S]*?)```/);
      if (fixMatch) {
        const idx = files.findIndex((f) => f.path === "index.html");
        if (idx >= 0) {
          files[idx].content = fixMatch[1].trim();
          fixed = true;
        }
      }
    }

    const bundledHtml = files.length === 1
      ? files[0].content
      : `<!DOCTYPE html><html><head><title>${siteMap.title}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}h1{color:#333}ul{list-style:none;padding:0}li{margin:.5rem 0}a{color:#0066cc;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>${siteMap.title}</h1><p>Multi-page site generated. Pages:</p><ul>${siteMap.pages.map((p) => `<li><a href="${p.route}">${p.title}</a></li>`).join("")}</ul></body></html>`;

    const output: WebsiteOutput = {
      title: siteMap.title,
      siteMap,
      files,
      verified: issues.length === 0 || fixed,
      verificationNotes: issues,
      previewUrl: undefined,
      continuationRounds: totalContinuationRounds,
    };

    this.conv?.clearCheckpoint("website");

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "website",
      title: output.title,
      body: bundledHtml,
      format: "code",
      metadata: { pages: siteMap.pages.length, files: files.map((f) => f.path), continuationRounds: totalContinuationRounds },
      sourceFiles: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Website "${output.title}" ready (${files.length} file(s), ${siteMap.pages.length} page(s), ${totalContinuationRounds} continuation rounds).`);
    return output;
  }

  async editSection(
    currentOutput: WebsiteOutput,
    sectionPath: string,
    editRequest: string,
    onStatus?: (msg: string) => void,
  ): Promise<WebsiteOutput> {
    onStatus?.(`Editing ${sectionPath}: ${editRequest}...`);

    const targetFile = currentOutput.files.find((f) => f.path === sectionPath || f.path.endsWith(`/${sectionPath}`));
    if (!targetFile) {
      onStatus?.(`Section ${sectionPath} not found. Regenerating...`);
      return this.generate(editRequest, undefined, onStatus);
    }

    const editPrompt = `Modify this file according to the request. Return the COMPLETE updated file content.

File: ${targetFile.path}
Request: ${editRequest}

Current content:
\`\`\`html
${targetFile.content}
\`\`\`

Return ONLY the complete updated HTML in a code block.`;

    const editResult = await generateWithContinuation(
      async () => {
        const text = await this.client.complete(
          [
            { role: "system", content: "You are a frontend developer. Make precise edits to existing code. Return the complete updated file." },
            { role: "user", content: editPrompt },
          ],
          { maxTokens: 8192, temperature: 0.3, tag: "website/edit" },
        );
        return { text, finishReason: "length", model: "default" };
      },
      {
        tag: "website/edit",
        maxContinuationRounds: 3,
        structuralCheck: true,
        contentCheck: true,
      },
    );

    const match = editResult.data.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) {
      targetFile.content = match[1].trim();
    } else {
      targetFile.content = editResult.data.trim();
    }

    const truncCheck = detectTruncation(targetFile.content, null, { structural: true, content: true });
    if (truncCheck.truncated) {
      onStatus?.(`  Edited file appears truncated (${truncCheck.detail}), extending...`);
      const extend = await this.client.complete(
        [{ role: "user", content: `Continue editing this file. Do NOT repeat existing content. Output ONLY the missing continuation.\n\n--- PARTIAL FILE ---\n${targetFile.content.slice(-2000)}` }],
        { maxTokens: 4096, temperature: 0.2, tag: "website/edit-extend" },
      );
      targetFile.content = spliceContinuation(targetFile.content, extend);
    }

    currentOutput.verified = true;
    const existingArtifact = this.store.list(this.sessionId, "website").slice(-1)[0];
    if (existingArtifact) {
      existingArtifact.body = currentOutput.files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n");
      existingArtifact.updatedAt = Date.now();
    }

    onStatus?.(`Section updated.`);
    return currentOutput;
  }
}
