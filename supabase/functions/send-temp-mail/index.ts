import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  from_address: string;
  to_address: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  reply_to_email_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-temp-mail function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      from_address, 
      to_address, 
      subject, 
      body_text, 
      body_html,
      reply_to_email_id 
    }: SendEmailRequest = await req.json();

    console.log(`Sending email from ${from_address} to ${to_address}`);

    // Validate required fields
    if (!from_address || !to_address || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: from_address, to_address, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that from_address domain is one of our registered domains
    const fromDomain = from_address.split("@")[1];
    const { data: domainData, error: domainError } = await supabase
      .from("email_domains")
      .select("id, domain")
      .eq("domain", fromDomain)
      .eq("is_active", true)
      .single();

    if (domainError || !domainData) {
      console.error("Domain not registered or inactive:", fromDomain);
      return new Response(
        JSON.stringify({ error: `Domain ${fromDomain} is not registered or inactive` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email HTML if only text provided
    const htmlContent = body_html || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body_text || ""}</div>
      </div>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: from_address,
      to: [to_address],
      subject: subject,
      html: htmlContent,
      text: body_text || undefined,
    });

    console.log("Email sent successfully:", emailResponse);

    // If this is a reply, mark original as read
    if (reply_to_email_id) {
      await supabase
        .from("received_emails")
        .update({ is_read: true })
        .eq("id", reply_to_email_id);
    }

    // Log the sent email
    console.log(`Email sent: ${from_address} -> ${to_address}, Subject: ${subject}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        email_id: emailResponse.data?.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-temp-mail:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
