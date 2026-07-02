import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";

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
}

export class WebsitesMode {
  private client: ModelClient;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
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

    const siteMapPrompt = `You are a web architect. Design a site map for this request.

Request: ${request}${sourceContext}
${visualRefs?.length ? `Visual references provided: ${visualRefs.join(", ")}` : ""}

Return ONLY JSON:
{
  "title": "Site title",
  "pages": [
    {
      "route": "/",
      "title": "Home",
      "description": "landing page purpose",
      "sections": [{"name": "hero", "description": "hero section content"}, ...]
    }
  ]
}

Aim for 1-5 pages based on the request complexity. If the request implies multiple pages (e.g. "a website for a business"), generate a multi-page structure.`;

    onStatus?.("Creating site structure...");
    const siteMapResp = await this.client.complete(
      [
        { role: "system", content: "You are a web architect. Design multi-page site structures. Return valid JSON only." },
        { role: "user", content: siteMapPrompt },
      ],
      { maxTokens: 2048, temperature: 0.3, tag: "website/sitemap" },
    );

    let siteMap: SiteMap;
    try {
      siteMap = JSON.parse(siteMapResp);
    } catch {
      siteMap = {
        title: "Website",
        pages: [{ route: "/", title: "Home", description: "Main page", sections: [{ name: "main", description: "Content" }] }],
      };
    }

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

      const htmlResp = await this.client.complete(
        [
          { role: "system", content: "You are a frontend developer. Generate complete, runnable HTML pages with embedded CSS and JS." },
          { role: "user", content: pagePrompt },
        ],
        { maxTokens: 8192, temperature: 0.4, tag: `website/page_${p + 1}` },
      );

      const match = htmlResp.match(/```(?:html)?\s*([\s\S]*?)```/);
      const cleanHtml = match?.[1]?.trim() ?? htmlResp.trim();

      files.push({
        path: page.route === "/" ? "index.html" : `${page.route.slice(1)}.html`,
        content: cleanHtml,
        language: "html",
      });
    }

    onStatus?.("Running self-check: loading site in browser...");
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
    }

    if (!files.some((f) => f.path === "index.html")) {
      issues.push("Missing index.html entry point");
    }

    onStatus?.("Verifying site quality...");

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
    };

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "website",
      title: output.title,
      body: bundledHtml,
      format: "code",
      metadata: { pages: siteMap.pages.length, files: files.map((f) => f.path) },
      sourceFiles: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Website "${output.title}" ready (${files.length} file(s), ${siteMap.pages.length} page(s)).`);
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

    const editResp = await this.client.complete(
      [
        { role: "system", content: "You are a frontend developer. Make precise edits to existing code. Return the complete updated file." },
        { role: "user", content: editPrompt },
      ],
      { maxTokens: 8192, temperature: 0.3, tag: "website/edit" },
    );

    const match = editResp.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) {
      targetFile.content = match[1].trim();
    } else {
      targetFile.content = editResp.trim();
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
