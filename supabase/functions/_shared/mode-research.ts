import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";

export interface ResearchSource {
  url?: string;
  title: string;
  type: "web" | "pdf" | "data";
  summary: string;
  relevance: "high" | "medium" | "low";
}

export interface ResearchPlan {
  topic: string;
  scope: string;
  sources: ResearchSource[];
  estimatedDepth: number;
}

export interface ResearchProgress {
  phase: "clarifying" | "planning" | "collecting" | "analyzing" | "writing" | "verifying";
  message: string;
  percent: number;
}

export interface ResearchOutput {
  topic: string;
  summary: string;
  sections: { heading: string; content: string; sources: string[] }[];
  sources: ResearchSource[];
  format: "markdown" | "html";
  verified: boolean;
  verificationNotes: string[];
}

export class DeepResearchMode {
  private client: ModelClient;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
  }

  private progress(callback: ((p: ResearchProgress) => void) | undefined, p: ResearchProgress): void {
    callback?.(p);
  }

  async generate(
    request: string,
    onProgress?: (p: ResearchProgress) => void,
    onStatus?: (msg: string) => void,
  ): Promise<ResearchOutput> {
    this.progress(onProgress, { phase: "clarifying", message: "Understanding research scope...", percent: 5 });

    if (/fiction|story|poem|creative writing/i.test(request) && !/research|analyze|source/i.test(request)) {
      throw new Error("This task appears to be creative writing, not research. Please use chat mode for creative tasks.");
    }

    const files = this.store.getFiles(this.sessionId);
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\nUploaded files for context:\n" +
        files.map((f) => `- ${f.name}: ${f.content.slice(0, 2000)}`).join("\n");
    }

    this.progress(onProgress, { phase: "planning", message: "Creating research plan...", percent: 10 });
    onStatus?.("Designing research plan...");

    const planPrompt = `You are a research planner. Create a detailed research plan.

Topic: ${request}${fileContext}

Return ONLY JSON:
{
  "topic": "refined topic title",
  "scope": "description of research scope (what's in, what's out)",
  "search_queries": ["query 1", "query 2", ...],
  "key_questions": ["question 1", "question 2", ...],
  "estimated_depth": "brief|moderate|deep",
  "sections_planned": ["section 1", "section 2", ...]
}

Generate 5-15 search queries covering different angles of the topic.
Prefer queries that would find original/primary sources over aggregators.`;

    const planResp = await this.client.complete(
      [
        { role: "system", content: "You are a research methodologist. Design comprehensive research plans. Return JSON only." },
        { role: "user", content: planPrompt },
      ],
      { maxTokens: 4096, temperature: 0.3, tag: "research/plan" },
    );

    let plan: {
      topic: string;
      scope: string;
      search_queries: string[];
      key_questions: string[];
      estimated_depth: string;
      sections_planned: string[];
    };
    try {
      plan = JSON.parse(planResp);
    } catch {
      plan = {
        topic: request.slice(0, 100),
        scope: "General research",
        search_queries: [request],
        key_questions: ["What are the key findings?"],
        estimated_depth: "moderate",
        sections_planned: ["Overview", "Key Findings", "Conclusion"],
      };
    }

    this.progress(onProgress, {
      phase: "collecting",
      message: `Researching: ${plan.search_queries.length} queries planned across ${plan.sections_planned.length} sections`,
      percent: 15,
    });
    onStatus?.(`Research plan: ${plan.sections_planned.length} sections, ${plan.search_queries.length} queries`);

    const sources: ResearchSource[] = [];
    const sectionFindings: Record<string, string[]> = {};

    for (let i = 0; i < plan.sections_planned.length; i++) {
      const section = plan.sections_planned[i];
      this.progress(onProgress, {
        phase: "collecting",
        message: `Researching section ${i + 1}/${plan.sections_planned.length}: ${section}`,
        percent: 15 + Math.round((i / plan.sections_planned.length) * 50),
      });
      onStatus?.(`Section ${i + 1}/${plan.sections_planned.length}: ${section}`);

      const sectionPrompt = `Research for section: "${section}" of topic: "${plan.topic}"

Key questions to address: ${plan.key_questions.join(", ")}

Relevant search queries: ${plan.search_queries.slice(0, 3).join(", ")}

Provide research findings for this section. Include:
- Key facts, data points, and findings
- Sources you would reference (title, type, brief summary)
- Analysis and synthesis of the information

Format as structured research notes.`;

      const findings = await this.client.complete(
        [
          { role: "system", content: "You are a research analyst. Gather and synthesize information. Focus on accuracy and primary sources." },
          { role: "user", content: sectionPrompt },
        ],
        { maxTokens: 8192, temperature: 0.4, tag: `research/section_${i + 1}` },
      );

      sectionFindings[section] = [findings];

      const extractPrompt = `From this research text, extract all cited/referenced sources as JSON array:
[{"title": "...", "type": "web|pdf|data", "summary": "...", "relevance": "high|medium|low"}]

Text: ${findings.slice(0, 3000)}`;

      try {
        const sourceExtract = await this.client.complete(
          [{ role: "user", content: extractPrompt }],
          { maxTokens: 2048, temperature: 0.2, tag: "research/extract-sources" },
        );
        const parsed = JSON.parse(sourceExtract);
        if (Array.isArray(parsed)) {
          sources.push(...parsed);
        }
      } catch {
        // source extraction failed, continue
      }
    }

    this.progress(onProgress, { phase: "analyzing", message: "Analyzing and cross-referencing findings...", percent: 70 });
    onStatus?.("Analyzing findings across all sections...");

    const allFindings = Object.entries(sectionFindings)
      .map(([section, findings]) => `## ${section}\n${findings.join("\n\n")}`)
      .join("\n\n");

    const analysisPrompt = `Synthesize these research findings into a coherent report.

Topic: ${plan.topic}
Scope: ${plan.scope}

Research findings by section:
${allFindings}

Sources identified: ${sources.length}

Write a comprehensive research output. Include:
1. Executive summary (2-3 paragraphs)
2. Detailed findings organized by the planned sections
3. Key data points with context
4. Contradictions or debates in the field
5. Gaps and areas for further research

Format in markdown with proper headings and citations.`;

    this.progress(onProgress, { phase: "writing", message: "Writing research report...", percent: 80 });
    onStatus?.("Writing research report...");

    const report = await this.client.complete(
      [
        { role: "system", content: "You are a research writer creating a comprehensive, well-sourced report. Be thorough and accurate." },
        { role: "user", content: analysisPrompt },
      ],
      { maxTokens: 16384, temperature: 0.4, tag: "research/write" },
    );

    this.progress(onProgress, { phase: "verifying", message: "Verifying research quality...", percent: 90 });
    onStatus?.("Verifying research quality...");

    const issues: string[] = [];
    if (report.length < 500) issues.push("Report is too short");
    if (sources.length < 3) issues.push("Fewer than 3 sources referenced");
    if (/lorem ipsum|todo|placeholder/i.test(report)) issues.push("Contains placeholder content");
    if (/\.\.\.\s*$/.test(report.trim())) issues.push("Report appears truncated");

    const uniqueSources = sources.filter((s, i, a) => a.findIndex((x) => x.title === s.title) === i);
    const sections = report.split(/^## /m).filter(Boolean);

    const output: ResearchOutput = {
      topic: plan.topic,
      summary: report.split("\n").slice(0, 5).join("\n"),
      sections: sections.map((s) => {
        const lines = s.split("\n");
        return { heading: lines[0] ?? "Section", content: lines.slice(1).join("\n"), sources: [] };
      }),
      sources: uniqueSources,
      format: "markdown",
      verified: issues.length === 0,
      verificationNotes: issues,
    };

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "research",
      title: output.topic,
      body: report,
      format: "markdown",
      metadata: { sections: output.sections.length, sources: uniqueSources.length, depth: plan.estimated_depth },
      sourceFiles: files.map((f) => f.name),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    this.progress(onProgress, { phase: "verifying", message: "Research complete.", percent: 100 });
    onStatus?.(`Research "${output.topic}" complete (${output.sections.length} sections, ${uniqueSources.length} sources).`);
    return output;
  }

  async followUp(
    question: string,
    previousOutput: ResearchOutput,
    onProgress?: (p: ResearchProgress) => void,
    onStatus?: (msg: string) => void,
  ): Promise<ResearchOutput> {
    this.progress(onProgress, { phase: "clarifying", message: "Understanding follow-up...", percent: 5 });
    onStatus?.("Processing follow-up question...");

    const context = `Previous research topic: ${previousOutput.topic}
Previous findings summary: ${previousOutput.summary.slice(0, 1000)}
Previous sections: ${previousOutput.sections.map((s) => s.heading).join(", ")}

Follow-up: ${question}`;

    const fresh = await this.generate(context, onProgress, onStatus);

    const combined: ResearchOutput = {
      topic: previousOutput.topic,
      summary: fresh.summary,
      sections: [...previousOutput.sections, ...fresh.sections],
      sources: [...previousOutput.sources, ...fresh.sources].filter(
        (s, i, a) => a.findIndex((x) => x.title === s.title) === i,
      ),
      format: "markdown",
      verified: fresh.verified,
      verificationNotes: fresh.verificationNotes,
    };

    const existingArtifact = this.store.list(this.sessionId, "research").find((a) => a.title === previousOutput.topic);
    if (existingArtifact) {
      existingArtifact.body += `\n\n## Follow-up: ${question}\n\n${combined.sections.slice(-fresh.sections.length).map((s) => `### ${s.heading}\n${s.content}`).join("\n\n")}`;
      existingArtifact.updatedAt = Date.now();
    }

    return combined;
  }
}
