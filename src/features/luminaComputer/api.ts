// Lumina Computer — client SDK
import { supabase } from "@/integrations/supabase/client";

export type BlockType = "slide" | "doc_section" | "sheet_tab" | "site_section";
export type OutputType = "slides" | "doc" | "sheet" | "website" | "agent";
export type BlockStatus = "queued" | "generating" | "ready" | "error";

export interface LcBlock {
  id: string;
  project_id: string;
  parent_block_id: string | null;
  block_type: string;
  order_index: number;
  title: string | null;
  prompt_seed: string | null;
  content_json: any;
  rendered_html: string | null;
  status: BlockStatus;
  model_used: string | null;
  error_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface LcProject {
  id: string;
  user_id: string;
  title: string;
  output_type: OutputType;
  status: string;
  created_at: string;
  updated_at: string;
}

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
}

export async function planBlocks(goal: string, output_type: OutputType) {
  const res = await fetch(`${FN_BASE}/lc-agent-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authHeader() },
    body: JSON.stringify({ goal, output_type }),
  });
  if (!res.ok) { const text = await res.text(); try { const json = JSON.parse(text); throw new Error(json.error || json.message || text); } catch { throw new Error(text); } }
  return res.json() as Promise<{ blocks: Array<{ block_type: string; title: string; prompt_seed: string; order_index: number; layout_hint?: string; narrative_beat?: string }>; model_used: string; is_fallback?: boolean; error_detail?: any }>;
}

export interface StreamCallbacks {
  onMeta?: (m: { model: string; fallback: boolean; role: string }) => void;
  onToken: (t: string) => void;
  onError?: (msg: string) => void;
  signal?: AbortSignal;
}

export async function streamRoute(opts: {
  role: string;
  prompt: string;
  system?: string;
  project_id?: string;
  block_id?: string;
  max_tokens?: number;
  temperature?: number;
} & StreamCallbacks): Promise<{ text: string; model: string | null }> {
  const res = await fetch(`${FN_BASE}/lc-llm-router`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authHeader() },
    body: JSON.stringify({
      role: opts.role,
      prompt: opts.prompt,
      system: opts.system,
      project_id: opts.project_id,
      block_id: opts.block_id,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`route_failed: ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let model: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const p = JSON.parse(json);
        if (p.lumina_meta) {
          model = p.lumina_meta.model;
          opts.onMeta?.(p.lumina_meta);
          continue;
        }
        if (p.lumina_error) {
          opts.onError?.(p.lumina_error);
          continue;
        }
        const delta = p.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) {
          text += delta;
          opts.onToken(delta);
        }
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  return { text, model };
}

// ── DB helpers ────────────────────────────────────────────────
export async function createProject(title: string, output_type: OutputType) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("lc_projects" as any)
    .insert({ title, output_type, user_id: user.id, status: "planning" })
    .select().single();
  if (error) throw error;
  return data as unknown as LcProject;
}

export async function listProjects() {
  const { data, error } = await supabase
    .from("lc_projects" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as LcProject[];
}

export async function getProject(id: string) {
  const { data, error } = await supabase.from("lc_projects" as any).select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as LcProject;
}

export async function updateProject(id: string, patch: Partial<LcProject>) {
  const { error } = await supabase.from("lc_projects" as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertBlocks(project_id: string, plans: Array<{ block_type: string; title: string; prompt_seed: string; order_index: number; layout_hint?: string; narrative_beat?: string }>) {
  const rows = plans.map((p) => ({
    project_id,
    block_type: p.block_type,
    title: p.title,
    prompt_seed: p.prompt_seed,
    order_index: p.order_index,
    status: "queued" as const,
    content_json: { layout_hint: p.layout_hint, narrative_beat: p.narrative_beat },
  }));
  const { data, error } = await supabase.from("lc_blocks" as any).insert(rows).select();
  if (error) throw error;
  return (data ?? []) as unknown as LcBlock[];
}

export async function listBlocks(project_id: string) {
  const { data, error } = await supabase
    .from("lc_blocks" as any)
    .select("*")
    .eq("project_id", project_id)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as unknown as LcBlock[];
}

export async function updateBlock(id: string, patch: Partial<LcBlock>) {
  const { error } = await supabase.from("lc_blocks" as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("lc_projects" as any).delete().eq("id", id);
  if (error) throw error;
}
