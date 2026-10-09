import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/utils/supabase/env";

/**
 * Browser Supabase client (cookie session via @supabase/ssr).
 * Safe to call repeatedly — createBrowserClient is a singleton in the browser.
 */
export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient(url, key);
}

export { isSupabaseConfigured };
