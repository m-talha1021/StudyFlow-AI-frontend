import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    "Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your frontend environment."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabasePublishableKey || "missing-publishable-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
