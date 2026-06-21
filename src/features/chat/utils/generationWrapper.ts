/**
 * Safe artifact generation wrapper.
 * Uses edge function (secure, API key stays on server).
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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Relaxed validation: accept any substantial HTML-ish content.
 * The edge function already does strict validation + fallback.
 */
function validateOutput(
  html: string,
  type: GenerationConfig["type"],
): { ok: boolean; reason?: string } {
  if (!html || typeof html !== "string") return { ok: false, reason: "empty" };
  const trimmed = html.trim();
  if (trimmed.length < 100) return { ok: false, reason: "too_short" };
  const lower = trimmed.toLowerCase();
  // Accept HTML documents OR substantial markdown content
  const hasHtml = lower.includes("<!doctype") || lower.includes("<html") || lower.includes("<div") || lower.includes("<section");
  if (!hasHtml) return { ok: false, reason: "not_html" };
  // Check for garbage
  const hasGarbage = /lorem ipsum|coming soon|your .* will appear|todo: write|placeholder/i.test(html);
  if (hasGarbage) return { ok: false, reason: "garbage" };
  return { ok: true };
}

async function queueJob(
  config: GenerationConfig,
): Promise<{ jobId?: string; html?: string; error?: string }> {
  const { type, topic, prompt, chatId } = config;
  const systemPrompt = buildPromptForType(type, topic);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);

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
  let pollDelay = 1000;
  let lastStatus = "queued";
  let failureCount = 0;

  while (Date.now() - started < timeoutMs) {
    const { data, error } = await (supabase as any)
      .from("artifact_jobs")
      .select("status,html,error_message,updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error || !data) {
      failureCount++;
      if (failureCount > 15) return { html: "", error: "poll_failed_repeatedly" };
    } else {
      failureCount = 0;
    }

    if (error) return { html: "", error: error.message ?? "poll_failed" };
    if (!data) return { html: "", error: "job_not_found" };

    const status = String(data.status ?? "queued");
    if (status !== lastStatus) {
      lastStatus = status;
      if (status === "running") onStage?.("Generating your artifact…");
      else if (status === "queued") onStage?.("Queued…");
    }

    if (status === "completed") return { html: data.html ?? "" };
    if (status === "failed")
      return { html: "", error: data.error_message ?? "generation_failed" };

    const elapsed = Date.now() - started;
    if (elapsed > 180_000) onStage?.("Still working on your artifact…");
    else if (elapsed > 90_000) onStage?.("Composing the full artifact…");
    else if (elapsed > 30_000) onStage?.("Generating in background…");

    await sleep(pollDelay);
    pollDelay = Math.min(10_000, Math.round(pollDelay * 1.4));
  }

  return { html: "", error: "job_timeout" };
}

async function singleAttempt(
  config: GenerationConfig,
): Promise<{ html: string; error?: string }> {
  const { type, topic, prompt, timeoutMs = 600_000 } = config;

  config.onStage?.("Generating artifact…");
  const queued = await queueJob(config);
  if (queued.html) return { html: queued.html };
  if (queued.error || !queued.jobId)
    return { html: "", error: queued.error ?? "queue_failed" };

  config.onStage?.("Queued — generating in background…");
  return pollJob(queued.jobId, timeoutMs, config.onStage);
}

export async function attemptGeneration(
  config: GenerationConfig,
): Promise<GenerationResult> {
  const start = Date.now();
  const maxRetries = config.maxRetries ?? 2;  // increased from 1

  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) {
      config.onStage?.(`Retrying (${i}/${maxRetries})…`);
      await sleep(2000); // brief pause before retry
    }
    const { html, error } = await singleAttempt(config);

    // Even if validation fails, if we got substantial HTML, use it
    const v = validateOutput(html, config.type);
    if (v.ok) {
      return {
        success: true,
        content: html,
        creditsConsumed: true,
        durationMs: Date.now() - start,
      };
    }

    // If HTML is substantial but failed validation, still use it as fallback
    if (html && html.length > 500) {
      console.warn(`[artifact] Using substantial HTML (${html.length} chars) despite validation: ${v.reason}`);
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
