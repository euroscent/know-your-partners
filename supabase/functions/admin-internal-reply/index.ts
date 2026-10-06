import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AdminInternalReplyRequest {
  employee_id: string;
  subject: string;
  body_text: string;
  submission_id: string;
  task_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticated client (identify caller)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = authData.user.id;

    // Service role client (server-side insert)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorize: only admins
    const { data: isAdminRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !isAdminRow) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AdminInternalReplyRequest = await req.json();

    if (
      !body?.employee_id ||
      !body?.subject ||
      !body?.body_text ||
      !body?.submission_id
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Resolve employee email (recipient)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", body.employee_id)
      .single();
    if (profileError || !profile?.email) {
      console.error("Profile lookup failed:", profileError);
      return new Response(JSON.stringify({ success: false, error: "Employee email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toAddress = profile.email;

    // Resolve task mailbox to use as FROM (priority: generated_email -> task email_account -> assigned outlook)
    let mailboxFrom: string | null = null;

    const { data: generatedEmail, error: genError } = await supabase
      .from("generated_emails")
      .select("full_address")
      .eq("submission_id", body.submission_id)
      .eq("is_active", true)
      .maybeSingle();
    if (genError) {
      console.error("generated_emails lookup failed:", genError);
    }
    if (generatedEmail?.full_address) {
      mailboxFrom = generatedEmail.full_address;
    }

    if (!mailboxFrom && body.task_id) {
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("email_account_id")
        .eq("id", body.task_id)
        .maybeSingle();
      if (taskError) {
        console.error("task lookup failed:", taskError);
      }

      if (task?.email_account_id) {
        const { data: account, error: accError } = await supabase
          .from("email_accounts")
          .select("email_address")
          .eq("id", task.email_account_id)
          .maybeSingle();
        if (accError) {
          console.error("email account lookup failed:", accError);
        }
        if (account?.email_address) mailboxFrom = account.email_address;
      }
    }

    if (!mailboxFrom) {
      const { data: assigned, error: assignedError } = await supabase
        .from("email_accounts")
        .select("email_address")
        .eq("assigned_to", body.employee_id)
        .eq("status", "assigned")
        .maybeSingle();
      if (assignedError) {
        console.error("assigned mailbox lookup failed:", assignedError);
      }
      if (assigned?.email_address) mailboxFrom = assigned.email_address;
    }

    if (!mailboxFrom) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No task mailbox found",
          details: "Weder Custom-Domain noch zugewiesenes Outlook-Konto gefunden.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert message so employee can see it in their task inbox.
    // IMPORTANT: from_address must be the task mailbox (Outlook/custom), not "Admin (intern)".
    const fromAddress = `EPP <${mailboxFrom}>`;

    const htmlSafe = body.body_text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\n", "<br/>");

    const { error: insertError } = await supabase.from("received_emails").insert({
      to_address: toAddress,
      from_address: fromAddress,
      subject: body.subject,
      body_text: body.body_text,
      body_html: `<div style="font-family: sans-serif; padding: 16px;">
        <p style="margin-bottom: 16px;">${htmlSafe}</p>
      </div>`,
      received_at: new Date().toISOString(),
      is_read: false,
      submission_id: body.submission_id,
      task_id: body.task_id,
      headers: {
        internal_admin_reply: true,
        employee_id: body.employee_id,
        mailbox_from: mailboxFrom,
        created_by: callerId,
      },
    });

    if (insertError) {
      console.error("Insert failed:", insertError);
      return new Response(JSON.stringify({ success: false, error: "Insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-internal-reply:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
