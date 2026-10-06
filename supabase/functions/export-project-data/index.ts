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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    // Default: no base64 payload (avoids worker memory limits). Instead we hand
    // out long-lived signed URLs the importing project downloads from directly.
    const inlineFiles = url.searchParams.get("inline_files") === "1";

    const tables = [
      { name: "tasks", filter: (q: any) => q.is("assigned_to", null) },
      { name: "task_email_templates" },
      { name: "task_completion_templates" },
      { name: "email_templates" },
      { name: "contract_templates" },
      { name: "virtual_employees" },
      { name: "faq_responses" },
      { name: "email_settings" },
      { name: "company_contact" },
      { name: "business_hours" },
      { name: "company_signature" },
      { name: "agent_settings" },
      { name: "clients" },
      { name: "employee_documents" },
    ];

    const exportData: Record<string, any[]> = {};

    for (const table of tables) {
      let query = supabase.from(table.name).select("*");
      if (table.filter) {
        query = table.filter(query);
      }
      const { data, error } = await query;
      if (error) {
        console.error(`Error reading ${table.name}:`, error.message);
        exportData[table.name] = [];
      } else {
        exportData[table.name] = data || [];
      }
    }

    // Collect all storage file URLs that need to be transferred
    // Supports both public URLs and signed URLs
    const storageFiles: Record<string, string> = {}; // unique key -> download info
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/`;
    const signedPrefix = `${supabaseUrl}/storage/v1/object/sign/`;

    const collectUrl = (url: string | null | undefined) => {
      if (!url || typeof url !== "string") return;
      if (url.startsWith(publicPrefix)) {
        const path = url.split("?")[0].slice(publicPrefix.length);
        storageFiles[path] = url;
      } else if (url.startsWith(signedPrefix)) {
        // Signed URL: extract bucket/path before ?token=
        const pathWithParams = url.slice(signedPrefix.length);
        const path = pathWithParams.split("?")[0];
        storageFiles[path] = url;
      }
    };

    // Scan tasks for storage URLs
    for (const task of exportData.tasks || []) {
      collectUrl(task.logo_url);
      collectUrl(task.image_url);
      if (Array.isArray(task.images)) {
        task.images.forEach((img: string) => collectUrl(img));
      }
    }

    // Scan ALL email template content for storage URLs (public + signed)
    const scanHtmlForUrls = (html: string) => {
      if (!html) return;
      const escapedUrl = supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match both public and signed storage URLs
      const regex = new RegExp(
        escapedUrl + "/storage/v1/object/(?:public|sign)/[^\"'\\s<>]+",
        "g"
      );
      const matches = html.match(regex);
      if (matches) matches.forEach((m) => collectUrl(m));
    };

    for (const tpl of exportData.task_email_templates || []) {
      scanHtmlForUrls(tpl.content);
    }
    for (const tpl of exportData.task_completion_templates || []) {
      scanHtmlForUrls(tpl.content);
    }
    for (const tpl of exportData.email_templates || []) {
      scanHtmlForUrls(tpl.content);
    }

    // Build transfer info for every referenced file.
    // Default mode: signed download URLs (7 days) -> tiny payload, no memory limits.
    // inline_files=1: base64 payload (only for small projects).
    const storageFileData: Record<string, { base64: string; contentType: string }> = {};
    const storageUrls: Record<string, string> = {};

    for (const [path] of Object.entries(storageFiles)) {
      const parts = path.split("/");
      const bucket = parts[0];
      const filePath = parts.slice(1).join("/");

      try {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) {
          storageUrls[path] = signed.signedUrl;
        } else {
          storageUrls[path] = `${supabaseUrl}/storage/v1/object/public/${path}`;
        }
      } catch (err) {
        console.error(`Signed URL failed for ${path}:`, (err as Error).message);
      }

      if (!inlineFiles) continue;

      try {
        const { data, error } = await supabase.storage.from(bucket).download(filePath);
        if (error || !data) {
          console.error(`Failed to download ${path}:`, error?.message);
          continue;
        }

        const contentType = data.type || "application/octet-stream";
        const bytes = new Uint8Array(await data.arrayBuffer());
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
        }

        storageFileData[path] = { base64: btoa(binary), contentType };
      } catch (err) {
        console.error(`Error downloading ${path}:`, (err as Error).message);
      }
    }

    const summary: Record<string, number> = {};
    for (const [key, val] of Object.entries(exportData)) {
      summary[key] = val.length;
    }
    summary["storage_files"] = Object.keys(storageUrls).length;

    return new Response(
      JSON.stringify({
        exported_at: new Date().toISOString(),
        source_url: supabaseUrl,
        summary,
        data: exportData,
        storage_files: storageFileData,
        storage_urls: storageUrls,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
