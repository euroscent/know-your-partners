// Eigenes Supabase-Projekt (ersetzt die Lovable-Cloud-Verbindung über einen Alias in vite.config.ts).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const SUPABASE_URL =
  import.meta.env.VITE_EXTERNAL_SUPABASE_URL || "https://quhkqiznwatvjxgdzzpy.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aGtxaXpud2F0dmp4Z2R6enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMTE0MzgsImV4cCI6MjEwNjg4NzQzOH0.lnSx04P5XMeqtLTXtvR9QT7TM3orniOLGipr2ydWeac";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
