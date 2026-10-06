import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  firstName: string;
  lastName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email }: ConfirmationEmailRequest = await req.json();

    console.log("Sending application confirmation email to:", email);

    const appUrl = "https://epp-dashboard.net";
    const homeLink = `${appUrl}/`;
    const impressumLink = `${appUrl}/impressum`;
    const privacyLink = `${appUrl}/privacy`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EPP <info@epp-support.de>",
        to: [email],
        reply_to: "info@epp-support.de",
        subject: "Bewerbungseingang bestätigt - EPP",
        text: `Hallo ${firstName},\n\nwir haben Ihre Bewerbung bei EPP erfolgreich erhalten und freuen uns über Ihr Interesse.\n\nUnser HR-Team prüft Ihre Unterlagen und meldet sich in Kürze bei Ihnen.\n\nMit freundlichen Grüßen\nDas EPP HR-Team\n\nepp GmbH, Kürschnershof 2, D-90403 Nürnberg\nGeschäftsführer: Daniel Krauss | Amtsgericht Nürnberg, HRB 38566 | USt-IdNr. DE321760022\nE-Mail: info@epp-support.de`,
        html: `
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bewerbungseingang - EPP</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #05070f;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #05070f; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #0b1220; border: 1px solid #1e293b; border-radius: 16px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); overflow: hidden;">
                    
                    <!-- Header with Logo -->
                    <tr>
                      <td style="background-color: #05070f; border-bottom: 1px solid #1e293b; padding: 40px 40px 30px 40px; text-align: center;">
                        <div style="margin-bottom: 24px;">
                          <img src="https://qljjcyjdpqwfeesmfdvl.supabase.co/storage/v1/object/public/branding/epp-logo.png" alt="EPP" width="56" height="56" style="display: block; margin: 0 auto 14px auto; width: 56px; height: 56px;" />
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #ffffff; line-height: 1;">EPP</div>
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: #60a5fa; margin-top: 6px; text-transform: uppercase;">Engineering &middot; Partnership &middot; Possibilities</div>
                        </div>
                        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">
                          Vielen Dank für Ihre Bewerbung!
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <div style="margin-bottom: 30px;">
                          <div style="background-color: #0f1f3d; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin-bottom: 30px;">
                            <p style="margin: 0; color: #60a5fa; font-weight: 600; font-size: 16px;">
                              ✓ Ihre Bewerbung ist bei uns eingegangen
                            </p>
                          </div>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Hallo ${firstName},
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            wir haben Ihre Bewerbung bei <strong>EPP</strong> erfolgreich erhalten und freuen uns über Ihr Interesse!
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Unser HR-Team wird Ihre Unterlagen sorgfältig prüfen und sich in Kürze bei Ihnen melden.
                          </p>

                          <div style="background-color: #0f172a; border-radius: 8px; padding: 20px; margin: 30px 0;">
                            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                              <strong style="color: #cbd5e1;">Was passiert als Nächstes?</strong>
                            </p>
                            <ul style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 10px 0 0 0; padding-left: 20px;">
                              <li>Prüfung Ihrer Bewerbungsunterlagen durch unser Team</li>
                              <li>Bei positivem Feedback erhalten Sie eine Einladung per E-Mail</li>
                              <li>Sie können sich dann in unserem System registrieren</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #1e293b;">
                          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                            Falls Sie Fragen haben, kontaktieren Sie uns gerne.
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                            Mit freundlichen Grüßen,<br>
                            <strong style="color: #60a5fa;">Das EPP HR-Team</strong>
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; border-top: 1px solid #1e293b;">
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
                          <a href="${impressumLink}" style="color: #94a3b8; font-size: 12px; text-decoration: none; margin: 0 10px;">Impressum</a>
                          <span style="color: #334155;">|</span>
                          <a href="${privacyLink}" style="color: #94a3b8; font-size: 12px; text-decoration: none; margin: 0 10px;">Datenschutz</a>
                        </p>
                        <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0;">
                          Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await emailResponse.json();
    console.log("Confirmation email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-application-confirmation function:", error);
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
