import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getApiKey(keyName: string): Promise<string | null> {
  const envValue = Deno.env.get(keyName);
  if (envValue) return envValue;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const client = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await client
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", keyName)
      .maybeSingle();

    return data?.setting_value || null;
  } catch (err) {
    console.error(`[getApiKey] Failed to read ${keyName} from system_settings:`, err);
    return null;
  }
}
