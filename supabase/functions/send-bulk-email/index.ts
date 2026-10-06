import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  senderName: string;
  senderEmail: string;
  subject: string;
  htmlContent: string;
  recipients: Array<{
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    [key: string]: string | undefined;
  }>;
}

function replacePlaceholders(template: string, data: Record<string, string | undefined>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    // Match both {{key}} and {key} — case-insensitive
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'gi'), value || '');
    result = result.replace(new RegExp(`\\{${escaped}\\}`, 'gi'), value || '');
  }
  // Also support German aliases (case-insensitive)
  const fullName = data.name || `${data.first_name || data.firstName || ''} ${data.last_name || data.lastName || ''}`.trim();
  result = result.replace(/\{\{?vorname\}?\}/gi, data.first_name || data.firstName || '');
  result = result.replace(/\{\{?nachname\}?\}/gi, data.last_name || data.lastName || '');
  result = result.replace(/\{\{?Name\}?\}/gi, fullName);
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { senderName, senderEmail, subject, htmlContent, recipients }: EmailRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Keine Empfänger angegeben" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const recipient of recipients) {
      try {
        // Build placeholder data
        const placeholderData: Record<string, string | undefined> = {
          ...recipient,
          name: recipient.name || `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim(),
          first_name: recipient.firstName,
          last_name: recipient.lastName,
        };

        // Replace placeholders in subject and content
        const personalizedSubject = replacePlaceholders(subject, placeholderData);
        const personalizedContent = replacePlaceholders(htmlContent, placeholderData);

        const emailResponse = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: [recipient.email],
          subject: personalizedSubject,
          html: personalizedContent,
        });

        if (emailResponse.error) {
          results.push({
            email: recipient.email,
            status: "failed",
            error: emailResponse.error.message,
          });
        } else {
          results.push({
            email: recipient.email,
            status: "sent",
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        results.push({
          email: recipient.email,
          status: "failed",
          error: error.message,
        });
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
