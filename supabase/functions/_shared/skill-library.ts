// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Skill Library
//
// Records successful multi-step flows as reusable macros.
// On future tasks, matches by description + context fingerprint
// and replays with lightweight verification.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ───────────────────────────────────────────────────────────

export interface SkillStep {
  action: string;       // "navigate", "click", "type", "wait", "extract", etc.
  target?: string;
  value?: string;
  selector?: string;
  result?: string;      // expected/observed result for verification
}

export interface Skill {
  id: string;
  description: string;       // human-readable: "Log into GitHub and export contribution graph"
  intent: string;            // normalized intent: "export_github_contributions"
  contextFingerprint: string; // site URL pattern + task type
  steps: SkillStep[];
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

// ── Fingerprint matching ────────────────────────────────────────────

export function buildFingerprint(request: string): string {
  // Extract domain-like patterns and action keywords
  const domains = request.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z]{2,})/gi) ?? [];
  const actions = request.match(/\b(export|download|import|upload|submit|login|search|book|reserve|order|pay|create|edit|delete|generate|convert)\b/gi) ?? [];
  // Combine into a stable fingerprint
  const domainPart = domains.map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]).sort().join(",");
  const actionPart = actions.map((a) => a.toLowerCase()).sort().join(",");
  return `${domainPart}::${actionPart}`;
}

export function fingerprintSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const [aDomains, aActions] = a.split("::");
  const [bDomains, bActions] = b.split("::");
  if (!aDomains || !bDomains) return 0;
  const aDomainSet = new Set(aDomains.split(",").filter(Boolean));
  const bDomainSet = new Set(bDomains.split(",").filter(Boolean));
  const domainOverlap = new Set([...aDomainSet].filter((d) => bDomainSet.has(d))).size;
  const maxDomains = Math.max(aDomainSet.size, bDomainSet.size);
  if (maxDomains === 0) return 0;
  return domainOverlap / maxDomains;
}

// ── Skill Library Operations ────────────────────────────────────────

const TABLE_NAME = "lumina_skills";

export async function recordSkill(
  supabaseUrl: string,
  supabaseKey: string,
  skill: Omit<Skill, "id" | "usageCount" | "lastUsedAt" | "createdAt">,
): Promise<Skill | null> {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await sb
      .from(TABLE_NAME)
      .insert({
        description: skill.description,
        intent: skill.intent,
        context_fingerprint: skill.contextFingerprint,
        steps: JSON.stringify(skill.steps),
        tags: skill.tags,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? deserializeSkill(data) : null;
  } catch (e) {
    console.warn("[skill-library] record failed:", e);
    return null;
  }
}

export async function findMatchingSkill(
  supabaseUrl: string,
  supabaseKey: string,
  request: string,
  threshold = 0.8,
): Promise<Skill | null> {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const fingerprint = buildFingerprint(request);
    const { data, error } = await sb
      .from(TABLE_NAME)
      .select("*")
      .order("usage_count", { ascending: false })
      .limit(20);
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let bestMatch: Skill | null = null;
    let bestScore = 0;
    for (const row of data) {
      const skill = deserializeSkill(row);
      const score = fingerprintSimilarity(fingerprint, skill.contextFingerprint);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = skill;
      }
    }
    return bestMatch;
  } catch (e) {
    console.warn("[skill-library] find failed:", e);
    return null;
  }
}

export async function recordUsage(
  supabaseUrl: string,
  supabaseKey: string,
  skillId: string,
): Promise<void> {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    await sb.rpc("increment_skill_usage", { skill_id: skillId });
  } catch (e) {
    console.warn("[skill-library] recordUsage failed:", e);
  }
}

export async function listSkills(
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Skill[]> {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await sb
      .from(TABLE_NAME)
      .select("*")
      .order("usage_count", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(deserializeSkill);
  } catch (e) {
    console.warn("[skill-library] list failed:", e);
    return [];
  }
}

export async function deleteSkill(
  supabaseUrl: string,
  supabaseKey: string,
  skillId: string,
): Promise<boolean> {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb.from(TABLE_NAME).delete().eq("id", skillId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[skill-library] delete failed:", e);
    return false;
  }
}

function deserializeSkill(row: any): Skill {
  return {
    id: row.id,
    description: row.description ?? "",
    intent: row.intent ?? "",
    contextFingerprint: row.context_fingerprint ?? "",
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : (row.steps ?? []),
    tags: row.tags ?? [],
    usageCount: row.usage_count ?? 0,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}
