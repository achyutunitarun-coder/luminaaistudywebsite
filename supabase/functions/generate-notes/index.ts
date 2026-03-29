import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

const AUTO_ROUTER = "openrouter/auto";

const FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "moonshotai/kimi-vl-a3b-thinking:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "open-r1/olympiccoder-32b:free",
  "allenai/olmo-2-0325-32b-instruct:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-1b-it:free",
];

function getModelsToTry(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of [...PRIMARY_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS]) {
    if (!seen.has(m)) { seen.add(m); result.push(m); }
  }
  return result;
}

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `You MUST follow this exact structure:

# [Topic Title]

> **Overview:** A 2-3 sentence summary of the entire topic.

---

## 1. [First Major Section]

### 1.1 [Subsection Title]
- **[Key Term]** — Clear, formal definition
  - Supporting detail or example
  - Additional nuance if needed
- **[Another Key Term]** — Definition
  - Real-world application or example

### 1.2 [Next Subsection]
- Point with explanation
- Point with explanation

## 2. [Second Major Section]
(Continue the same pattern)

---

## ⚠️ Common Mistakes
- **Mistake:** [What students get wrong] → **Correction:** [The right understanding]

## 📝 Quick Revision Checklist
- [ ] Key concept 1
- [ ] Key concept 2

## 🧠 Memory Aids
- **Mnemonic:** [Memory trick for key concepts]

Use numbered sections (1, 2, 3...) and numbered subsections (1.1, 1.2...). Every key term MUST be in bold. Use em-dashes (—) after bold terms for definitions.`,

  hyphen: `You MUST follow this exact structure:

# [Topic Title]

> **Synopsis:** Brief formal overview of the topic scope.

---

## Section I — [Major Topic]

**[Subtopic A]**
- Main concept explanation
  - Supporting detail
  - Example or application
- Related concept
  - Detail

**[Subtopic B]**
- Main concept
  - Detail with formula or definition

## Section II — [Next Major Topic]
(Continue pattern)

---

## Key Definitions
| Term | Definition |
|------|-----------|
| **Term 1** | Formal definition |
| **Term 2** | Formal definition |

## Revision Checklist
- [ ] Understand [concept]
- [ ] Can explain [concept]
- [ ] Can apply [concept]

Use Roman numerals for major sections. Bold all subtopic headers. Use consistent indentation with hyphens. Include a definitions table.`,

  paragraph: `You MUST follow this exact structure:

# [Topic Title]

> **Abstract:** A concise 3-4 sentence overview summarizing scope, significance, and key takeaways.

---

## Introduction

A well-crafted opening paragraph establishing the topic's importance, historical context, and relevance. Transition naturally into the core content.

## [Core Concept 1]

Write rich, connected paragraphs (3-5 sentences each). Each paragraph should flow logically into the next. **Bold key terms** on first use and provide clear definitions inline. Include concrete examples: *"For instance, [example that illustrates the concept]."*

### [Sub-concept]

Continue with detailed explanation. Reference real-world applications where relevant. Use transitional phrases like "Building on this," "In contrast," "This principle extends to."

## [Core Concept 2]
(Continue pattern with smooth transitions between sections)

---

## Summary

A formal concluding section that synthesizes all key points into a coherent recap. Highlight the most exam-critical takeaways.

## Key Takeaways
1. **[Point]** — Brief explanation
2. **[Point]** — Brief explanation

Write in formal academic prose. No bullet-point dumps in the main body — use flowing paragraphs. Bold all key terms. Use blockquotes for important definitions or theorems.`,

  mindmap: `You MUST follow this exact structure:

# 🗺️ [Topic Title] — Concept Map

> **Central Theme:** One-sentence description of the core idea.

---

\`\`\`
                        [CENTRAL TOPIC]
                             │
            ┌────────────────┼────────────────┐
            │                │                │
      [Branch 1]       [Branch 2]       [Branch 3]
            │                │                │
     ┌──────┼──────┐   ┌────┼────┐      ┌────┼────┐
     │      │      │   │    │    │      │    │    │
  [Sub1] [Sub2] [Sub3] [S1] [S2] [S3]  [S1] [S2] [S3]
\`\`\`

---

## Branch 1: [Name]

### [Sub-concept 1]
- **Definition:** Formal explanation
- **Key Formula:** \`formula here\`
- **Connection to →** [Other branch/concept]

### [Sub-concept 2]
- **Definition:** Explanation
- **Example:** Concrete illustration

## Branch 2: [Name]
(Continue pattern)

---

## 🔗 Cross-Connections
- **[Concept A] ↔ [Concept B]:** How they relate
- **[Concept C] → [Concept D]:** Cause-effect relationship

## 📌 Key Facts Summary
| Concept | Core Idea | Formula/Rule |
|---------|-----------|-------------|
| Name | Brief | Formula |

Use the tree diagram at the top, then expand each branch below. Show cross-connections between concepts. Include a summary table.`,

  root_cause: `You MUST follow this exact structure:

# 🔍 [Topic] — Deep Root-Cause Analysis

> **Objective:** Understand the foundational principles and identify exactly where and why misunderstandings occur.

---

## I. Core Principles (The Foundation)

### Principle 1: [Name]
- **What it is:** Formal definition
- **Why it matters:** Explanation of significance
- **The root idea:** The fundamental concept beneath the surface

### Principle 2: [Name]
(Continue pattern)

---

## II. Common Misconceptions & Root Causes

### ❌ Misconception: "[What students wrongly believe]"
- **Root Cause:** Why this misunderstanding develops
- **The Reality:** Correct understanding with proof/reasoning
- **Diagnostic Question:** "If you think X, ask yourself Y"
- **Fix:** Step-by-step correction

### ❌ Misconception: "[Another wrong belief]"
(Continue pattern)

---

## III. Diagnostic Self-Test
1. **Question:** [Probing question] → If you struggle, revisit [Section]
2. **Question:** [Another question] → Tests understanding of [Concept]

## IV. Corrective Study Plan
| Gap Identified | Study Action | Resource/Method |
|---------------|-------------|-----------------|
| [Weakness] | [What to do] | [How to study it] |

## V. Master Plan Summary
- **Step 1:** [Foundation to build first]
- **Step 2:** [Next layer of understanding]
- **Step 3:** [Advanced application]

Use Roman numerals for major sections. Be analytical and diagnostic. Focus on WHY students fail, not just WHAT to learn.`,

  detailed: `You MUST follow this exact structure:

# [Topic Title]

> **Overview:** Comprehensive 3-4 sentence summary covering scope and significance.

---

## 1. [First Major Section]

### 1.1 [Subsection]
Provide a thorough explanation in formal academic language. **Bold key terms** and define them clearly. Include:

- **Definition:** Formal, precise definition
- **Explanation:** Expanded description with context
- **Formula:** \`relevant formula\` (if applicable)
- **Example:** Concrete, worked-through example

> 💡 **Key Insight:** An important takeaway or connection

### 1.2 [Next Subsection]
(Continue with same depth and structure)

## 2. [Second Major Section]
(Continue pattern)

---

## ⚠️ Common Mistakes
| Mistake | Why It's Wrong | Correct Approach |
|---------|---------------|-----------------|
| [Error] | [Explanation] | [Fix] |

## 📊 Comparison Table (if applicable)
| Feature | Concept A | Concept B |
|---------|-----------|-----------|
| [Aspect] | [Detail] | [Detail] |

## 📝 Chapter Summary
1. **[Key point 1]** — Brief recap
2. **[Key point 2]** — Brief recap
3. **[Key point 3]** — Brief recap

Use numbered sections throughout. Include tables for comparisons. Use blockquotes for key insights. Be exhaustive — cover every concept, sub-concept, and edge case.`,

  exam: `You MUST follow this exact structure:

# 📚 [Topic] — Exam Preparation Notes

> **Exam Focus:** What examiners typically test and the scope of questions.

---

## 🎯 Key Definitions (Must-Know)

| # | Term | Definition |
|---|------|-----------|
| 1 | **[Term]** | Precise, exam-ready definition |
| 2 | **[Term]** | Precise definition |

---

## 📖 Core Concepts

### Concept 1: [Name]
- **What it is:** Clear, concise explanation
- **Formula:** \`formula\` (with each variable defined)
- **Exam Tip:** How this is typically tested
- **Worked Example:** Step-by-step solution

### Concept 2: [Name]
(Continue pattern)

---

## ⚠️ Common Mistakes (Mark Killers)
1. **❌ [Mistake]** — Why students lose marks → ✅ **Do this instead**
2. **❌ [Mistake]** — Explanation → ✅ **Correct approach**

## 🔥 Predicted Exam Questions
1. **[Short answer]:** Expected question with model answer outline
2. **[Calculation]:** Setup and key steps
3. **[Essay/Long answer]:** Key points to include

## ⚡ Last-Minute Revision
- 🔑 [Most important fact 1]
- 🔑 [Most important fact 2]
- 🔑 [Most important formula]
- 🔑 [Most common exam trap]

## ✅ Pre-Exam Checklist
- [ ] Can define all key terms
- [ ] Can solve [type] problems
- [ ] Understand [critical concept]
- [ ] Know common mistakes to avoid

Focus ruthlessly on what's testable. Use tables for definitions. Include worked examples. Flag mark-killing mistakes.`,

  simple: `You MUST follow this exact structure:

# [Topic] — Made Simple

> **In Plain English:** A 2-sentence explanation a 12-year-old could understand.

---

## 🌟 The Big Picture

Start with a relatable analogy. *"Think of [topic] like [everyday analogy]..."* Then explain the core idea in simple terms.

## 📝 Key Concepts Explained

### 1. [Concept Name]

**Simple explanation:** Explain like you're talking to a friend. Use short sentences.

**Analogy:** *"It's like [relatable comparison]..."*

**Example:** A concrete, everyday example.

**Remember:** One-line takeaway.

### 2. [Next Concept]
(Continue with same friendly structure)

---

## 🤔 "But Wait..." (Common Confusions)

**Q: [Common question students ask]**
A: [Clear, simple answer]

**Q: [Another question]**
A: [Answer with example]

## 📌 The Cheat Sheet
| Concept | One-Line Summary |
|---------|-----------------|
| [Name] | [Simple summary] |

## 🧠 Memory Tricks
- **[Concept]:** [Fun mnemonic or memory trick]

Keep language conversational but accurate. Use analogies for every abstract concept. Short paragraphs only.`,

  cornell: `You MUST follow this exact structure:

# [Topic] — Cornell Notes

> **Date:** [Today] | **Subject:** [Field] | **Source:** AI-Generated Study Notes

---

## Section 1: [Major Topic]

| Cue Questions | Notes |
|:---|:---|
| **What is [term]?** | **[Term]** — Formal definition. Additional context and explanation. Example: [concrete example]. |
| **How does [process] work?** | **Step 1:** [Explanation]. **Step 2:** [Explanation]. **Step 3:** [Explanation]. Key formula: \`formula\` |
| **Why is [concept] important?** | [Explanation of significance]. Real-world application: [example]. Connected to: [related concept]. |

### 📝 Section 1 Summary
> [2-3 sentence summary capturing the essential ideas from this section]

---

## Section 2: [Next Major Topic]

| Cue Questions | Notes |
|:---|:---|
| **[Question]** | [Detailed answer with bold key terms] |
| **[Question]** | [Answer] |

### 📝 Section 2 Summary
> [Summary]

---

## 📋 Master Summary
> [A comprehensive 4-6 sentence summary that connects ALL sections and highlights the most critical points for exam review. This should be the ONE thing you re-read before the exam.]

## 🔑 Key Terms Glossary
| Term | Definition |
|------|-----------|
| **[Term]** | [Definition] |

Use the two-column Cornell format faithfully. Left column = targeted review questions. Right column = comprehensive answers. Every section ends with a summary. Include a master summary at the end.`,
};

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 4, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    if (data.knowledgeGraph?.description) ctx += `${data.knowledgeGraph.title}: ${data.knowledgeGraph.description}\n`;
    for (const r of (data.organic ?? []).slice(0, 4)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    return ctx;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    if (body.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { topic, sourceText, style, isRefinement } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const stylePrompt = STYLE_PROMPTS[style || "bullet"] || STYLE_PROMPTS.bullet;

    let searchContext = "";
    if (!sourceText && topic && SERPER_API_KEY) {
      searchContext = await searchSerper(`${topic} study notes key concepts`, SERPER_API_KEY);
    }

    const systemPrompt = isRefinement
      ? `You are Lumina AI's professional study notes assistant. Refine the existing notes per user instructions while maintaining the same formatting structure. Output the COMPLETE updated notes in full — never truncate.`
      : `You are Lumina AI — a world-class academic notes generator trusted by top students. Your notes are formal, precise, beautifully structured, and genuinely helpful.

FORMATTING INSTRUCTIONS (follow this EXACTLY — do not deviate):
${stylePrompt}

QUALITY RULES:
- Write in formal, academic tone — professional but approachable. Never sloppy or casual.
- Be EXHAUSTIVE. Cover every major concept, sub-concept, formula, definition, and edge case.
- **Bold** every key term on first use. Use *italics* sparingly for emphasis.
- Use horizontal rules (---) to separate major sections for visual clarity.
- Include concrete, worked-through examples — not vague references.
- Add "⚠️ Common Mistake" callouts where students typically go wrong.
- Include mnemonics or memory tricks where they genuinely help retention.
- Use tables for comparisons, definitions, or structured data — they improve readability.
- Use blockquotes (>) for important theorems, definitions, or key insights.
- Never output placeholder text. Every line must contain real, accurate content.
- Make it feel like the best study resource ever created for this topic.
${searchContext ? `\nREFERENCE DATA (use this to enhance accuracy and depth):\n${searchContext}` : ""}`;

    const userContent = sourceText
      ? `Create comprehensive study notes from this material:\n\n${sourceText}`
      : `Create the most thorough, exam-ready study notes possible on "${topic}".`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    const models = getModelsToTry();
    console.log(`[generate-notes] Trying ${models.length} models`);

    for (const model of models) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            max_tokens: 4500,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[generate-notes] ${model} error ${res.status}: ${errText}`);
          continue;
        }

        console.log(`[generate-notes] Success with model: ${model}`);
        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) { console.error(`[generate-notes] ${model} exception:`, e); }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
