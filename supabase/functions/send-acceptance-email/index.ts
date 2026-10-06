import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptanceEmailRequest {
  firstName: string;
  lastName: string;
  email: string;
  employmentType: string | null;
  startDate?: string | null;
  lockFields?: boolean;
}

const employmentTypeLabels: Record<string, string> = {
  minijob: "Minijob (603€ Basis)",
  teilzeit: "Teilzeit",
  vollzeit: "Vollzeit",
  freelancer: "Freelancer",
};

const employmentTypeDescriptions: Record<string, string> = {
  minijob: "Als Minijobber können Sie flexibel bis zu 603€ monatlich verdienen.",
  teilzeit: "Als Teilzeit-Mitarbeiter arbeiten Sie mit reduzierten Stunden in unserem Team.",
  vollzeit: "Als Vollzeit-Mitarbeiter sind Sie ein fester Bestandteil unseres Teams.",
  freelancer: "Als Freelancer arbeiten Sie projektbasiert und flexibel mit uns zusammen.",
};

const getRegistrationLink = (employmentType: string | null, startDate?: string | null, email?: string, lockFields: boolean = true): string => {
  const baseUrl = "https://epp-dashboard.net";
  
  // Bei "Freie Wahl" (employmentType = null) -> Registrierungsseite (nicht Karriere!)
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
  
  // Add query parameters for pre-filled data
  const params = new URLSearchParams();
  if (startDate && lockFields) {
    params.set("startDate", startDate);
    params.set("invited", "true"); // Flag to indicate this is an invited registration with locked fields
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email, employmentType, startDate, lockFields = true }: AcceptanceEmailRequest = await req.json();

    console.log("Sending acceptance email to:", email, "for employment type:", employmentType, "start date:", startDate, "lockFields:", lockFields);

    // Bei "Freie Wahl" ist employmentType null
    const isFreieWahl = !employmentType;
    const employmentLabel = isFreieWahl ? "Mitarbeiter" : (employmentTypeLabels[employmentType] || employmentType);
    const employmentDescription = isFreieWahl 
      ? "Sie können bei der Registrierung Ihre gewünschte Anstellungsart und Ihr Startdatum selbst wählen."
      : (employmentTypeDescriptions[employmentType] || "");
    const formattedStartDate = startDate ? formatDateGerman(startDate) : "";
    const hasLockedStartDate = lockFields && startDate && !isFreieWahl;
    
    // Generate links based on employment type with pre-filled data
    const signupLink = getRegistrationLink(employmentType, startDate, email, lockFields);
    const impressumLink = "https://epp-dashboard.net/impressum";
    const privacyLink = "https://epp-dashboard.net/privacy";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EPP <info@epp-support.de>",
        to: [email],
        subject: isFreieWahl 
          ? `Herzlichen Glückwunsch, ${firstName}! Ihre Bewerbung wurde akzeptiert`
          : `Herzlichen Glückwunsch! Sie wurden als ${employmentLabel} eingestellt`,
        html: `
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bewerbung akzeptiert - EPP</title>
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
                          🎉 Glückwunsch, ${firstName}!
                        </h1>
                        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">
                          ${isFreieWahl 
                            ? "Ihre Bewerbung wurde akzeptiert" 
                            : `Sie wurden als <strong>${employmentLabel}</strong> eingestellt`
                          }
                        </p>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <div style="margin-bottom: 30px;">
                          <div style="background-color: #06231a; border-left: 4px solid #22c55e; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="margin: 0; color: #6ee7b7; font-weight: 600; font-size: 16px;">
                              ✓ Ihre Bewerbung wurde erfolgreich akzeptiert
                            </p>
                          </div>
                          
                          <!-- Employment Type Info Box -->
                          <div style="background-color: #f3f0ff; border: 1px solid #c4b5fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding-bottom: 12px;">
                                  <span style="font-size: 20px; margin-right: 8px;">📋</span>
                                  <strong style="color: #60a5fa; font-size: 18px;">${employmentLabel}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 12px;">
                                  <p style="color: #5b21b6; font-size: 14px; margin: 0; line-height: 1.5;">
                                    ${employmentDescription}
                                  </p>
                                </td>
                              </tr>
                              ${hasLockedStartDate ? `
                              <tr>
                                <td style="padding-top: 12px; border-top: 1px solid #e0d4fc;">
                                  <span style="font-size: 18px; margin-right: 8px;">📅</span>
                                  <strong style="color: #60a5fa;">Startdatum:</strong>
                                  <span style="color: #5b21b6; font-size: 16px; margin-left: 8px;">${formattedStartDate}</span>
                                  <span style="color: #64748b; font-size: 12px; margin-left: 4px;">(festgelegt)</span>
                                </td>
                              </tr>
                              ` : ''}
                            </table>
                          </div>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Liebe/r <strong>${firstName} ${lastName}</strong>,
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Wir freuen uns sehr, Ihnen mitteilen zu können, dass Ihre Bewerbung bei <strong>EPP</strong> erfolgreich war!
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                            Um Ihren Einstellungsprozess abzuschließen, klicken Sie bitte auf den untenstehenden Button. Sie werden zu Ihrem persönlichen Registrierungsformular weitergeleitet, wo Sie alle erforderlichen Informationen eingeben können.
                          </p>
                        </div>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${signupLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 999px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);">
                                📝 Jetzt registrieren
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #64748b; font-size: 12px; text-align: center; margin: 15px 0 0 0;">
                          Oder kopieren Sie diesen Link: <a href="${signupLink}" style="color: #60a5fa;">${signupLink}</a>
                        </p>
                        
                        <!-- What's Next Section -->
                        <div style="margin-top: 35px; padding: 25px; background-color: #fafafa; border-radius: 8px;">
                          <h3 style="color: #cbd5e1; font-size: 16px; margin: 0 0 15px 0;">📌 Nächste Schritte:</h3>
                          <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>Klicken Sie auf den Registrierungsbutton oben</li>
                            <li>Füllen Sie das Registrierungsformular vollständig aus</li>
                            <li>Unterschreiben Sie Ihren Arbeitsvertrag digital</li>
                          </ol>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #1e293b;">
                          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                            Falls Sie Fragen haben oder Unterstützung benötigen, zögern Sie nicht, uns jederzeit zu kontaktieren.
                          </p>
                          
                          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                            Mit freundlichen Grüßen,<br>
                            <strong style="color: #60a5fa;">Das EPP Team</strong>
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
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-acceptance-email function:", error);
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
