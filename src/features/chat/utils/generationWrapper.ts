/**
 * Safe generation wrapper.
 * Credits are ONLY consumed on validated, non-empty success.
 * If anything fails — empty response, timeout, network error, validation —
 * we return creditsConsumed: false so the caller skips the credit deduction.
 */

import { supabase } from '@/integrations/supabase/client';
import { buildPromptForType } from './artifactPrompts';

export interface GenerationConfig {
  prompt: string;
  type: 'notes' | 'exam' | 'slides' | 'code';
  topic: string;
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

function validateOutput(html: string, type: GenerationConfig['type']): { ok: boolean; reason?: string } {
  if (!html || typeof html !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = html.trim();
  if (trimmed.length < 500) return { ok: false, reason: 'too_short' };
  // For HTML artifacts, must contain HTML markers
  const lower = trimmed.toLowerCase();
  if (!lower.includes('<!doctype html') && !lower.includes('<html')) {
    return { ok: false, reason: 'not_html' };
  }
  if ((trimmed.match(/\n/g) || []).length < 3) return { ok: false, reason: 'no_structure' };
  return { ok: true };
}

async function singleAttempt(
  config: GenerationConfig,
  attemptIdx: number,
): Promise<{ html: string; error?: string }> {
  const { type, topic, timeoutMs = 90_000, prompt } = config;
  const systemPrompt = buildPromptForType(type, topic);

  // Simplify the user prompt on retries
  const userPayload = attemptIdx === 0
    ? prompt
    : `Generate the ${type} for: ${topic}. Keep it focused and complete.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const auth = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(ARTIFACT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({
        type,
        topic,
        userPrompt: userPayload,
        systemPrompt, // backend may use as override hint
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { html: '', error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => null);
    const html = data?.html ?? data?.content ?? '';
    return { html };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { html: '', error: 'timeout' };
    return { html: '', error: e?.message ?? 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function attemptGeneration(config: GenerationConfig): Promise<GenerationResult> {
  const start = Date.now();
  const maxRetries = config.maxRetries ?? 2;

  for (let i = 0; i <= maxRetries; i++) {
    config.onStage?.(i === 0 ? 'Generating…' : `Retrying (${i}/${maxRetries})…`);
    const { html, error } = await singleAttempt(config, i);

    if (error === 'timeout' && i < maxRetries) continue;
    if (error && i < maxRetries) continue;

    config.onStage?.('Validating output…');
    const v = validateOutput(html, config.type);
    if (v.ok) {
      return {
        success: true,
        content: html,
        creditsConsumed: true,
        durationMs: Date.now() - start,
      };
    }
    // Validation failed — try again if we have retries left
    if (i < maxRetries) continue;

    return {
      success: false,
      content: '',
      error: error ?? `validation_${v.reason}`,
      creditsConsumed: false,
      durationMs: Date.now() - start,
    };
  }

  return {
    success: false,
    content: '',
    error: 'Generation failed',
    creditsConsumed: false,
    durationMs: Date.now() - start,
  };
}
