import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_API_KEY = Deno.env.get("MCP_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Action handlers ──
const actions: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {

  async list_employees(params) {
    let query = supabase
      .from("profiles")
      .select("id, first_name, last_name, salutation, birth_date, city, postal_code, street, nationality, employment_type, verified, verification_method, created_at, mentor_id, place_of_birth, country_of_birth");
    if (params.verified_only) query = query.eq("verified", true);
    if (params.unverified_only) query = query.eq("verified", false);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async get_employee(params) {
    if (!params.employee_id) throw new Error("employee_id erforderlich");
    let query = supabase.from("profiles").select("id, first_name, last_name, salutation, birth_date, city, postal_code, street, nationality, employment_type, verified, verification_method, created_at, mentor_id, place_of_birth, country_of_birth, alt_street, alt_postal_code, alt_city, iban, bic, account_holder, tax_id, tax_class, social_security_number, health_insurance, marital_status, children_count, church_tax_liable, federal_state, start_date, signature_data, avatar_url");
    query = query.eq("id", params.employee_id);
    const { data, error } = await query.single();
    if (error) throw error;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.id);
    return { ...data, roles: roles?.map((r: { role: string }) => r.role) || [] };
  },

  async get_employee_id_documents(params) {
    const employeeId = params.employee_id as string;
    if (!employeeId) throw new Error("employee_id erforderlich");
    const { data: files, error } = await supabase.storage.from("kyc-uploads").list(employeeId, { limit: 20 });
    if (error) throw error;
    if (!files || files.length === 0) return { message: "Keine Ausweisbilder gefunden." };
    const results = [];
    for (const file of files) {
      const { data: signedUrl } = await supabase.storage.from("kyc-uploads").createSignedUrl(`${employeeId}/${file.name}`, 3600);
      results.push({ name: file.name, size: file.metadata?.size, created: file.created_at, url: signedUrl?.signedUrl || null });
    }
    return results;
  },

  async get_verification_data(params) {
    if (!params.employee_id) throw new Error("employee_id erforderlich");
    const { data, error } = await supabase.from("verification_uploads").select("*").eq("user_id", params.employee_id).order("uploaded_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async list_tasks(params) {
    let query = supabase.from("tasks").select("id, title, description, status, priority, assigned_to, template_id, compensation_amount, tags, task_type, is_starter_job, created_at");
    if (params.templates_only) query = query.is("assigned_to", null);
    if (params.assigned_only) query = query.not("assigned_to", "is", null);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async list_submissions(params) {
    let query = supabase.from("task_submissions").select("id, task_id, employee_id, status, step_responses, notes, submitted_at, reviewed_at, admin_data, checklist_completed, checklist_data");
    if (params.status) query = query.eq("status", params.status);
    if (params.task_id) query = query.eq("task_id", params.task_id);
    if (params.employee_id) query = query.eq("employee_id", params.employee_id);
    const { data, error } = await query.order("submitted_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data;
  },

  async get_submission_files(params) {
    if (!params.task_id || !params.user_id) throw new Error("task_id und user_id erforderlich");
    const { data: uploads, error } = await supabase.from("task_file_uploads").select("*").eq("task_id", params.task_id).eq("user_id", params.user_id);
    if (error) throw error;
    const results = [];
    for (const upload of uploads || []) {
      let url = null;
      if (upload.storage_path) {
        const { data: signedUrl } = await supabase.storage.from("task-files").createSignedUrl(upload.storage_path, 3600);
        url = signedUrl?.signedUrl || null;
      }
      results.push({ id: upload.id, file_name: upload.file_name, step_id: upload.step_id, mime_type: upload.mime_type, file_size: upload.file_size, uploaded_at: upload.uploaded_at, download_url: url });
    }
    return results;
  },

  async update_verification_status(params) {
    if (!params.employee_id) throw new Error("employee_id erforderlich");
    const updateData: Record<string, unknown> = { verified: params.verified };
    if (params.verification_method) updateData.verification_method = params.verification_method;
    const { data, error } = await supabase.from("profiles").update(updateData).eq("id", params.employee_id).select("id, email, first_name, last_name, verified, verification_method").single();
    if (error) throw error;
    return data;
  },

  async get_employee_resources(params) {
    const eid = params.employee_id as string;
    if (!eid) throw new Error("employee_id erforderlich");
    const { data: profile } = await supabase.from("profiles").select("street, postal_code, city, alt_street, alt_postal_code, alt_city, first_name, last_name").eq("id", eid).single();
    const mainAddress = { street: profile?.street, postal_code: profile?.postal_code, city: profile?.city };
    const altAddress = (profile?.alt_street || profile?.alt_postal_code || profile?.alt_city) ? { street: profile.alt_street, postal_code: profile.alt_postal_code, city: profile.alt_city } : null;
    const [emailsRes, phonesRes, emailAccountsRes, tasksRes] = await Promise.all([
      supabase.from("generated_emails").select("id, full_address, local_part, is_active, created_at, task_id, submission_id").eq("user_id", eid),
      supabase.from("phone_numbers").select("id, phone_number, provider, status, country, service_name, rent_type, rented_since").eq("assigned_to", eid),
      supabase.from("email_accounts").select("id, email_address, provider, status").eq("assigned_to", eid),
      supabase.from("tasks").select("id, title, status, task_type, compensation_amount").eq("assigned_to", eid),
    ]);
    const tasks = tasksRes.data || [];
    return {
      employee_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
      hauptadresse_ausweis: mainAddress,
      abweichende_adresse: altAddress,
      generated_emails: emailsRes.data || [],
      assigned_phone_numbers: phonesRes.data || [],
      assigned_email_accounts: emailAccountsRes.data || [],
      assigned_tasks: tasks,
    };
  },

  async get_received_emails(params) {
    const limit = (params.limit as number) || 20;
    let emailQuery = supabase.from("received_emails").select("id, from_address, to_address, subject, body_text, is_read, received_at, task_id, submission_id").order("received_at", { ascending: false }).limit(limit);
    if (params.submission_id) emailQuery = emailQuery.eq("submission_id", params.submission_id);
    if (params.task_id) emailQuery = emailQuery.eq("task_id", params.task_id);
    if (params.unread_only) emailQuery = emailQuery.eq("is_read", false);
    let fwdQuery = supabase.from("email_forwards").select("id, subject, sender, body, code_extracted, link_extracted, received_at, task_id, user_id").order("received_at", { ascending: false }).limit(limit);
    if (params.employee_id) fwdQuery = fwdQuery.eq("user_id", params.employee_id);
    if (params.task_id) fwdQuery = fwdQuery.eq("task_id", params.task_id);
    const [emailResult, fwdResult] = await Promise.all([emailQuery, fwdQuery]);
    return { received_emails: emailResult.data || [], email_forwards_with_codes: fwdResult.data || [] };
  },

};

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse body first (needed for api_key in body)
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check - accept: headers, query params, or body api_key
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");
  const mcpApiKey = req.headers.get("mcp-api-key");
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("api_key");
  const bodyKey = body.api_key as string | undefined;

  // Extract bearer token (skip Supabase JWTs that start with eyJ)
  let bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken && bearerToken.startsWith("eyJ")) {
    bearerToken = undefined;
  }

  const token = bearerToken || xApiKey || mcpApiKey || queryKey || bodyKey;

  if (!MCP_API_KEY || token !== MCP_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, params = {} } = body;

    if (!action) {
      return new Response(JSON.stringify({
        error: "action erforderlich",
        available_actions: Object.keys(actions),
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const handler = actions[action];
    if (!handler) {
      return new Response(JSON.stringify({
        error: `Unbekannte Action: ${action}`,
        available_actions: Object.keys(actions),
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await handler(params);
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[webhook-api] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
