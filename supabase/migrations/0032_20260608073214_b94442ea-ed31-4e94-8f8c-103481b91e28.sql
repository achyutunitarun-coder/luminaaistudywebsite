
CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','notion')),
  account_email text,
  account_label text,
  scopes text[] DEFAULT '{}'::text[],
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_connections TO authenticated;
GRANT ALL ON public.user_connections TO service_role;

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own connections"
  ON public.user_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own connections"
  ON public.user_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts and updates go through edge functions (service_role) so tokens
-- are never written directly from the client.

CREATE TRIGGER user_connections_touch_updated_at
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
