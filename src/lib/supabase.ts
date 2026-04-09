import { createClient } from "@supabase/supabase-js";

let rawUrl = import.meta.env.VITE_SUPABASE_URL || "";
let rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (rawUrl.startsWith("eyJ") && rawKey.startsWith("http")) {
  const tmp = rawUrl;
  rawUrl = rawKey;
  rawKey = tmp;
}

const supabaseUrl = rawUrl;
const supabaseAnonKey = rawKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
