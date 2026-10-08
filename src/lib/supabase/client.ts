"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/env";

/**
 * Thin wrapper over `@/utils/supabase/client` for existing Word Forge call sites.
 * Prefer importing from `@/utils/supabase/*` for new code.
 */
export { isSupabaseConfigured };

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient();
}
