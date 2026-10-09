/** Public Supabase credentials (URL + publishable key). */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getSupabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
