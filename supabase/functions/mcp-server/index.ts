import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_API_KEY = Deno.env.get("MCP_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = new Hono();

// Auth middleware
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  
  const authHeader = c.req.header("Authorization");
  const xApiKey = c.req.header("X-API-Key");
  const mcpApiKey = c.req.header("MCP-API-Key");
  const token = authHeader?.replace("Bearer ", "").trim() || xApiKey || mcpApiKey;
  
  if (!MCP_API_KEY || token !== MCP_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  return next();
});

const mcpServer = new McpServer({
  name: "euroscent-admin",
  version: "1.0.0",
});

// ── list_employees ──
mcpServer.tool("list_employees", {
  description: "Liste aller Mitarbeiterprofile mit Verifizierungsstatus, E-Mail, Name, Beschäftigungsart. Optional nach verified-Status filtern.",
  inputSchema: {
    type: "object",
    properties: {
      verified_only: { type: "boolean", description: "Nur verifizierte Mitarbeiter" },
      unverified_only: { type: "boolean", description: "Nur nicht-verifizierte Mitarbeiter" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let query = supabase
      .from("profiles")
      .select("id, first_name, last_name, salutation, birth_date, city, postal_code, street, nationality, employment_type, verified, verification_method, created_at, mentor_id, place_of_birth, country_of_birth");

    if (params.verified_only) query = query.eq("verified", true);
    if (params.unverified_only) query = query.eq("verified", false);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_employee ──
mcpServer.tool("get_employee", {
  description: "Detailliertes Profil eines Mitarbeiters inkl. Bankdaten, Adresse, Steuerinfo, Sozialversicherung. OHNE private Telefonnummer und Kontakt-E-Mail.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
    },
    required: ["employee_id"],
  },
  handler: async (params: Record<string, unknown>) => {
    if (!params.employee_id) return { content: [{ type: "text" as const, text: "employee_id erforderlich" }] };
    let query = supabase.from("profiles").select("id, first_name, last_name, salutation, birth_date, city, postal_code, street, nationality, employment_type, verified, verification_method, created_at, mentor_id, place_of_birth, country_of_birth, alt_street, alt_postal_code, alt_city, iban, bic, account_holder, tax_id, tax_class, social_security_number, health_insurance, marital_status, children_count, church_tax_liable, federal_state, start_date, signature_data, avatar_url");
    query = query.eq("id", params.employee_id);

    const { data, error } = await query.single();
    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ ...data, roles: roles?.map((r: { role: string }) => r.role) || [] }, null, 2) }],
    };
  },
});

// ── get_employee_id_documents ──
mcpServer.tool("get_employee_id_documents", {
  description: "Gibt signierte URLs für die Ausweisbilder (Vorder- und Rückseite) eines Mitarbeiters aus dem kyc-uploads Bucket zurück.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
    },
    required: ["employee_id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const employeeId = params.employee_id as string;
    const { data: files, error } = await supabase.storage
      .from("kyc-uploads")
      .list(employeeId, { limit: 20 });

    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    if (!files || files.length === 0) {
      return { content: [{ type: "text" as const, text: "Keine Ausweisbilder gefunden für diesen Mitarbeiter." }] };
    }

    const results = [];
    for (const file of files) {
      const path = `${employeeId}/${file.name}`;
      const { data: signedUrl } = await supabase.storage
        .from("kyc-uploads")
        .createSignedUrl(path, 3600);
      results.push({
        name: file.name,
        size: file.metadata?.size,
        created: file.created_at,
        url: signedUrl?.signedUrl || null,
      });
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  },
});

