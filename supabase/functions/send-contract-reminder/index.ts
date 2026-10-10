import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderEmailRequest {
  firstName: string;
  lastName: string;
  email: string;
  employmentType: string | null;
  startDate?: string | null;
}

const employmentTypeLabels: Record<string, string> = {
  minijob: "Minijob (603€ Basis)",
  teilzeit: "Teilzeit",
  vollzeit: "Vollzeit",
  freelancer: "Freelancer",
};

const getRegistrationLink = (employmentType: string | null, startDate?: string | null, email?: string): string => {
  const baseUrl = "https://epp-dashboard.net";
  
  if (!employmentType) {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    const queryString = params.toString();
    return queryString ? `${baseUrl}/register?${queryString}` : `${baseUrl}/register`;
  }
  
  const routes: Record<string, string> = {
    minijob: "/register/minijob",
    teilzeit: "/register/teilzeit",
    vollzeit: "/register/vollzeit",
    freelancer: "/register/freelancer",
  };
  const basePath = `${baseUrl}${routes[employmentType] || "/register"}`;
  
  const params = new URLSearchParams();
  if (startDate) {
    params.set("startDate", startDate);
    params.set("invited", "true");
  }
  if (email) params.set("email", email);
  
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

const formatDateGerman = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email, employmentType, startDate }: ReminderEmailRequest = await req.json();

    console.log("Sending contract reminder email to:", email);

    const isFreieWahl = !employmentType;
    const employmentLabel = isFreieWahl ? "Know Your Customer Assistant (m/w/d)" : (employmentTypeLabels[employmentType] || employmentType);
    const formattedStartDate = startDate ? formatDateGerman(startDate) : null;
    const signupLink = getRegistrationLink(employmentType, startDate, email);
    const impressumLink = "https://epp-dashboard.net/impressum";
    const privacyLink = "https://epp-dashboard.net/privacy";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EuroScent <office@euroscent.de>",
        to: [email],
        subject: `Erinnerung: Ihr Arbeitsvertrag wartet auf Ihre Unterschrift, ${firstName}!`,
        html: `
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vertragserinnerung - EuroScent</title>
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
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #ffffff; line-height: 1;">EuroScent</div>
                          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: #60a5fa; margin-top: 6px; text-transform: uppercase;">Engineering &middot; Partnership &middot; Possibilities</div>
                        </div>
                        <h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; line-height: 1.3;">
                          ⏰ Freundliche Erinnerung
                        </h1>
                        <p style="color: rgba(255,255,255,0.95); font-size: 16px; margin: 10px 0 0 0;">
                          Ihr Arbeitsvertrag wartet noch auf Ihre Unterschrift
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <div style="margin-bottom: 30px;">
                          <!-- Reminder Box -->
                          <div style="background-color: #2a1e05; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin-bottom: 25px;">
                            <p style="margin: 0; color: #fcd34d; font-weight: 600; font-size: 16px;">
                              ⚡ Schließen Sie Ihre Registrierung ab!
                            </p>
                            <p style="margin: 8px 0 0 0; color: #a16207; font-size: 14px;">
                              Wir haben festgestellt, dass Ihr Arbeitsvertrag noch nicht unterschrieben wurde.
                            </p>
                          </div>
                          
                          <!-- Employment Info Box -->
                          <div style="background-color: #f3f0ff; border: 1px solid #c4b5fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding-bottom: 12px;">
                                  <span style="font-size: 20px; margin-right: 8px;">📋</span>
                                  <strong style="color: #60a5fa; font-size: 18px;">Ihre Position: ${employmentLabel}</strong>
                                </td>
                              </tr>
                              ${formattedStartDate ? `
                              <tr>
                                <td style="padding-top: 12px; border-top: 1px solid #e0d4fc;">
                                  <span style="font-size: 18px; margin-right: 8px;">📅</span>
                                  <strong style="color: #60a5fa;">Geplantes Startdatum:</strong>
                                  <span style="color: #5b21b6; font-size: 16px; margin-left: 8px;">${formattedStartDate}</span>
                                </td>
                              </tr>
                              ` : ''}
                            </table>
                          </div>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Liebe/r <strong>${firstName} ${lastName}</strong>,
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            wir haben Ihnen bereits eine Bestätigung über Ihre erfolgreiche Bewerbung bei <strong>EuroScent</strong> geschickt. Leider haben wir festgestellt, dass Ihr Arbeitsvertrag noch nicht unterschrieben wurde.
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Um Ihren Einstellungsprozess abzuschließen und pünktlich starten zu können, bitten wir Sie, den Vertrag zeitnah digital zu unterschreiben.
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                            Klicken Sie einfach auf den Button unten, um zur Registrierung zu gelangen:
                          </p>
                        </div>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${signupLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 999px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);">
                                ✍️ Jetzt Vertrag unterschreiben
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #64748b; font-size: 12px; text-align: center; margin: 15px 0 0 0;">
                          Oder kopieren Sie diesen Link: <a href="${signupLink}" style="color: #f59e0b;">${signupLink}</a>
                        </p>
                        
                        <!-- Quick Steps Section -->
                        <div style="margin-top: 35px; padding: 25px; background-color: #fafafa; border-radius: 8px;">
                          <h3 style="color: #cbd5e1; font-size: 16px; margin: 0 0 15px 0;">📌 So geht's weiter:</h3>
                          <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Klicken Sie auf den Button oben</li>
                            <li>Vervollständigen Sie ggf. Ihre persönlichen Daten</li>
                            <li>Unterschreiben Sie Ihren Arbeitsvertrag digital</li>
                            <li>Fertig! Sie sind bereit für Ihren Start bei EuroScent</li>
                          </ol>
                        </div>
                        
                        <!-- Contact Section -->
                        <div style="margin-top: 30px; padding: 20px; background-color: #06231a; border-radius: 8px; border: 1px solid #bbf7d0;">
                          <p style="color: #6ee7b7; font-size: 14px; line-height: 1.6; margin: 0;">
                            <strong>💬 Haben Sie Fragen?</strong><br>
                            Falls Sie technische Probleme haben oder Unterstützung benötigen, antworten Sie einfach auf diese E-Mail oder kontaktieren Sie uns unter <a href="mailto:office@euroscent.de" style="color: #6ee7b7;">office@euroscent.de</a>
                          </p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #1e293b;">
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0;">
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
                          Sie erhalten diese E-Mail, weil Sie sich bei EuroScent beworben haben.
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
    console.log("Reminder email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contract-reminder function:", error);
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
