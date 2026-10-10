import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CouponEmailRequest {
  to: string;
  firstName: string;
  lastName: string;
  couponCode: string;
  couponImage: string; // base64 data URL
  subject?: string;
  htmlContent?: string;
  senderName?: string;
  senderEmail?: string;
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
      couponCode, 
      couponImage,
      subject,
      htmlContent,
      senderName,
      senderEmail
    }: CouponEmailRequest = await req.json();

    // Convert base64 data URL to binary
    const base64Data = couponImage.split(",")[1];
    
    // Use custom template or fallback to default
    const emailSubject = subject || `Ihr POSTIDENT Coupon - ${couponCode}`;
    const fromEmail = senderEmail 
      ? `${senderName || 'EuroScent GmbH'} <${senderEmail}>`
      : "EuroScent GmbH <office@euroscent.de>";

    // Default HTML template if no custom content provided
    const defaultHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">POSTIDENT Coupon</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333333; margin-bottom: 20px;">
                Sehr geehrte(r) ${firstName} ${lastName},
              </p>
              <p style="font-size: 16px; color: #333333; margin-bottom: 20px;">
                im Anhang finden Sie Ihren persönlichen POSTIDENT Coupon für die Identitätsprüfung.
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Ihr Coupon-Code:</p>
                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1a1a2e; font-family: monospace;">${couponCode}</p>
              </div>
              <h3 style="color: #1a1a2e; margin-top: 30px;">So funktioniert's:</h3>
              <ol style="color: #333333; line-height: 1.8;">
                <li>Drucken Sie den angehängten Coupon aus oder zeigen Sie ihn auf Ihrem Smartphone</li>
                <li>Besuchen Sie eine Postfiliale in Ihrer Nähe</li>
                <li>Zeigen Sie den Coupon und Ihren gültigen Personalausweis oder Reisepass vor</li>
                <li>Die Identifikation wird durchgeführt und an uns übermittelt</li>
              </ol>
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Wichtig:</strong> Bitte führen Sie die Identifikation innerhalb von 14 Tagen durch.
                </p>
              </div>
              <p style="font-size: 16px; color: #333333; margin-top: 30px;">
                Bei Fragen stehen wir Ihnen gerne zur Verfügung.
              </p>
              <p style="font-size: 16px; color: #333333; margin-top: 20px;">
                Mit freundlichen Grüßen,<br>
                <strong>Ihr EuroScent Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
              <p style="color: #888888; font-size: 12px; margin: 0;">
                EuroScent GmbH | Königsallee 89 | 40212 Düsseldorf<br>
                E-Mail: office@euroscent.de | Tel: +49 30 12345678
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Wrap custom HTML content in a proper email template if provided
    const emailHtml = htmlContent 
      ? `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
              <td style="padding: 40px;">
                ${htmlContent}
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Ihr Coupon-Code:</p>
                  <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1a1a2e; font-family: monospace;">${couponCode}</p>
                </div>
                <p style="font-size: 14px; color: #666666; margin-top: 20px;">
                  <em>Der POSTIDENT Coupon wurde als Anhang beigefügt.</em>
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
      : defaultHtml;

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: emailSubject,
      html: emailHtml,
      attachments: [
        {
          filename: `postident-coupon-${couponCode}.png`,
          content: base64Data,
        },
      ],
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    console.log("Coupon email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-coupon-email:", error);
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
