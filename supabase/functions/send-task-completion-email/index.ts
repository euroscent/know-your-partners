import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CompletionEmailRequest {
  to: string;
  firstName: string;
  lastName: string;
  taskTitle: string;
  subject: string;
  content: string;
  isHtmlTemplate?: boolean;
  submissionId?: string;
  taskId?: string;
  senderEmail?: string;
  senderName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      firstName, 
      lastName, 
      taskTitle, 
      subject, 
      content,
      isHtmlTemplate = false,
      submissionId,
      taskId,
      senderEmail = "info@epp-support.de",
      senderName = "EPP",
      primaryColor = "#22c55e",
      secondaryColor = "#ffffff",
      accentColor = "#16a34a",
      logoUrl
    }: CompletionEmailRequest = await req.json();
    
    console.log("Storing task email (no actual send) to:", to, "from:", senderEmail, "submissionId:", submissionId, "taskId:", taskId);
    
    let emailHtml: string;
    
    if (isHtmlTemplate) {
      // Use custom HTML template directly - content is already complete HTML
      emailHtml = content;
      console.log("Using custom HTML template");
    } else {
      // Use default EPP template
      const hexToLuminance = (hex: string): number => {
        const rgb = hex.replace('#', '').match(/.{2}/g);
        if (!rgb || rgb.length < 3) return 0.5;
        const [r, g, b] = rgb.map(c => {
          const val = parseInt(c, 16) / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      
      const isLightPrimary = hexToLuminance(primaryColor) > 0.5;
      const headerTextColor = isLightPrimary ? '#1a1a1a' : '#ffffff';

      const appUrl = "https://epp-dashboard.net";
      const impressumLink = `${appUrl}/impressum`;
      const privacyLink = `${appUrl}/privacy`;
      
      const logoSection = logoUrl && !logoUrl.startsWith('data:') 
        ? `<img src="${logoUrl}" alt="${taskTitle}" style="max-width: 180px; max-height: 60px; height: auto; display: block;" />`
        : `<span style="font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #60a5fa; display: inline-block;">EPP</span><span style="font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 1px; color: #64748b; display: inline-block; margin-left: 8px;">ENGINEERING &middot; PARTNERSHIP &middot; POSSIBILITIES</span>`;

      emailHtml = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #05070f;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #05070f; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #0b1220; border: 1px solid #1e293b; border-radius: 16px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); overflow: hidden;">
                  
                  <!-- Header with Company Branding -->
                  <tr>
                    <td style="background-color: #05070f; border-bottom: 1px solid #1e293b; padding: 40px 40px 30px 40px; text-align: center;">
                      <div style="margin-bottom: 24px;">
                          <img src="https://qljjcyjdpqwfeesmfdvl.supabase.co/storage/v1/object/public/branding/epp-logo.png" alt="EPP" width="56" height="56" style="display: block; margin: 0 auto 14px auto; width: 56px; height: 56px;" />
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #ffffff; line-height: 1;">EPP</div>
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: #60a5fa; margin-top: 6px; text-transform: uppercase;">Engineering &middot; Partnership &middot; Possibilities</div>
                        </div>
                      <h1 style="color: ${headerTextColor}; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">
                        🎉 Auftrag erfolgreich abgeschlossen!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <div style="margin-bottom: 30px;">
                        <div style="background-color: ${secondaryColor}; border-left: 4px solid ${primaryColor}; padding: 16px; border-radius: 6px; margin-bottom: 30px;">
                          <p style="margin: 0; color: ${primaryColor}; font-weight: 600; font-size: 16px;">
                            ✓ Auftrag: ${taskTitle}
                          </p>
                        </div>
                        
                        <div style="color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                          ${content}
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer with accent color -->
                  <tr>
                    <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; border-top: 3px solid ${primaryColor};">
                      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0 0 15px 0;">
                        &copy; ${new Date().getFullYear()} epp GmbH. Alle Rechte vorbehalten.
                        </p>
                        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0 0 15px 0;">
                          <strong style="color: #cbd5e1;">epp GmbH</strong><br>
                          K&uuml;rschnershof 2, D-90403 N&uuml;rnberg, Deutschland<br>
                          Gesch&auml;ftsf&uuml;hrer: Daniel Krauss<br>
                          Amtsgericht N&uuml;rnberg, HRB 38566 &middot; USt-IdNr. DE321760022<br>
                          E-Mail: <a href="mailto:info@epp-support.de" style="color: #60a5fa; text-decoration: none;">info@epp-support.de</a>
                      </p>
                      <p style="margin: 0 0 10px 0;">
                        <a href="${impressumLink}" style="color: ${primaryColor}; font-size: 12px; text-decoration: none; margin: 0 10px;">Impressum</a>
                        <span style="color: #334155;">|</span>
                        <a href="${privacyLink}" style="color: ${primaryColor}; font-size: 12px; text-decoration: none; margin: 0 10px;">Datenschutz</a>
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      console.log("Using default EPP template");
    }

    // Store email in received_emails so it appears in Email Zentrale AND employee inbox
    // NO actual email is sent via Resend - this is an internal messaging system
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Include submission_id and task_id so the email is linked to the employee
    const { error: insertError } = await supabase
      .from("received_emails")
      .insert({
        to_address: to,
        from_address: senderEmail,
        subject: subject,
        body_html: emailHtml,
        body_text: isHtmlTemplate 
          ? content.replace(/<[^>]*>/g, '').substring(0, 1000) 
          : `Auftrag: ${taskTitle}\n\n${content.replace(/<[^>]*>/g, '')}`,
        received_at: new Date().toISOString(),
        is_read: false,
        submission_id: submissionId || null,
        task_id: taskId || null,
        headers: { internal_task_email: true },
      });
    
    if (insertError) {
      console.error("Error storing email:", insertError);
      throw new Error(`Failed to store email: ${insertError.message}`);
    }
    
    console.log("Email stored in received_emails with submission_id:", submissionId, "task_id:", taskId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email stored successfully (internal messaging)",
      id: crypto.randomUUID()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-task-completion-email function:", error);
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