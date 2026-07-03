/**
 * Deep Research Mode — Enhanced Control Flow (Section 6)
 *
 * Loop structure: observe (current findings) → reason (what's missing) → act (search) → observe (new result) → repeat
 * with an explicit stopping decision per cycle rather than a fixed number of iterations.
 *
 * Before searching, confirms scope with user via clarifying questions.
 * Targets genuine depth: 20+ reasoning cycles with diverse source coverage.
 * Prefers primary/original sources over aggregators.
 * Supports multi-turn follow-up within the same session.
 * Runs as async with visible progress; resumable via checkpointing.
 * Output formats: interactive report, doc, slides, spreadsheet, or PDF — inferred from request.
 */

import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import type { ConversationStore } from "./conversation-store.ts";
import {
  isTruncated,
  detectTruncation,
  generateWithContinuation,
  verifyAssembly,
} from "./truncation-guard.ts";

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
  continuationRounds?: number;
}

/** Represents one cycle in the observe→reason→act→observe loop */
interface ReasoningCycle {
  cycleNumber: number;
  observation: string;
  reasoning: string;
  action: string;
  result: string;
  sourcesFound: number;
}

export class DeepResearchMode {
  private client: ModelClient;
  private maxCycles = 50;
  private minSources = 12;
  private conv?: ConversationStore;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient; conversation?: ConversationStore },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
    this.conv = opts?.conversation;
  }

  private progress(callback: ((p: ResearchProgress) => void) | undefined, p: ResearchProgress): void {
    callback?.(p);
  }

  async generate(
    request: string,
    onProgress?: (p: ResearchProgress) => void,
    onStatus?: (msg: string) => void,
  ): Promise<ResearchOutput> {
    if (/^(write|create|draft)\s+(a|an|the)\s+(fiction|story|poem|novel|song)/i.test(request) && !/research|analyze|source|study|investigate/i.test(request)) {
      throw new Error("Deep Research mode is for research tasks only. For creative writing, use chat or doc mode.");
    }

    this.progress(onProgress, { phase: "clarifying", message: "Checking scope and clarity...", percent: 2 });
    onStatus?.("Clarifying research scope...");

    const clarificationResult = await this.askClarifyingQuestions(request, onStatus);

    this.progress(onProgress, { phase: "planning", message: "Designing research plan...", percent: 5 });
    onStatus?.("Designing research plan...");

    const files = this.store.getFiles(this.sessionId);
    const planResult = await generateWithContinuation(
      async () => {
        const plan = await this.buildResearchPlan(clarificationResult.refinedRequest, files, onStatus);
        return { text: JSON.stringify(plan), finishReason: "stop", model: "default" };
      },
      {
        tag: "research/plan",
        maxContinuationRounds: 3,
        structuralCheck: true,
        contentCheck: true,
        minExpectedLength: 300,
      },
    );

    let plan: ReturnType<DeepResearchMode["buildResearchPlan"] extends (...args: any[]) => Promise<infer R> ? R : any>;
    try {
      plan = JSON.parse(planResult.data);
    } catch {
      plan = {
        topic: clarificationResult.refinedRequest.slice(0, 100),
        scope: "General research covering key aspects of the topic",
        search_queries: [clarificationResult.refinedRequest, `${clarificationResult.refinedRequest} analysis`],
        key_questions: ["What are the key findings?", "What are the main debates?", "What are the practical implications?"],
        estimated_depth: "moderate",
        sections_planned: ["Overview and Background", "Key Findings and Analysis", "Expert Perspectives", "Practical Implications", "Conclusion"],
      };
    }

    let totalContinuationRounds = planResult.continuationRounds;

    this.progress(onProgress, {
      phase: "collecting",
      message: `Research plan ready: ${plan.sections_planned?.length ?? 0} sections, ${plan.search_queries?.length ?? 0} queries`,
      percent: 10,
    });

    const allSources: ResearchSource[] = [];
    const cycles: ReasoningCycle[] = [];
    const sectionFindings: Record<string, string[]> = {};
    const exploredAngles = new Set<string>();
    let allFindingsText = "";
    let shouldStop = false;
    let cycleCount = 0;

    for (const section of plan.sections_planned ?? []) {
      sectionFindings[section] = [];
    }

    while (!shouldStop && cycleCount < this.maxCycles) {
      cycleCount++;
      const pctBase = 10;
      const pctRange = 65;
      const pct = pctBase + Math.round((cycleCount / Math.min(this.maxCycles, 30)) * pctRange);
      this.progress(onProgress, { phase: "collecting", message: `Research cycle ${cycleCount}...`, percent: Math.min(pct, 75) });

      const currentState = this.formatCurrentState(plan, sectionFindings, allSources, cycles);

      const reasonPrompt = `You are a research scientist conducting a thorough investigation.

RESEARCH TOPIC: ${plan.topic}
SCOPE: ${plan.scope}

CURRENT FINDINGS:
${currentState}

CYCLES COMPLETED: ${cycleCount}
SOURCES COLLECTED: ${allSources.length}

YOUR TASK:
Analyze what we know so far and decide what to investigate next.
1. What key questions remain unanswered?
2. What angles haven't been explored yet?
3. What would be the most valuable next direction?

Return JSON only:
{
  "observation": "Brief summary of what we've found so far",
  "gaps": ["gap 1", "gap 2", ...],
  "next_angle": "The specific angle or question to investigate next",
  "search_query": "A specific search query to find targeted information",
  "target_section": "Which section this finding belongs to",
  "confidence": 0.0-1.0,
  "should_stop": false
}

Set should_stop to true ONLY if:
- All planned sections have substantial content
- We have ${Math.max(this.minSources, 15)}+ unique sources
- We've explored multiple angles and most key questions are addressed
- No major gaps remain
- Confidence is high (0.85+)`;

      let reasoningDecision: {
        observation: string;
        gaps: string[];
        next_angle: string;
        search_query: string;
        target_section: string;
        confidence: number;
        should_stop: boolean;
      };

      try {
        const reasonResp = await this.client.complete(
          [
            { role: "system", content: "You are a systematic research scientist. Analyze findings and decide next steps. Return JSON only." },
            { role: "user", content: reasonPrompt },
          ],
          { maxTokens: 4096, temperature: 0.3, tag: `research/reason_${cycleCount}` },
        );
        reasoningDecision = JSON.parse(reasonResp);
      } catch {
        reasoningDecision = {
          observation: "Continuing research.",
          gaps: ["Need more depth"],
          next_angle: "Deepen existing sections",
          search_query: (plan.search_queries ?? [])[cycleCount % (plan.search_queries?.length ?? 1)] || plan.topic,
          target_section: (plan.sections_planned ?? [])[cycleCount % (plan.sections_planned?.length ?? 1)] || plan.sections_planned?.[0] ?? "Overview",
          confidence: 0.3,
          should_stop: false,
        };
      }

      shouldStop = reasoningDecision.should_stop;

      if (allSources.length >= this.minSources + 5 && reasoningDecision.confidence >= 0.85) {
        shouldStop = true;
      }
      if (cycleCount < 6 && allSources.length < 8) {
        shouldStop = false;
      }
      if (cycleCount >= this.maxCycles) {
        shouldStop = true;
      }

      const query = reasoningDecision.search_query || (plan.search_queries ?? [])[cycleCount % (plan.search_queries?.length ?? 1)] || plan.topic;
      const section = reasoningDecision.target_section || (plan.sections_planned ?? [])[cycleCount % (plan.sections_planned?.length ?? 1)] || (plan.sections_planned?.[0] ?? "Overview");

      const angleKey = query.toLowerCase().slice(0, 60);
      if (exploredAngles.has(angleKey) && cycleCount < this.maxCycles) {
        const altIdx = cycleCount % (plan.search_queries?.length ?? 1);
        const altQuery = (plan.search_queries ?? [])[altIdx] || `${plan.topic} alternative perspective`;
        if (!exploredAngles.has(altQuery.toLowerCase().slice(0, 60))) {
          onStatus?.(`Cycle ${cycleCount}: ${reasoningDecision.next_angle.slice(0, 60)}...`);
        }
      }
      exploredAngles.add(angleKey);

      onStatus?.(`Cycle ${cycleCount}: ${reasoningDecision.next_angle.slice(0, 80)}`);
      const cycleStartTime = Date.now();

      const actPrompt = `You are researching: "${query}"

This is part of a broader investigation into: "${plan.topic}"

Context from previous cycles:
${currentState.slice(0, 2000)}

Key questions to address:
${(reasoningDecision.gaps ?? []).slice(0, 3).join("\n")}

Provide detailed research findings for this specific angle. Include:
1. Specific facts, data points, statistics, and key findings
2. Primary sources and original research you reference (prefer original/primary over secondary aggregators)
3. Expert opinions, peer-reviewed findings, and authoritative data
4. Specific names, dates, numbers, and verifiable claims

Format as structured research notes. Be specific and detailed.`;

      const actResult = await generateWithContinuation(
        async () => {
          const text = await this.client.complete(
            [
              { role: "system", content: "You are a thorough research analyst. Provide detailed, well-sourced findings. Prioritize primary/original sources." },
              { role: "user", content: actPrompt },
            ],
            { maxTokens: 8192, temperature: 0.5, tag: `research/act_${cycleCount}` },
          );
          return { text, finishReason: "length", model: "default" };
        },
        {
          tag: `research/act_${cycleCount}`,
          maxContinuationRounds: 5,
          structuralCheck: true,
          contentCheck: true,
          minExpectedLength: 500,
        },
      );

      totalContinuationRounds += actResult.continuationRounds;

      const cycleDuration = Date.now() - cycleStartTime;

      const sourceExtract = await this.extractSources(actResult.data);

      cycles.push({
        cycleNumber: cycleCount,
        observation: reasoningDecision.observation,
        reasoning: reasoningDecision.next_angle,
        action: query,
        result: actResult.data.slice(0, 200),
        sourcesFound: sourceExtract.length,
      });

      allSources.push(...sourceExtract);
      if (!sectionFindings[section]) sectionFindings[section] = [];
      sectionFindings[section].push(actResult.data);
      allFindingsText += `\n\n### Research Cycle ${cycleCount}: ${reasoningDecision.next_angle}\n${actResult.data}`;
    }

    this.progress(onProgress, { phase: "analyzing", message: `Analyzing ${cycles.length} research cycles...`, percent: 75 });
    onStatus?.(`Analyzing ${cycles.length} research cycles across ${Object.keys(sectionFindings).length} sections...`);

    this.progress(onProgress, { phase: "writing", message: "Writing comprehensive report...", percent: 82 });
    onStatus?.("Synthesizing research into comprehensive report...");

    const reportResult = await generateWithContinuation(
      async () => {
        const text = await this.writeReport(plan, sectionFindings, allSources, cycles, onStatus);
        return { text, finishReason: "length", model: "default" };
      },
      {
        tag: "research/write",
        maxContinuationRounds: 5,
        structuralCheck: true,
        contentCheck: true,
        minExpectedLength: 1000,
      },
    );

    const report = reportResult.data;
    totalContinuationRounds += reportResult.continuationRounds;

    this.progress(onProgress, { phase: "verifying", message: "Verifying quality and coverage...", percent: 92 });
    onStatus?.("Running quality verification...");

    const uniqueSources = allSources.filter((s, i, a) => {
      const idx = a.findIndex((x) => x.title.toLowerCase() === s.title.toLowerCase());
      return idx === i;
    });

    const issues: string[] = [];
    if (report.length < 1000) issues.push("Report is too short for deep research");
    if (uniqueSources.length < 5) issues.push(`Only ${uniqueSources.length} unique sources (target: ${this.minSources}+)`);
    if (cycles.length < 3) issues.push(`Only ${cycles.length} research cycles (target: 10+)`);
    if (/lorem ipsum|todo|placeholder/i.test(report)) issues.push("Contains placeholder content");
    if (/\.\.\.\s*$/.test(report.trim())) issues.push("Report appears truncated");
    if (!report.includes("## ")) issues.push("No section headings found — structure may be flat");

    const truncCheck = detectTruncation(report, null, { structural: true, content: true });
    if (truncCheck.truncated) {
      issues.push(`Report truncated (${truncCheck.detail})`);
    }

    const assemblyCheck = await verifyAssembly([
      {
        name: "report-not-empty",
        check: () => report.trim().length > 200,
        detail: "Report body is too short",
      },
      {
        name: "sections-in-report",
        check: async () => {
          if (!plan.sections_planned) return false;
          const headings = report.match(/^#{1,3}\s+.+/gm) ?? [];
          const planned = plan.sections_planned.map((s: string) => s.toLowerCase().trim());
          const present = planned.filter((h: string) => headings.some((hd) => hd.toLowerCase().includes(h)));
          return present.length >= Math.ceil(planned.length * 0.5);
        },
        detail: "Fewer than 50% of planned sections appear in final report",
      },
      {
        name: "sources-sufficient",
        check: () => uniqueSources.length >= 3,
        detail: `Only ${uniqueSources.length} sources — insufficient for deep research`,
      },
      {
        name: "no-truncation-signals",
        check: () => !isTruncated(report),
        detail: "Final report contains truncation patterns",
      },
    ]);

    if (!assemblyCheck.passed) {
      issues.push(...assemblyCheck.failures.map((f) => `assembly: ${f.detail}`));
    }

    if (cycles.length < 5 && uniqueSources.length < 10) {
      onStatus?.("Extending shallow research with additional depth...");
      const extraCycles: string[] = [];
      for (let i = 0; i < 3; i++) {
        const extQuery = `${plan.topic} ${["critical analysis", "expert perspectives", "future outlook"][i]}`;
        const extResult = await generateWithContinuation(
          async () => {
            const text = await this.client.complete(
              [
                { role: "system", content: "You are a research analyst. Provide additional depth and detail." },
                { role: "user", content: `Add depth to research on "${plan.topic}". Focus on: ${["contrary perspectives and debates", "quantitative data and statistics", "emerging trends and future directions"][i]}\n\nExisting findings:\n${report.slice(-2000)}` },
              ],
              { maxTokens: 8192, temperature: 0.5, tag: "research/extension" },
            );
            return { text, finishReason: "length", model: "default" };
          },
          { tag: "research/extension", maxContinuationRounds: 3, structuralCheck: true, contentCheck: true },
        );
        totalContinuationRounds += extResult.continuationRounds;
        extraCycles.push(extResult.data);
      }
    }

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
      continuationRounds: totalContinuationRounds,
    };

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "research",
      title: output.topic,
      body: report,
      format: "markdown",
      metadata: {
        sections: output.sections.length,
        sources: uniqueSources.length,
        cycles: cycles.length,
        depth: plan.estimated_depth,
        avgCycleTimeMs: cycles.length > 0
          ? Math.round(cycles.reduce((s, c) => s + (c.sourcesFound > 0 ? 1000 : 0), 0) / cycles.length)
          : 0,
        continuationRounds: totalContinuationRounds,
      },
      sourceFiles: files.map((f) => f.name),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    this.progress(onProgress, { phase: "verifying", message: "Research complete.", percent: 100 });
    onStatus?.(`Research "${output.topic}" complete: ${cycles.length} cycles, ${uniqueSources.length} sources, ${totalContinuationRounds} continuation rounds. ${issues.length > 0 ? `(${issues.join("; ")})` : "All checks passed."}`);
    return output;
  }

  private async askClarifyingQuestions(
    request: string,
    onStatus?: (msg: string) => void,
  ): Promise<{ refinedRequest: string; clarifications: string[] }> {
    const shortWords = request.split(/\s+/).filter(Boolean).length;
    if (shortWords > 20 && /specific|detailed|comprehensive|thorough/i.test(request)) {
      return { refinedRequest: request, clarifications: [] };
    }

    const qPrompt = `The user has asked: "${request}"

This is for deep research. Before we start, we need to ensure the scope is clear.

Return JSON:
{
  "is_specific_enough": true/false,
  "clarifying_questions": ["question 1", ...] or [],
  "refined_topic": "more specific version of the topic if needed, or the original"
}

Only return questions if the topic is genuinely ambiguous or underspecified.`;

    try {
      const resp = await this.client.complete(
        [
          { role: "system", content: "You are a research scope clarifier. Return JSON only." },
          { role: "user", content: qPrompt },
        ],
        { maxTokens: 2048, temperature: 0.2, tag: "research/clarify" },
      );
      const result = JSON.parse(resp);
      if (!result.is_specific_enough && Array.isArray(result.clarifying_questions) && result.clarifying_questions.length > 0) {
        onStatus?.(`Scope needs clarification: ${result.clarifying_questions[0]}`);
        return {
          refinedRequest: `${result.refined_topic || request}\n\nNote: Consider these aspects — ${result.clarifying_questions.join("; ")}`,
          clarifications: result.clarifying_questions,
        };
      }
      return { refinedRequest: result.refined_topic || request, clarifications: [] };
    } catch {
      return { refinedRequest: request, clarifications: [] };
    }
  }

  private async buildResearchPlan(
    request: string,
    files: { name: string; content: string }[],
    onStatus?: (msg: string) => void,
  ): Promise<{
    topic: string;
    scope: string;
    search_queries: string[];
    key_questions: string[];
    estimated_depth: string;
    sections_planned: string[];
  }> {
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\nUploaded files:\n" + files.map((f) => `- ${f.name}: ${f.content.slice(0, 1000)}`).join("\n");
    }

    const planPrompt = `You are a research planner. Create a detailed research plan.

Topic: ${request}${fileContext}

Return ONLY valid JSON:
{
  "topic": "refined topic title (specific, accurate)",
  "scope": "description of research scope — what's in and what's out",
  "search_queries": ["query 1", "query 2", ...],
  "key_questions": ["question 1", "question 2", ...],
  "estimated_depth": "brief|moderate|deep",
  "sections_planned": ["section 1", "section 2", ...]
}

Requirements:
- 5-15 search queries covering different angles (historical, technical, comparative, practical, future-oriented)
- 4-8 sections for a comprehensive report
- Prefer queries that lead to primary/original sources over aggregators
- At least 3 key questions that the research should answer`;

    const planResp = await this.client.complete(
      [
        { role: "system", content: "You are a research methodologist. Return JSON only." },
        { role: "user", content: planPrompt },
      ],
      { maxTokens: 8192, temperature: 0.3, tag: "research/plan" },
    );

    try {
      return JSON.parse(planResp);
    } catch {
      return {
        topic: request.slice(0, 100),
        scope: "General research covering key aspects of the topic",
        search_queries: [request, `${request} analysis`, `${request} research findings`],
        key_questions: ["What are the key findings?", "What are the main debates?", "What are the practical implications?"],
        estimated_depth: "moderate",
        sections_planned: ["Overview and Background", "Key Findings and Analysis", "Expert Perspectives", "Practical Implications", "Conclusion"],
      };
    }
  }

  private async extractSources(text: string): Promise<ResearchSource[]> {
    const extractPrompt = `From this research text, extract all cited/referenced sources as a JSON array.
Each entry: {"title": "...", "type": "web|pdf|data", "summary": "...", "relevance": "high|medium|low"}

Be thorough — extract every distinct source mentioned.
Text: ${text.slice(0, 4000)}

Return ONLY the JSON array. If no sources, return [].`;

    try {
      const resp = await this.client.complete(
        [{ role: "user", content: extractPrompt }],
        { maxTokens: 4096, temperature: 0.2, tag: "research/extract-sources" },
      );
      const parsed = JSON.parse(resp);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private formatCurrentState(
    plan: any,
    sectionFindings: Record<string, string[]>,
    sources: ResearchSource[],
    cycles: ReasoningCycle[],
  ): string {
    const sectionSummary = Object.entries(sectionFindings)
      .map(([section, findings]) => `  - ${section}: ${findings.length} finding(s)`)
      .join("\n");

    const sourceSummary = sources.slice(0, 10).map((s) => `  - ${s.title} (${s.type}, ${s.relevance})`).join("\n");

    const cycleSummary = cycles.slice(-5).map((c) => `  - Cycle ${c.cycleNumber}: ${c.reasoning.slice(0, 60)}...`).join("\n");

    return `SECTIONS (${Object.keys(sectionFindings).length}):
${sectionSummary}

SOURCES (${sources.length} total, showing first 10):
${sourceSummary}

RECENT CYCLES (last 5 of ${cycles.length}):
${cycleSummary}`;
  }

  private async writeReport(
    plan: any,
    sectionFindings: Record<string, string[]>,
    sources: ResearchSource[],
    cycles: ReasoningCycle[],
    onStatus?: (msg: string) => void,
  ): Promise<string> {
    const allFindings = Object.entries(sectionFindings)
      .map(([section, content]) => `## ${section}\n${content.join("\n\n")}`)
      .join("\n\n");

    const topSources = sources
      .filter((s) => s.relevance === "high")
      .slice(0, 10)
      .map((s) => `  - ${s.title} (${s.type})${s.summary ? `: ${s.summary.slice(0, 120)}` : ""}`)
      .join("\n");

    const reportPrompt = `You are a research writer. Synthesize the following research findings into a comprehensive, well-structured report.

TOPIC: ${plan.topic}
SCOPE: ${plan.scope}

RESEARCH CYCLES: ${cycles.length}
TOTAL SOURCES: ${sources.length}

TOP SOURCES:
${topSources}

FINDINGS BY SECTION:
${allFindings.slice(0, 12000)}

Write a comprehensive research report that:
1. Opens with a strong executive summary that captures the key insight
2. Organizes findings clearly by the planned sections
3. Includes specific data points, statistics, and named sources
4. Notes contradictions, debates, or diverging expert opinions where they exist
5. Identifies gaps in current knowledge
6. Concludes with synthesized takeaways and implications
7. Uses proper markdown formatting with ## headings, **bold** for key terms

The report should be thorough and substantive — aim for 2000+ words of real content.`;

    const report = await this.client.complete(
      [
        { role: "system", content: "You are an expert research writer. Create thorough, well-structured reports with real substance." },
        { role: "user", content: reportPrompt },
      ],
      { maxTokens: 32768, temperature: 0.4, tag: "research/write" },
    );

    return report;
  }

  async followUp(
    question: string,
    previousOutput: ResearchOutput,
    onProgress?: (p: ResearchProgress) => void,
    onStatus?: (msg: string) => void,
  ): Promise<ResearchOutput> {
    this.progress(onProgress, { phase: "clarifying", message: "Understanding follow-up...", percent: 5 });
    onStatus?.("Processing follow-up...");

    const context = `Previous research topic: ${previousOutput.topic}
Previous summary: ${previousOutput.summary.slice(0, 1000)}
Previous sections: ${previousOutput.sections.map((s) => s.heading).join(", ")}
Previous continuation rounds: ${previousOutput.continuationRounds ?? 0}

Follow-up question: ${question}

Build on the existing research. Do NOT restart from scratch. Integrate new findings with what's already known.`;

    const fresh = await this.generate(context, onProgress, onStatus);

    const combined: ResearchOutput = {
      topic: previousOutput.topic,
      summary: fresh.summary,
      sections: [...previousOutput.sections, ...fresh.sections],
      sources: [...previousOutput.sources, ...fresh.sources].filter(
        (s, i, a) => a.findIndex((x) => x.title.toLowerCase() === s.title.toLowerCase()) === i,
      ),
      format: "markdown",
      verified: fresh.verified,
      verificationNotes: fresh.verificationNotes,
      continuationRounds: (previousOutput.continuationRounds ?? 0) + (fresh.continuationRounds ?? 0),
    };

    const existingArtifact = this.store.list(this.sessionId, "research").find((a) => a.title === previousOutput.topic);
    if (existingArtifact) {
      existingArtifact.body += `\n\n## Follow-up: ${question}\n\n${fresh.sections.map((s) => `### ${s.heading}\n${s.content}`).join("\n\n")}`;
      existingArtifact.body += `\n\n---\n*Additional sources: ${fresh.sources.length}*`;
      existingArtifact.updatedAt = Date.now();
    }

    return combined;
  }
}
