
-- lc_projects
CREATE TABLE public.lc_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  output_type text NOT NULL CHECK (output_type IN ('slides','doc','sheet','website','agent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planning','generating','ready','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lc_projects TO authenticated;
GRANT ALL ON public.lc_projects TO service_role;
ALTER TABLE public.lc_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.lc_projects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lc_projects_user_idx ON public.lc_projects(user_id, created_at DESC);
CREATE TRIGGER lc_projects_touch BEFORE UPDATE ON public.lc_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- lc_blocks
CREATE TABLE public.lc_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.lc_projects(id) ON DELETE CASCADE,
  parent_block_id uuid REFERENCES public.lc_blocks(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  title text,
  prompt_seed text,
  content_json jsonb,
  rendered_html text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','error')),
  model_used text,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lc_blocks TO authenticated;
GRANT ALL ON public.lc_blocks TO service_role;
ALTER TABLE public.lc_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.lc_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lc_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lc_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE INDEX lc_blocks_project_idx ON public.lc_blocks(project_id, order_index);
CREATE TRIGGER lc_blocks_touch BEFORE UPDATE ON public.lc_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- lc_generation_log
CREATE TABLE public.lc_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.lc_projects(id) ON DELETE CASCADE,
  block_id uuid REFERENCES public.lc_blocks(id) ON DELETE CASCADE,
  role text NOT NULL,
  model_id text NOT NULL,
  success boolean NOT NULL,
  latency_ms int,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lc_generation_log TO authenticated;
GRANT ALL ON public.lc_generation_log TO service_role;
ALTER TABLE public.lc_generation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own logs" ON public.lc_generation_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lc_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE INDEX lc_gen_log_project_idx ON public.lc_generation_log(project_id, created_at DESC);

-- lc_model_routing (service-role only)
CREATE TABLE public.lc_model_routing (
  role text PRIMARY KEY,
  primary_model_id text NOT NULL,
  fallback_model_ids text[] NOT NULL DEFAULT '{}',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lc_model_routing TO service_role;
ALTER TABLE public.lc_model_routing ENABLE ROW LEVEL SECURITY;
-- no policies: authenticated users have no access

INSERT INTO public.lc_model_routing (role, primary_model_id, fallback_model_ids, notes) VALUES
  ('orchestrator', 'nvidia/nemotron-3-ultra-550b-a55b:free', ARRAY['nvidia/nemotron-3-super-120b-a12b:free'], 'Agent planning'),
  ('content',      'moonshotai/kimi-k2.6:free',              ARRAY['z-ai/glm-4.5-air:free','nvidia/nemotron-3-super-120b-a12b:free'], 'Narrative/doc/sheet logic'),
  ('code',         'poolside/laguna-m.1:free',               ARRAY['openai/gpt-oss-120b:free','qwen/qwen3-coder:free'], 'Websites/code'),
  ('visual',       'poolside/laguna-xs.2:free',              ARRAY['openai/gpt-oss-20b:free'], 'SVG/charts'),
  ('perception',   'nvidia/nemotron-nano-12b-v2-vl:free',    ARRAY['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'], 'OCR/vision'),
  ('router',       'google/gemma-4-26b-a4b-it:free',         ARRAY['nvidia/nemotron-nano-9b-v2:free'], 'Classification');

-- lc_model_cooldowns (service-role only)
CREATE TABLE public.lc_model_cooldowns (
  model_id text PRIMARY KEY,
  cooldown_until timestamptz NOT NULL,
  reason text
);
GRANT ALL ON public.lc_model_cooldowns TO service_role;
ALTER TABLE public.lc_model_cooldowns ENABLE ROW LEVEL SECURITY;
-- no policies
