import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForwardSmsRequest {
  phone: string;
  identCode: string;
  submissionId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, identCode, submissionId }: ForwardSmsRequest = await req.json();
    console.log("Forward SMS request:", { phone, identCode, submissionId });

    if (!phone || !identCode || !submissionId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anosimApiKey = Deno.env.get("ANOSIM_API_KEY");
    if (!anosimApiKey) {
      console.error("ANOSIM_API_KEY not configured");
      return new Response(JSON.stringify({ error: "API configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward SMS code via anosim.net API
    console.log("Forwarding SMS to anosim.net API...");
    const anosimResponse = await fetch("https://api.anosim.net/v1/forward-code", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anosimApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: phone,
        code: identCode,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!anosimResponse.ok) {
      const errorText = await anosimResponse.text();
      console.error("anosim.net API error:", anosimResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to forward SMS code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anosimData = await anosimResponse.json();
    console.log("SMS forwarded successfully:", anosimData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get submission data first to log SMS forward
    const { data: submission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("id", submissionId)
      .single();

    const { error: updateError } = await supabase
      .from("task_submissions")
      .update({
        admin_data: {
          ...(submission?.admin_data || {}),
          sms_forwarded: true,
          sms_forwarded_at: new Date().toISOString(),
          anosim_response: anosimData,
        },
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Failed to update submission:", updateError);
    }

    // Log SMS forward for admin monitoring
    const { error: logError } = await supabase
      .from('sms_forwards')
      .insert({
        submission_id: submissionId,
        phone_number: phone,
        verification_code: identCode,
        anosim_response: anosimData,
        status: 'forwarded'
      });

    if (logError) {
      console.error('Error logging SMS forward:', logError);
      // Don't throw, as the forward was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS code forwarded successfully",
        anosimData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in forward-sms-code function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
