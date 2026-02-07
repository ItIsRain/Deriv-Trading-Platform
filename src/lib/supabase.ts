import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url') {
  console.warn('Supabase URL not configured. Using mock data.');
}

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use this in server components or API routes, NEVER expose to client
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase; // Fallback to regular client if no service role key

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseUrl !== 'your_supabase_project_url' &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'your_supabase_anon_key'
  );
}

// Helper to check if admin client is available
export function isAdminConfigured(): boolean {
  return Boolean(supabaseServiceRoleKey);
}
