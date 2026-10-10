import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MeetingRequestEmailRequest {
  firstName: string;
  lastName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email }: MeetingRequestEmailRequest = await req.json();

    console.log("Sending meeting request email to:", email);

    const appUrl = "https://epp-dashboard.net";
    const impressumLink = `${appUrl}/impressum`;
    const privacyLink = `${appUrl}/privacy`;
    
    // Fetch WhatsApp number from company_contact
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const companyResponse = await fetch(`${supabaseUrl}/rest/v1/company_contact?select=main_phone&limit=1`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });
    
    const companyData = await companyResponse.json();
    const phoneNumber = companyData[0]?.main_phone?.replace(/\D/g, '') || '4917613627749';
    const whatsappMessage = encodeURIComponent(
      `Hallo, ich bin ${firstName} ${lastName}.\n\nIch möchte gerne weitere Informationen zum Ablauf, möglichen Starttermin, Vergütung und zum ersten Kennenlerngespräch erhalten.\n\nVielen Dank!`
    );
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${phoneNumber}&text=${whatsappMessage}&type=phone_number&app_absent=0`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EuroScent <office@euroscent.de>",
        to: [email],
        subject: "Kennenlern-Gespräch mit EuroScent",
        html: `
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kennenlern-Gespräch - EuroScent</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #05070f;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #05070f; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #0b1220; border: 1px solid #1e293b; border-radius: 16px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #05070f; border-bottom: 1px solid #1e293b; padding: 40px 40px 30px 40px; text-align: center;">
                        <div style="margin-bottom: 24px;">
                          <img src="https://euroscent.de/euroscent-logo.png" alt="EuroScent" width="56" height="56" style="display: block; margin: 0 auto 14px auto; width: 56px; height: 56px;" />
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #ffffff; line-height: 1;">EuroScent</div>
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: #60a5fa; margin-top: 6px; text-transform: uppercase;">Engineering &middot; Partnership &middot; Possibilities</div>
                        </div>
                        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">
                          Lass uns kennenlernen!
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                          Hallo ${firstName} ${lastName},
                        </p>
                        
                        <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                          vielen Dank für Ihr Interesse an <strong>EuroScent</strong>! Wir würden uns sehr freuen, Sie in einem kurzen Kennenlern-Gespräch näher kennenzulernen.
                        </p>
                        
                        <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin: 30px 0;">
                          <p style="margin: 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                            💡 <strong>Unser Ziel:</strong> In einem unverbindlichen Gespräch möchten wir mehr über Sie erfahren und Ihnen zeigen, wie EuroScent Sie unterstützen kann.
                          </p>
                        </div>
                        
                        <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                          Bitte teilen Sie uns mit, wann Sie Zeit für ein kurzes Gespräch hätten. Klicken Sie einfach auf den Button unten, um uns per WhatsApp zu kontaktieren:
                        </p>
                        
                        <!-- WhatsApp Button mit echtem Logo -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #25D366, #1ebe5d); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.2);">
                                <!--[if !mso]><!-->
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" style="display: inline-block; vertical-align: middle; fill: #ffffff;">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                <!--<![endif]-->
                                WhatsApp kontaktieren
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding: 10px 0 0 0;">
                              <p style="color: #cbd5e1; font-size: 14px; margin: 0;">
                                <strong>+49 176 13627749</strong><br>
                                <span style="color: #94a3b8;">EuroScent ~ Claudia Fink</span>
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #1e293b;">
                          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                            Wir freuen uns darauf, von Ihnen zu hören!
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                            Mit freundlichen Grüßen,<br>
                            <strong style="color: #60a5fa;">Das EuroScent Team</strong>
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; border-top: 1px solid #1e293b;">
                        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0 0 15px 0;">
                          &copy; ${new Date().getFullYear()} EuroScent GmbH. Alle Rechte vorbehalten.
                        </p>
                        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0 0 15px 0;">
                          <strong style="color: #cbd5e1;">EuroScent GmbH</strong><br>
                          K&ouml;nigsallee 89, D-40212 D&uuml;sseldorf, Deutschland<br>
                          Gesch&auml;ftsf&uuml;hrer: Rolf Erwin Ruhfus<br>
                          Amtsgericht D&uuml;sseldorf, HRB 69139 &middot; USt-IdNr. DE152885038<br>
                          E-Mail: <a href="mailto:office@euroscent.de" style="color: #60a5fa; text-decoration: none;">office@euroscent.de</a>
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
    console.log("Meeting request email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-meeting-request-email function:", error);
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
