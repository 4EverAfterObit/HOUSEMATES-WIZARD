import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // This only shows up in the server/build log, never to visitors.
  console.warn("Supabase env vars are missing. Check Vercel's Environment Variables.");
}

export const supabase = createClient(url || "https://example.supabase.co", anonKey || "missing-key");
