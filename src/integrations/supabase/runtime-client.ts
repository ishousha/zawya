// Runtime hostname-based Supabase client.
// Selects between production and staging Supabase projects based on
// window.location.hostname, so a single build can serve both environments.
//
// IMPORTANT: Only anon/publishable keys belong here. Never put service role keys.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const STAGING_HOSTNAME = "staging.zawya.app";

const STAGING_SUPABASE_URL = "https://ohlxrhcfrwqtqpeqqcva.supabase.co";
const STAGING_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_eacE1p_3SZsBucjHTurrTw_J7q3c0_s";

const PROD_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROD_SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const isStaging =
  typeof window !== "undefined" &&
  window.location.hostname === STAGING_HOSTNAME;

const SUPABASE_URL = isStaging ? STAGING_SUPABASE_URL : PROD_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = isStaging
  ? STAGING_SUPABASE_PUBLISHABLE_KEY
  : PROD_SUPABASE_PUBLISHABLE_KEY;

export const getSupabaseEnv = (): "staging" | "production" =>
  isStaging ? "staging" : "production";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
