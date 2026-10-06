import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ForwardInternalEmailRequest {
  email_id: string;
  employee_id?: string; // Optional - if not provided, auto-resolve from to_address
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticated client (to read the caller)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = authData.user.id;

    // Service role client (bypass RLS for server-side internal copy)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorize: only admins
    const { data: isAdminRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !isAdminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ForwardInternalEmailRequest = await req.json();
    const emailId = body?.email_id;
    let employeeId = body?.employee_id;

    if (!emailId) {
      return new Response(JSON.stringify({ error: "Missing email_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load original email - preserve original sender and timestamp
    const { data: sourceEmail, error: emailError } = await supabase
      .from("received_emails")
      .select("id, subject, body_html, body_text, task_id, from_address, received_at, to_address")
      .eq("id", emailId)
      .single();

    if (emailError || !sourceEmail) {
      return new Response(JSON.stringify({ error: "Email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-resolve employee from to_address if not provided
    if (!employeeId && sourceEmail.to_address) {
      const toAddr = sourceEmail.to_address.toLowerCase().trim();
      
      // Try generated_emails first (custom domains like pxpertmail.online)
      const { data: genEmail } = await supabase
        .from("generated_emails")
        .select("user_id, submission_id")
        .ilike("full_address", toAddr)
        .eq("is_active", true)
        .maybeSingle();
      
      if (genEmail?.user_id) {
        employeeId = genEmail.user_id;
        console.log(`Auto-resolved employee ${employeeId} from generated_emails (${toAddr})`);
      } else {
        // Try email_accounts (Outlook accounts)
        const { data: emailAccount } = await supabase
          .from("email_accounts")
          .select("assigned_to")
          .ilike("email_address", toAddr)
          .eq("status", "assigned")
          .maybeSingle();
        
        if (emailAccount?.assigned_to) {
          employeeId = emailAccount.assigned_to;
          console.log(`Auto-resolved employee ${employeeId} from email_accounts (${toAddr})`);
        }
      }
    }

    if (!employeeId) {
      return new Response(
        JSON.stringify({
          error: "Could not resolve employee",
          message: "Die Ziel-Adresse konnte keinem Mitarbeiter zugeordnet werden.",
          to_address: sourceEmail.to_address,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find newest submission to link so it appears in employee inbox
    const { data: submissions, error: submissionsError } = await supabase
      .from("task_submissions")
      .select("id")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return new Response(JSON.stringify({ error: "Failed to fetch employee submissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submissionId = submissions?.[0]?.id;
    if (!submissionId) {
      return new Response(
        JSON.stringify({
          error: "Employee has no submission",
          message: "Der Mitarbeiter benötigt mindestens einen Auftragsantritt, um Nachrichten zu empfangen.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create copy preserving ORIGINAL sender but using current time for sorting
    // Original timestamp is preserved in headers for reference
    const { error: insertError } = await supabase.from("received_emails").insert({
      to_address: sourceEmail.to_address,
      from_address: sourceEmail.from_address, // Keep original sender
      subject: sourceEmail.subject,
      body_html: sourceEmail.body_html,
      body_text: sourceEmail.body_text,
      received_at: new Date().toISOString(), // Use current time so it appears at top of inbox
      is_read: false,
      submission_id: submissionId,
      task_id: sourceEmail.task_id,
      headers: {
        manual_routing: true, // Admin manually routed this to employee
        source_email_id: sourceEmail.id,
        original_received_at: sourceEmail.received_at, // Preserve original timestamp
        routed_by: callerId,
        routed_at: new Date().toISOString(),
      },
    });

    if (insertError) {
      console.error("Insert failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create internal copy" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve employee name for response
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", employeeId)
      .maybeSingle();

    const employeeName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Mitarbeiter"
      : "Mitarbeiter";

    return new Response(JSON.stringify({ 
      success: true,
      employee_id: employeeId,
      employee_name: employeeName,
      to_address: sourceEmail.to_address,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in forward-internal-email:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