// ── get_verification_data ──
mcpServer.tool("get_verification_data", {
  description: "Extrahierte Ausweisdaten (Name, Geburtsdatum, Nationalität, etc.) aus der AI-Erkennung für einen Mitarbeiter.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
    },
    required: ["employee_id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("verification_uploads")
      .select("*")
      .eq("user_id", params.employee_id)
      .order("uploaded_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── list_tasks ──
mcpServer.tool("list_tasks", {
  description: "Alle Tasks (Templates und zugewiesene). Templates haben assigned_to=null.",
  inputSchema: {
    type: "object",
    properties: {
      templates_only: { type: "boolean", description: "Nur Templates (nicht zugewiesene)" },
      assigned_only: { type: "boolean", description: "Nur zugewiesene Tasks" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let query = supabase
      .from("tasks")
      .select("id, title, description, status, priority, assigned_to, template_id, compensation_amount, tags, task_type, is_starter_job, created_at");

    if (params.templates_only) query = query.is("assigned_to", null);
    if (params.assigned_only) query = query.not("assigned_to", "is", null);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── list_submissions ──
mcpServer.tool("list_submissions", {
  description: "Task-Submissions mit Status, Step-Responses und Mitarbeiter-Info. Optional nach Status filtern.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter: pending, approved, rejected" },
      task_id: { type: "string", description: "Filter nach Task-ID" },
      employee_id: { type: "string", description: "Filter nach Mitarbeiter-ID" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let query = supabase
      .from("task_submissions")
      .select("id, task_id, employee_id, status, step_responses, notes, submitted_at, reviewed_at, admin_data, checklist_completed, checklist_data");

    if (params.status) query = query.eq("status", params.status);
    if (params.task_id) query = query.eq("task_id", params.task_id);
    if (params.employee_id) query = query.eq("employee_id", params.employee_id);

    const { data, error } = await query.order("submitted_at", { ascending: false }).limit(50);
    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_submission_files ──
mcpServer.tool("get_submission_files", {
  description: "Hochgeladene Dateien einer bestimmten Task-Submission mit signierten Download-URLs.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "Task-ID" },
      user_id: { type: "string", description: "User-ID des Mitarbeiters" },
    },
    required: ["task_id", "user_id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const { data: uploads, error } = await supabase
      .from("task_file_uploads")
      .select("*")
      .eq("task_id", params.task_id)
      .eq("user_id", params.user_id);

    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };

    const results = [];
    for (const upload of uploads || []) {
      let url = null;
      if (upload.storage_path) {
        const { data: signedUrl } = await supabase.storage
          .from("task-files")
          .createSignedUrl(upload.storage_path, 3600);
        url = signedUrl?.signedUrl || null;
      }
      results.push({
        id: upload.id,
        file_name: upload.file_name,
        step_id: upload.step_id,
        mime_type: upload.mime_type,
        file_size: upload.file_size,
        uploaded_at: upload.uploaded_at,
        download_url: url,
      });
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  },
});

// ── update_verification_status ──
mcpServer.tool("update_verification_status", {
  description: "Setzt den Verifizierungsstatus eines Mitarbeiters auf verifiziert oder nicht-verifiziert.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
      verified: { type: "boolean", description: "true = verifiziert, false = nicht verifiziert" },
      verification_method: { type: "string", description: "Methode der Verifizierung (z.B. 'kilo-code-ai', 'manual')" },
    },
    required: ["employee_id", "verified"],
  },
  handler: async (params: Record<string, unknown>) => {
    const updateData: Record<string, unknown> = { verified: params.verified };
    if (params.verification_method) updateData.verification_method = params.verification_method;

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", params.employee_id)
      .select("id, email, first_name, last_name, verified, verification_method")
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Fehler: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Verifizierung aktualisiert: ${JSON.stringify(data, null, 2)}` }] };
  },
});

// ── get_employee_resources ──
mcpServer.tool("get_employee_resources", {
  description: "Zugewiesene Ressourcen eines Mitarbeiters: generierte E-Mails, Arbeits-Rufnummern, E-Mail-Konten, Tasks, abweichende Adresse und Ident-Automation-Einstellungen pro zugewiesenem Task.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
    },
    required: ["employee_id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const eid = params.employee_id as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("street, postal_code, city, alt_street, alt_postal_code, alt_city, first_name, last_name")
      .eq("id", eid)
      .single();

    const mainAddress = { street: profile?.street, postal_code: profile?.postal_code, city: profile?.city };
    const altAddress = (profile?.alt_street || profile?.alt_postal_code || profile?.alt_city)
      ? { street: profile.alt_street, postal_code: profile.alt_postal_code, city: profile.alt_city }
      : null;

    const { data: emails } = await supabase
      .from("generated_emails")
      .select("id, full_address, local_part, is_active, created_at, task_id, submission_id")
      .eq("user_id", eid);

    const { data: phones } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, provider, status, country, service_name, rent_type, rented_since")
      .eq("assigned_to", eid);

    const { data: emailAccounts } = await supabase
      .from("email_accounts")
      .select("id, email_address, provider, status")
      .eq("assigned_to", eid);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, task_type, compensation_amount")
      .eq("assigned_to", eid);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          hinweis: "NUR zugewiesene Arbeits-Ressourcen. Private Telefonnummer ist NICHT enthalten.",
          employee_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
          hauptadresse_ausweis: mainAddress,
          abweichende_adresse: altAddress,
          generated_emails: emails || [],
          assigned_phone_numbers: phones || [],
          assigned_email_accounts: emailAccounts || [],
          assigned_tasks: tasks || [],
        }, null, 2),
      }],
    };
  },
});

// ── get_received_emails ──
mcpServer.tool("get_received_emails", {
  description: "Empfangene E-Mails für einen Mitarbeiter oder eine Submission. Enthält extrahierte Codes und Links.",
  inputSchema: {
    type: "object",
    properties: {
      employee_id: { type: "string", description: "UUID des Mitarbeiters" },
      submission_id: { type: "string", description: "Optional: Filter nach Submission-ID" },
      task_id: { type: "string", description: "Optional: Filter nach Task-ID" },
      limit: { type: "number", description: "Max Ergebnisse (default 20)" },
      unread_only: { type: "boolean", description: "Nur ungelesene E-Mails" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const limit = (params.limit as number) || 20;

    let emailQuery = supabase
      .from("received_emails")
      .select("id, from_address, to_address, subject, body_text, is_read, received_at, task_id, submission_id")
      .order("received_at", { ascending: false })
      .limit(limit);

    if (params.submission_id) emailQuery = emailQuery.eq("submission_id", params.submission_id);
    if (params.task_id) emailQuery = emailQuery.eq("task_id", params.task_id);
    if (params.unread_only) emailQuery = emailQuery.eq("is_read", false);

    let fwdQuery = supabase
      .from("email_forwards")
      .select("id, subject, sender, body, code_extracted, link_extracted, received_at, task_id, user_id")
      .order("received_at", { ascending: false })
      .limit(limit);

    if (params.employee_id) fwdQuery = fwdQuery.eq("user_id", params.employee_id);
    if (params.task_id) fwdQuery = fwdQuery.eq("task_id", params.task_id);

    const [emailResult, fwdResult] = await Promise.all([emailQuery, fwdQuery]);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          received_emails: emailResult.data || [],
          email_forwards_with_codes: fwdResult.data || [],
        }, null, 2),
      }],
    };
  },
});

// HTTP transport - bind to server first
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
