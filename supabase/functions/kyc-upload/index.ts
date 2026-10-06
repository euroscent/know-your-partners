// Deno Edge Function: kyc-upload (Presigned Upload Version)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  console.log("Request received:", req.method, req.url);

  try {
    if (req.method === "OPTIONS") {
      console.log("Handling OPTIONS request");
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      console.log("Invalid method:", req.method);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing POST request");

    console.log("All headers:");
    req.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value.substring(0, 50)}...`);
    });

    const authHeader = req.headers.get("authorization");
    console.log("Auth header present:", !!authHeader);
    console.log("Auth header value:", authHeader?.substring(0, 50));

    if (!authHeader) {
      console.log("Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    console.log("Token length:", token.length);
    console.log("Validating token with Supabase...");

    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error("Auth error:", authError.message, authError.status);
      return new Response(JSON.stringify({ error: `Auth failed: ${authError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userData?.user) {
      console.log("Invalid user data");
      return new Response(JSON.stringify({ error: "Invalid user data" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log("User validated successfully:", userId);

    const body = await req.json();
    console.log("Request body:", body);
    const { fileName, fileType, docType } = body;

    if (!fileName || !fileType || !docType) {
      console.log("Missing required fields:", { fileName, fileType, docType });
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = fileName.split(".").pop() || "bin";
    const filePath = `${userId}/${docType}-${Date.now()}.${ext}`;
    console.log("Creating presigned URL for:", filePath);

    const { data, error } = await supabase.storage.from("kyc-uploads").createSignedUploadUrl(filePath);

    if (error) {
      console.error("Presign error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Presigned URL created successfully");

    return new Response(
      JSON.stringify({
        uploadUrl: data.signedUrl,
        path: filePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
