/**
 * Safe artifact generation wrapper.
 * The edge function now returns a job id immediately; this wrapper polls the
 * user's protected job row until the background worker completes.
 * Credits are ONLY consumed by the caller after validated success.
 */

import { supabase } from "@/integrations/supabase/client";
import { buildPromptForType } from "./artifactPrompts";

export interface GenerationConfig {
  prompt: string;
  type: "notes" | "exam" | "slides" | "code";
  topic: string;
  chatId?: string;
  maxRetries?: number;
  timeoutMs?: number;
  onStage?: (stage: string) => void;
}

export interface GenerationResult {
  success: boolean;
  content: string;
  error?: string;
  creditsConsumed: boolean;
  durationMs: number;
}

const ARTIFACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-artifact-v2`;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Direct OpenRouter call for artifacts (bypasses edge function) ──
// The edge function has timeout issues; calling directly gives us full control.
async function callOpenRouterDirect(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // Read API key from env or localStorage
    const apiKey = import.meta.env.VITE_OPENROUTER_KEY || localStorage.getItem("openrouter_key") || "";
    if (!apiKey) throw new Error("No OpenRouter API key configured");

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://luminaai.co.in",
        "X-Title": "Lumina AI",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Empty response from model");
    }
    return content;
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

function validateOutput(
  html: string,
  type: GenerationConfig["type"],
): { ok: boolean; reason?: string } {
  if (!html || typeof html !== "string") return { ok: false, reason: "empty" };
  const trimmed = html.trim();
  if (trimmed.length < 300) return { ok: false, reason: "too_short" };
  const lower = trimmed.toLowerCase();
  if (!lower.includes("<!doctype html") && !lower.includes("<html")) {
    return { ok: false, reason: "not_html" };
  }
  if ((trimmed.match(/\n/g) || []).length < 3)
    return { ok: false, reason: "no_structure" };
  return { ok: true };
}

async function queueJob(
  config: GenerationConfig,
): Promise<{ jobId?: string; html?: string; error?: string }> {
  const { type, topic, prompt, chatId } = config;
  const systemPrompt = buildPromptForType(type, topic);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: "sign_in_required" };

    const res = await fetch(ARTIFACT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        type,
        topic,
        userPrompt: prompt,
        systemPrompt,
        chatId,
      }),
      signal: ctrl.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        error: data?.error
          ? `HTTP ${res.status}: ${data.error}`
          : `HTTP ${res.status}`,
      };
    }

    // Backward compatibility if an older deployment still returns html directly.
    if (data?.html || data?.content) return { html: data.html ?? data.content };
    if (data?.jobId) return { jobId: data.jobId };
    return { error: data?.error ?? "queue_failed" };
  } catch (e: any) {
    if (e?.name === "AbortError") return { error: "queue_timeout" };
    return { error: e?.message ?? "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function pollJob(
  jobId: string,
  timeoutMs: number,
  onStage?: (stage: string) => void,
): Promise<{ html: string; error?: string }> {
  const started = Date.now();
  let pollDelay = 800; // Start fast
  let lastStatus = "queued";
  let offeredRecovery = false;
  let failureCount = 0;

  while (Date.now() - started < timeoutMs) {
    const { data, error } = await (supabase as any)
      .from("artifact_jobs")
      .select("status,html,error_message,updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error || !data) {
      failureCount++;
      if (failureCount > 10) return { html: "", error: "poll_failed_repeatedly" };
    } else {
      failureCount = 0;
    }

    if (error) return { html: "", error: error.message ?? "poll_failed" };
    if (!data) return { html: "", error: "job_not_found" };

    const status = String(data.status ?? "queued");
    if (status !== lastStatus) {
      lastStatus = status;
      onStage?.(status === "running" ? "Generating in background…" : "Queued…");
    }

    if (status === "completed") return { html: data.html ?? "" };
    if (status === "failed")
      return { html: "", error: data.error_message ?? "generation_failed" };

    const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : started;
    if (!offeredRecovery && status === "running" && Date.now() - updatedAt > 150_000) {
      offeredRecovery = true;
      onStage?.("Recovering a stalled generation…");
      return { html: "", error: "generation_stalled_retry" };
    }

    const elapsed = Date.now() - started;
    if (elapsed > 120_000)
      onStage?.("Still working — complex artifacts can take a few minutes…");
    else if (elapsed > 60_000) onStage?.("Composing the full artifact…");
    else if (elapsed > 20_000) onStage?.("Generating in background…");

    await sleep(pollDelay);
    // Exponential backoff: 800ms → 1.2s → 1.8s → 2.7s → ... capped at 8s
    pollDelay = Math.min(8000, Math.round(pollDelay * 1.5));
  }

  return { html: "", error: "job_timeout" };
}

async function singleAttempt(
  config: GenerationConfig,
): Promise<{ html: string; error?: string }> {
  const { type, topic, prompt, timeoutMs = 480_000 } = config;
  const maxTokens = type === "code" ? 24000 : 18000;

  // Build the system prompt
  const systemPrompt = buildPromptForType(type, topic);
  const userPrompt = `Generate a complete, self-contained HTML ${type} artifact for "${topic}". Include real educational content — definitions, worked examples, formulas, practice questions with answers. Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences. No commentary. Minimum 600 lines.`;

  // Try direct OpenRouter call first (faster, full control)
  try {
    config.onStage?.("Generating artifact…");
    const raw = await callOpenRouterDirect(systemPrompt, userPrompt, maxTokens, Math.min(timeoutMs, 180_000));
    const cleaned = cleanHtml(raw);
    if (validHtml(cleaned)) {
      return { html: cleaned };
    }
    config.onStage?.("Direct call returned invalid HTML, trying edge function…");
  } catch (e: any) {
    config.onStage?.(`Direct call failed: ${e?.message?.slice(0, 60) ?? "unknown"}…`);
  }

  // Fallback to edge function
  config.onStage?.("Trying edge function…");
  const queued = await queueJob(config);
  if (queued.html) return { html: queued.html };
  if (queued.error || !queued.jobId)
    return { html: "", error: queued.error ?? "queue_failed" };

  config.onStage?.("Queued — generating in background…");
  return pollJob(queued.jobId, timeoutMs, config.onStage);
}

/** Clean raw model output to extract HTML */
function cleanHtml(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  h = h.trim();
  const dt = h.toLowerCase().indexOf("<!doctype");
  const ht = h.toLowerCase().indexOf("<html");
  if (dt > 0) h = h.slice(dt);
  else if (dt === -1 && ht > 0) h = h.slice(ht);
  return h.trim();
}

/** Validate that the output is real HTML */
function validHtml(html: string): boolean {
  if (!html || html.length < 300) return false;
  const lower = html.toLowerCase();
  const hasDoctype = lower.includes("<!doctype");
  const hasHtml = lower.includes("<html");
  const hasClose = lower.includes("</html>");
  const hasBody = lower.includes("<body");
  const hasContent = lower.includes("<h1") || lower.includes("<h2") || lower.includes("<p") || lower.includes("<section") || lower.includes("<div");
  const hasGarbage = /todo|lorem ipsum|coming soon|rest of (the )?content|your .* will appear/i.test(html);
  return (hasDoctype || hasHtml) && hasClose && (hasBody || hasContent) && !hasGarbage;
}

export async function attemptGeneration(
  config: GenerationConfig,
): Promise<GenerationResult> {
  const start = Date.now();
  const maxRetries = config.maxRetries ?? 1;

  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) config.onStage?.(`Retrying (${i}/${maxRetries})…`);
    const { html, error } = await singleAttempt(config);

    config.onStage?.("Validating output…");
    const v = validateOutput(html, config.type);
    if (v.ok) {
      return {
        success: true,
        content: html,
        creditsConsumed: true,
        durationMs: Date.now() - start,
      };
    }

    if (i < maxRetries) continue;

    return {
      success: false,
      content: "",
      error: error ?? `validation_${v.reason}`,
      creditsConsumed: false,
      durationMs: Date.now() - start,
    };
  }

  return {
    success: false,
    content: "",
    error: "Generation failed",
    creditsConsumed: false,
    durationMs: Date.now() - start,
  };
}
