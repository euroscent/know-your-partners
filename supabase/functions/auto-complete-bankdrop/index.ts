import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5 Minuten Schwelle
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Hole alle in_progress Bankdrop Submissions mit SMS-Code
    const { data: submissions, error: fetchError } = await supabase
      .from("task_submissions")
      .select("id, task_id, employee_id, admin_data, created_at, tasks!inner(category)")
      .eq("status", "in_progress")
      .eq("tasks.category", "bankdrop");

    if (fetchError) throw fetchError;

    const eligible = (submissions || []).filter((s: any) => {
      const adminData = s.admin_data || {};
      const smsAt = adminData.sms_code_received_at;
      const kycDone = adminData.kyc_completed === true;
      if (!smsAt || kycDone) return false;

      // Validate sms_code_received_at is a real timestamp (string or number)
      if (typeof smsAt !== "string" && typeof smsAt !== "number") {
        console.warn(`[auto-complete-bankdrop] Skipping ${s.id}: sms_code_received_at has invalid type (${typeof smsAt})`);
        return false;
      }

      const parsed = new Date(smsAt);
      if (isNaN(parsed.getTime())) {
        console.warn(`[auto-complete-bankdrop] Skipping ${s.id}: sms_code_received_at is not a valid date (${smsAt})`);
        return false;
      }

      // Reject implausible timestamps (future dates or before 2020)
      const now = Date.now();
      const ts = parsed.getTime();
      if (ts > now || ts < new Date("2020-01-01").getTime()) {
        console.warn(`[auto-complete-bankdrop] Skipping ${s.id}: sms_code_received_at is implausible (${parsed.toISOString()})`);
        return false;
      }

      // CRITICAL SAFETY GUARD: SMS must have arrived AFTER the submission was created.
      // Prevents stale promotional SMS (saved before the task even existed) from
      // auto-completing the task when a stray polling cycle picked them up.
      const submissionStart = s.created_at ? new Date(s.created_at).getTime() : 0;
      if (ts < submissionStart) {
        console.warn(`[auto-complete-bankdrop] Skipping ${s.id}: sms_code_received_at (${parsed.toISOString()}) predates submission start (${new Date(submissionStart).toISOString()})`);
        return false;
      }

      // SAFETY GUARD: ignore SMS older than 24h regardless of submission time
      if (now - ts > 24 * 60 * 60 * 1000) {
        console.warn(`[auto-complete-bankdrop] Skipping ${s.id}: sms_code_received_at older than 24h (${parsed.toISOString()})`);
        return false;
      }

      return parsed.toISOString() <= fiveMinutesAgo;
    });

    console.log(`[auto-complete-bankdrop] Found ${eligible.length} eligible submissions`);

    const results: any[] = [];
    for (const sub of eligible) {
      const newAdminData = {
        ...(sub.admin_data || {}),
        kyc_completed: true,
        kyc_completed_at: new Date().toISOString(),
        kyc_completed_by: "system_auto",
      };

      const { error: updateError } = await supabase
        .from("task_submissions")
        .update({
          admin_data: newAdminData,
          status: "awaiting_review",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updateError) {
        console.error(`Failed to update ${sub.id}:`, updateError);
        results.push({ id: sub.id, success: false, error: updateError.message });
      } else {
        console.log(`[auto-complete-bankdrop] Completed submission ${sub.id}`);
        results.push({ id: sub.id, success: true });
      }
    }

    return new Response(
      JSON.stringify({
        processed: eligible.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[auto-complete-bankdrop] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
