import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://mnljpvotimtxkufwkano.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubGpwdm90aW10eGt1ZndrYW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjY1MjYsImV4cCI6MjA5NzQ0MjUyNn0.w4aYYhBq5wA2093s_-rT55F_QSbugAFRAnqjhsgWXAI";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
