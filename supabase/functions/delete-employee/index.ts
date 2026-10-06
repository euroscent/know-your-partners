import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (rolesError || !roles?.length) {
      return new Response(JSON.stringify({ error: "Keine Administratorrechte" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";

    if (!employeeId) {
      return new Response(JSON.stringify({ error: "employeeId fehlt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (employeeId === user.id) {
      return new Response(JSON.stringify({ error: "Sie können sich nicht selbst löschen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) throw employeeError;
    if (!employee) {
      return new Response(JSON.stringify({ error: "Mitarbeiter nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employeeName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || employee.email || employeeId;
    const historyNote = `Ehem. zugewiesen an: ${employeeName} (gelöscht am ${new Date().toLocaleDateString("de-DE")})`;

    const { data: submissionRows, error: submissionError } = await supabaseAdmin
      .from("task_submissions")
      .select("id")
      .eq("employee_id", employeeId);

    if (submissionError) throw submissionError;

    const submissionIds = (submissionRows || []).map((row) => row.id);

    const { data: assignedTasks, error: assignedTasksError } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("assigned_to", employeeId);

    if (assignedTasksError) throw assignedTasksError;

    const directCleanupResults = await Promise.all([
      supabaseAdmin.from("vmos_devices").update({ assigned_to: null }).eq("assigned_to", employeeId),
      supabaseAdmin.from("tasks").update({ created_by: user.id }).eq("created_by", employeeId),
      supabaseAdmin.from("task_file_uploads").delete().eq("user_id", employeeId),
      supabaseAdmin.from("verification_uploads").delete().eq("user_id", employeeId),
      supabaseAdmin.from("email_forwards").delete().eq("user_id", employeeId),
      supabaseAdmin.from("employee_notes").delete().eq("employee_id", employeeId),
      supabaseAdmin.from("employee_notes").update({ created_by: user.id }).eq("created_by", employeeId),
      supabaseAdmin.from("telegram_pending_replies").delete().eq("target_user_id", employeeId),
      supabaseAdmin.from("chat_messages").update({ replied_by: null }).eq("replied_by", employeeId),
      supabaseAdmin.from("chat_messages").delete().eq("user_id", employeeId),
      supabaseAdmin.from("employee_documents").delete().eq("user_id", employeeId),
      supabaseAdmin.from("payroll").delete().eq("user_id", employeeId),
      supabaseAdmin.from("freelancer_invoices").delete().eq("user_id", employeeId),
      supabaseAdmin.from("activity_logs").delete().eq("user_id", employeeId),
      supabaseAdmin.from("admin_notifications").delete().eq("user_id", employeeId),
      supabaseAdmin.from("admin_notifications").delete().eq("admin_id", employeeId),
      supabaseAdmin.from("admin_presence").delete().eq("admin_id", employeeId),
      supabaseAdmin.from("security_events").update({ user_id: null, resolved_by: null }).or(`user_id.eq.${employeeId},resolved_by.eq.${employeeId}`),
      supabaseAdmin.from("applications").update({ reviewed_by: null }).eq("reviewed_by", employeeId),
      supabaseAdmin.from("task_submissions").update({ reviewed_by: null }).eq("reviewed_by", employeeId),
      supabaseAdmin.from("task_completion_emails_sent").update({ sent_by: null }).eq("sent_by", employeeId),
      supabaseAdmin.from("profiles").update({ mentor_id: null }).eq("mentor_id", employeeId),
    ]);

    const directCleanupError = directCleanupResults.find((result) => result?.error)?.error;
    if (directCleanupError) throw directCleanupError;

    if (assignedTasks?.length) {
      const assignedTaskIds = assignedTasks.map((task) => task.id);

      // Check if other employees have submissions for these tasks
      const { data: otherSubmissions, error: otherSubError } = await supabaseAdmin
        .from("task_submissions")
        .select("id, task_id")
        .in("task_id", assignedTaskIds)
        .neq("employee_id", employeeId);

      if (otherSubError) throw otherSubError;

      // Tasks with submissions from others: just unassign
      const tasksWithOtherSubs = new Set((otherSubmissions || []).map((s) => s.task_id));
      const tasksToPureDelete = assignedTaskIds.filter((id) => !tasksWithOtherSubs.has(id));
      const tasksToUnassign = assignedTaskIds.filter((id) => tasksWithOtherSubs.has(id));

      if (tasksToUnassign.length) {
        const { error: unassignErr } = await supabaseAdmin
          .from("tasks")
          .update({ assigned_to: null })
          .in("id", tasksToUnassign);
        if (unassignErr) throw unassignErr;
      }

      if (tasksToPureDelete.length) {
        // Delete dependent submissions first to avoid NOT NULL violation on task_id
        const { data: subsToDelete, error: subsLookupError } = await supabaseAdmin
          .from("task_submissions")
          .select("id")
          .in("task_id", tasksToPureDelete);
        if (subsLookupError) throw subsLookupError;

        const subIdsToDelete = (subsToDelete || []).map((s) => s.id);
        if (subIdsToDelete.length) {
          const subCleanup = await Promise.all([
            supabaseAdmin.from("received_emails").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("sms_forwards").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("task_completion_emails_sent").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("freelancer_invoices").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("activity_logs").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("agent_activity_log").delete().in("submission_id", subIdsToDelete),
            supabaseAdmin.from("generated_emails").update({ submission_id: null }).in("submission_id", subIdsToDelete),
          ]);
          const subCleanupErr = subCleanup.find((r) => r.error)?.error;
          if (subCleanupErr) throw subCleanupErr;

          const { error: subDelErr } = await supabaseAdmin
            .from("task_submissions")
            .delete()
            .in("id", subIdsToDelete);
          if (subDelErr) throw subDelErr;
        }

        const { error: deleteAssignedTasksError } = await supabaseAdmin
          .from("tasks")
          .delete()
          .in("id", tasksToPureDelete);
        if (deleteAssignedTasksError) throw deleteAssignedTasksError;
      }
    }

    const { data: assignedPhones, error: assignedPhonesError } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, notes")
      .eq("assigned_to", employeeId);
    if (assignedPhonesError) throw assignedPhonesError;

    if (assignedPhones?.length) {
      const phoneResults = await Promise.all(
        assignedPhones.map((phone) => {
          const updatedNotes = phone.notes ? `${phone.notes}\n${historyNote}` : historyNote;
          return supabaseAdmin
            .from("phone_numbers")
            .update({ assigned_to: null, notes: updatedNotes })
            .eq("id", phone.id);
        }),
      );
      const phoneError = phoneResults.find((result) => result.error)?.error;
      if (phoneError) throw phoneError;
    }

    const { data: assignedEmails, error: assignedEmailsError } = await supabaseAdmin
      .from("email_accounts")
      .select("id, notes")
      .eq("assigned_to", employeeId);
    if (assignedEmailsError) throw assignedEmailsError;

    if (assignedEmails?.length) {
      const emailResults = await Promise.all(
        assignedEmails.map((emailAccount) => {
          const updatedNotes = emailAccount.notes ? `${emailAccount.notes}\n${historyNote}` : historyNote;
          return supabaseAdmin
            .from("email_accounts")
            .update({ assigned_to: null, notes: updatedNotes })
            .eq("id", emailAccount.id);
        }),
      );
      const emailError = emailResults.find((result) => result.error)?.error;
      if (emailError) throw emailError;
    }

    const { data: assignedGeneratedEmails, error: assignedGeneratedEmailsError } = await supabaseAdmin
      .from("generated_emails")
      .select("id, notes")
      .eq("user_id", employeeId);
    if (assignedGeneratedEmailsError) throw assignedGeneratedEmailsError;

    if (assignedGeneratedEmails?.length) {
      const generatedEmailResults = await Promise.all(
        assignedGeneratedEmails.map((generatedEmail) => {
          const updatedNotes = generatedEmail.notes ? `${generatedEmail.notes}\n${historyNote}` : historyNote;
          return supabaseAdmin
            .from("generated_emails")
            .update({ user_id: null, submission_id: null, notes: updatedNotes })
            .eq("id", generatedEmail.id);
        }),
      );
      const generatedEmailError = generatedEmailResults.find((result) => result.error)?.error;
      if (generatedEmailError) throw generatedEmailError;
    }

    if (submissionIds.length > 0) {
      const submissionCleanupResults = await Promise.all([
        supabaseAdmin.from("received_emails").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("sms_forwards").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("task_completion_emails_sent").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("freelancer_invoices").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("activity_logs").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("agent_activity_log").delete().in("submission_id", submissionIds),
        supabaseAdmin.from("generated_emails").update({ submission_id: null }).in("submission_id", submissionIds),
      ]);

      const submissionCleanupError = submissionCleanupResults.find((result) => result.error)?.error;
      if (submissionCleanupError) throw submissionCleanupError;
    }

    const { error: submissionsDeleteError } = await supabaseAdmin
      .from("task_submissions")
      .delete()
      .eq("employee_id", employeeId);
    if (submissionsDeleteError) throw submissionsDeleteError;

    const { error: userRolesDeleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", employeeId);
    if (userRolesDeleteError) throw userRolesDeleteError;

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", employeeId);
    if (profileDeleteError) throw profileDeleteError;

    // Delete the auth user so they can no longer log in
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(employeeId);
    if (authDeleteError) throw authDeleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-employee error:", error);
    const message = error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});