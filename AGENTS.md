## Objective
- Maintain live site `luminaai.co.in` (React app; backend Lovable Cloud/Supabase). Keep every feature production-grade.
- Subdirectories have their own `AGENTS.md` — read before changing files there (`supabase/functions/`, `supabase/migrations/`).

## Environment
- Supabase CLI has no `db query`; check the DB via REST with service-role or the Lovable DB tools (Management API `/database/query` for raw SQL). Edge CPU quota is tight — run heavy live tests sequentially with sleeps.
- Live-test creds: QA user `lumina-qa-20260812181501@test.luminaai.co.in` (JWT in Windows Temp `opencode/qa_token.txt`); anon key in `lumina_anon_key.txt`; management token in Windows CredMan, target `Supabase CLI:supabase`. Service-role key is session-only — NEVER commit it.

## Durable rules
- Admin privileges live in `public.user_roles` (enum `app_role`) checked via `has_role()` security-definer; never gate admin features by client state. Why: prevents privilege escalation and RLS recursion on admin-only tables.
