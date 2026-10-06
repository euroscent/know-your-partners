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
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Allow either the service role key or a signed-in admin user
    let authorized = token === serviceRoleKey;
    if (!authorized && token) {
      const { data: userData } = await supabase.auth.getUser(token);
      const userId = userData?.user?.id;
      if (userId) {
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        authorized = isAdmin === true;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const importData = body.data;
    const sourceUrl = body.source_url || "";
    const storageFiles: Record<string, { base64: string; contentType: string }> = body.storage_files || {};
    const storageUrls: Record<string, string> = body.storage_urls || {};

    // Files handed over as download URLs: fetch them and treat them like inline files
    for (const [path, fileUrl] of Object.entries(storageUrls)) {
      if (storageFiles[path]) continue;
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) {
          console.error(`Fetch failed for ${path}: ${res.status}`);
          continue;
        }
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const bytes = new Uint8Array(await res.arrayBuffer());
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
        }
        storageFiles[path] = { base64: btoa(binary), contentType };
      } catch (err) {
        console.error(`Error fetching ${path}:`, (err as Error).message);
      }
    }

    if (!importData) {
      return new Response(JSON.stringify({ error: "No data field in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find system user for FK references
    let systemUserId: string | null = null;
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (adminRoles && adminRoles.length > 0) {
      systemUserId = adminRoles[0].user_id;
    } else {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);
      if (profiles && profiles.length > 0) {
        systemUserId = profiles[0].id;
      }
    }

    // ---- Step 1: Upload storage files and build URL map ----
    const urlMap: Record<string, string> = {}; // old full URL -> new public URL
    let filesUploaded = 0;

    if (Object.keys(storageFiles).length > 0) {
      const newPublicPrefix = `${supabaseUrl}/storage/v1/object/public/`;

      for (const [path, fileData] of Object.entries(storageFiles)) {
        try {
          // Decode base64
          const binaryString = atob(fileData.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const parts = path.split("/");
          const originalBucket = parts[0];
          const filePath = parts.slice(1).join("/");
          // Always upload to task-files (public) for simplicity
          const bucket = "task-files";
          const targetPath = `migrated/${originalBucket}/${filePath}`;

          // Ensure bucket exists (try upload, if bucket doesn't exist it'll fail gracefully)
          const { error } = await supabase.storage
            .from(bucket)
            .upload(targetPath, bytes.buffer, {
              contentType: fileData.contentType,
              upsert: true,
            });

          if (error) {
            console.error(`Upload error for ${path}:`, error.message);
          } else {
            filesUploaded++;
          }

          // New public URL: always task-files bucket
          const newPublicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${targetPath}`;

          // Map ALL possible old URL variants to new public URL
          if (sourceUrl) {
            const oldPublicUrl = `${sourceUrl}/storage/v1/object/public/${path}`;
            urlMap[oldPublicUrl] = newPublicUrl;
            const oldSignedPrefix = `${sourceUrl}/storage/v1/object/sign/${path}`;
            urlMap[oldSignedPrefix] = newPublicUrl;
          }
        } catch (err) {
          console.error(`Error processing storage file ${path}:`, err.message);
        }
      }
    }

    // Helper: rewrite all old storage URLs in text (handles signed URLs with tokens)
    const rewriteUrls = (text: string): string => {
      if (!text || !sourceUrl) return text;

      // First: replace signed URLs (full pattern with ?token=...) 
      // These are longer and more specific, must be replaced first
      if (sourceUrl) {
        const escapedUrl = sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const signedRegex = new RegExp(
          escapedUrl + "/storage/v1/object/sign/([^\"'\\s<>?]+)\\?[^\"'\\s<>]*",
          "g"
        );
        text = text.replace(signedRegex, (_match, filePath) => {
          const fullPath = filePath;
          const oldSignedPrefix = `${sourceUrl}/storage/v1/object/sign/${fullPath}`;
          if (urlMap[oldSignedPrefix]) {
            return urlMap[oldSignedPrefix];
          }
          // Fallback: put in task-files/migrated/
          const parts = fullPath.split("/");
          const bucket = parts[0];
          const rest = parts.slice(1).join("/");
          return `${supabaseUrl}/storage/v1/object/public/task-files/migrated/${bucket}/${rest}`;
        });

        // Then replace public URLs
        const publicRegex = new RegExp(
          escapedUrl + "/storage/v1/object/public/([^\"'\\s<>?]+)(?:\\?[^\"'\\s<>]*)?",
          "g"
        );
        text = text.replace(publicRegex, (_match, filePath) => {
          const parts = filePath.split("/");
          const bucket = parts[0];
          const rest = parts.slice(1).join("/");
          return `${supabaseUrl}/storage/v1/object/public/task-files/migrated/${bucket}/${rest}`;
        });
      }

      return text;
    };

    // Helper: rewrite URLs in task fields
    const rewriteTaskUrls = (task: any) => {
      if (task.logo_url) task.logo_url = rewriteUrls(task.logo_url);
      if (task.image_url) task.image_url = rewriteUrls(task.image_url);
      if (Array.isArray(task.images)) {
        task.images = task.images.map((img: string) =>
          typeof img === "string" ? rewriteUrls(img) : img
        );
      }
      return task;
    };

    // ---- Step 2: Import data ----
    const importOrder = [
      "clients",
      "virtual_employees",
      "email_settings",
      "company_contact",
      "company_signature",
      "business_hours",
      "faq_responses",
      "contract_templates",
      "email_templates",
      "agent_settings",
      "tasks",
      "task_email_templates",
      "task_completion_templates",
      "employee_documents",
    ];

    const results: Record<string, { inserted: number; skipped: number; error?: string }> = {};

    for (const tableName of importOrder) {
      const rows = importData[tableName];
      if (!rows || rows.length === 0) {
        results[tableName] = { inserted: 0, skipped: 0 };
        continue;
      }

      let processedRows = rows;

      if (tableName === "tasks") {
        processedRows = rows.map((row: any) => {
          const cleaned = { ...row };
          if (systemUserId) {
            cleaned.created_by = systemUserId;
          }
          cleaned.email_account_id = null;
          return rewriteTaskUrls(cleaned);
        });
      }

      if (tableName === "employee_documents") {
        if (!systemUserId) {
          results[tableName] = { inserted: 0, skipped: rows.length, error: "No user found" };
          continue;
        }
        processedRows = rows.map((row: any) => ({
          ...row,
          user_id: systemUserId,
        }));
      }

      if (tableName === "email_templates" || tableName === "task_completion_templates" || tableName === "task_email_templates") {
        processedRows = rows.map((row: any) => ({
          ...row,
          created_by: systemUserId || row.created_by,
          content: rewriteUrls(row.content),
        }));
      }

      const { error } = await supabase
        .from(tableName)
        .upsert(processedRows, { onConflict: "id", ignoreDuplicates: true });

      if (error) {
        console.error(`Error importing ${tableName}:`, error.message);
        results[tableName] = { inserted: 0, skipped: rows.length, error: error.message };
      } else {
        results[tableName] = { inserted: rows.length, skipped: 0 };
      }
    }

    results["storage_files"] = { inserted: filesUploaded, skipped: Object.keys(storageFiles).length - filesUploaded };

    return new Response(
      JSON.stringify({ imported_at: new Date().toISOString(), results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
