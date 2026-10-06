import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  task_id?: string;
  submission_id?: string;
  email_addresses?: string[];
  since_timestamp?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json().catch(() => ({}));
    const taskId = body.task_id;
    const submissionId = body.submission_id;
    const emailAddresses = Array.from(new Set((body.email_addresses || []).filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim().toLowerCase())));
    const sinceTimestamp = body.since_timestamp;
    const limit = Math.min(Math.max(body.limit || 5, 1), 20);

    if (!taskId || !submissionId || emailAddresses.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: submission, error: submissionError } = await supabase
      .from("task_submissions")
      .select("id, employee_id, task_id")
      .eq("id", submissionId)
      .eq("task_id", taskId)
      .maybeSingle();

    if (submissionError || !submission || submission.employee_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const escapedAddresses = emailAddresses
      .map((email) => `to_address.eq.${email.replaceAll(",", "\\,")}`)
      .join(",");

    const orFilters = [
      escapedAddresses,
      `submission_id.eq.${submissionId}`,
      `task_id.eq.${taskId}`,
    ].filter(Boolean).join(",");

    let query = supabase
      .from("received_emails")
      .select("id, from_address, subject, body_text, body_html, received_at, to_address, headers, submission_id, task_id")
      .or(orFilters)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (sinceTimestamp) {
      query = query.gt("received_at", sinceTimestamp);
    }

    const { data: emails, error: emailsError } = await query;

    if (emailsError) {
      console.error("Error fetching task received emails:", emailsError);
      return new Response(JSON.stringify({ error: "Failed to fetch emails" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filteredEmails = (emails || []).filter((email) => {
      const emailTo = (email.to_address || "").toLowerCase();
      return emailAddresses.includes(emailTo) || email.submission_id === submissionId || email.task_id === taskId;
    });

    return new Response(JSON.stringify({ emails: filteredEmails }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-task-received-emails:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
