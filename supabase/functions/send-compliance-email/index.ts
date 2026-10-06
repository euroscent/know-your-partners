import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendComplianceEmailRequest {
  userId: string;
  submissionId?: string;
}

const COMPLIANCE_EMAIL_SUBJECT = "Bevollmächtigung und Verpflichtungserklärung - epp GmbH";

function generateComplianceEmailHtml(firstName: string, lastName: string, startDate: string): string {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Mitarbeiter/in';
  
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Sehr geehrte/r Frau/Herr ${fullName},</p>

<p>mit Wirkung zum ${startDate} nehmen Sie Ihre Tätigkeit als Mitarbeiter/in im Bereich Know Your Customer (KYC) bei der epp GmbH auf.</p>

<p>Im Zusammenhang mit Ihrer Funktion wird Ihnen ein rechtsverbindliches Zertifikat sowie eine funktionale Bevollmächtigung erteilt. Diese Bevollmächtigung berechtigt Sie, alle für die Ausübung Ihrer Tätigkeit erforderlichen Handlungen vollumfänglich, ordnungsgemäß und innerhalb Ihres Zuständigkeitsbereichs vorzunehmen, sofern diese im Einklang mit den jeweils anwendbaren nationalen, supranationalen und internationalen gesetzlichen und regulatorischen Vorschriften stehen.</p>

<p>Sie verpflichten sich zur uneingeschränkten Einhaltung sämtlicher aufsichtsrechtlicher, regulatorischer und vertraglicher Vorgaben, insbesondere – jedoch nicht abschließend – solcher aus dem Bereich:</p>

<ul>
<li>Know Your Customer (KYC),</li>
<li>Anti-Money Laundering (AML) und Counter Terrorist Financing (CTF),</li>
<li>internationaler Sanktions- und Embargoregelungen,</li>
<li>Datenschutz- und Datensicherheitsvorschriften (einschließlich, soweit anwendbar, DSGVO und vergleichbarer internationaler Regelwerke),</li>
<li>sowie interner Compliance-, Risiko- und Kontrollsysteme.</li>
</ul>

<p>Die Ausübung Ihrer Befugnisse erfolgt ausschließlich zweckgebunden im Rahmen Ihrer arbeitsvertraglichen Pflichten sowie der Ihnen erteilten Weisungen. Die Befugnisse gelten als rechtswirksam und verbindlich, solange sie nicht ausdrücklich widerrufen oder eingeschränkt werden.</p>

<p>Sie sind verpflichtet, sämtliche Anweisungen, Richtlinien und Vorgaben, die im Zusammenhang mit der epp GmbH, deren verbundenen Unternehmen, Geschäftspartnern sowie internationalen Finanzinstitutionen, Börsen und Aufsichtsbehörden stehen, gewissenhaft, rechtstreu und nachvollziehbar umzusetzen.</p>

<p>Ein Verstoß gegen die vorstehenden Verpflichtungen kann arbeitsrechtliche, zivilrechtliche, aufsichtsrechtliche sowie strafrechtliche Konsequenzen nach sich ziehen und gegebenenfalls zu einer persönlichen Haftung im gesetzlich zulässigen Umfang führen.</p>

<p>Darüber hinaus verpflichten Sie sich zur zeitlich unbegrenzten Vertraulichkeit aller Ihnen im Rahmen Ihrer Tätigkeit bekannt werdenden geschäftlichen, technischen, finanziellen und personenbezogenen Informationen, auch über das Ende des Arbeitsverhältnisses hinaus.</p>

<p>Bitte bestätigen Sie den Erhalt dieser E-Mail sowie Ihr rechtsverbindliches Einverständnis mit den vorstehenden Regelungen schriftlich.</p>

<p>Mit freundlichen Grüßen</p>

<p><strong>Daniel Krauss</strong><br>
Geschäftsführer<br>
epp GmbH</p>
</div>`;
}

function generateComplianceEmailText(firstName: string, lastName: string, startDate: string): string {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Mitarbeiter/in';
  
  return `Sehr geehrte/r Frau/Herr ${fullName},

mit Wirkung zum ${startDate} nehmen Sie Ihre Tätigkeit als Mitarbeiter/in im Bereich Know Your Customer (KYC) bei der epp GmbH auf.

Im Zusammenhang mit Ihrer Funktion wird Ihnen ein rechtsverbindliches Zertifikat sowie eine funktionale Bevollmächtigung erteilt. Diese Bevollmächtigung berechtigt Sie, alle für die Ausübung Ihrer Tätigkeit erforderlichen Handlungen vollumfänglich, ordnungsgemäß und innerhalb Ihres Zuständigkeitsbereichs vorzunehmen, sofern diese im Einklang mit den jeweils anwendbaren nationalen, supranationalen und internationalen gesetzlichen und regulatorischen Vorschriften stehen.

Sie verpflichten sich zur uneingeschränkten Einhaltung sämtlicher aufsichtsrechtlicher, regulatorischer und vertraglicher Vorgaben, insbesondere – jedoch nicht abschließend – solcher aus dem Bereich:

- Know Your Customer (KYC),
- Anti-Money Laundering (AML) und Counter Terrorist Financing (CTF),
- internationaler Sanktions- und Embargoregelungen,
- Datenschutz- und Datensicherheitsvorschriften (einschließlich, soweit anwendbar, DSGVO und vergleichbarer internationaler Regelwerke),
- sowie interner Compliance-, Risiko- und Kontrollsysteme.

Die Ausübung Ihrer Befugnisse erfolgt ausschließlich zweckgebunden im Rahmen Ihrer arbeitsvertraglichen Pflichten sowie der Ihnen erteilten Weisungen. Die Befugnisse gelten als rechtswirksam und verbindlich, solange sie nicht ausdrücklich widerrufen oder eingeschränkt werden.

Sie sind verpflichtet, sämtliche Anweisungen, Richtlinien und Vorgaben, die im Zusammenhang mit der epp GmbH, deren verbundenen Unternehmen, Geschäftspartnern sowie internationalen Finanzinstitutionen, Börsen und Aufsichtsbehörden stehen, gewissenhaft, rechtstreu und nachvollziehbar umzusetzen.

Ein Verstoß gegen die vorstehenden Verpflichtungen kann arbeitsrechtliche, zivilrechtliche, aufsichtsrechtliche sowie strafrechtliche Konsequenzen nach sich ziehen und gegebenenfalls zu einer persönlichen Haftung im gesetzlich zulässigen Umfang führen.

Darüber hinaus verpflichten Sie sich zur zeitlich unbegrenzten Vertraulichkeit aller Ihnen im Rahmen Ihrer Tätigkeit bekannt werdenden geschäftlichen, technischen, finanziellen und personenbezogenen Informationen, auch über das Ende des Arbeitsverhältnisses hinaus.

Bitte bestätigen Sie den Erhalt dieser E-Mail sowie Ihr rechtsverbindliches Einverständnis mit den vorstehenden Regelungen schriftlich.

Mit freundlichen Grüßen

Daniel Krauss
Geschäftsführer
epp GmbH`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { userId, submissionId }: SendComplianceEmailRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending compliance email for user:", userId);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email, start_date")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if compliance email already exists for this user (by to_address + subject)
    const { data: existingEmails } = await supabaseAdmin
      .from("received_emails")
      .select("id")
      .eq("to_address", profile.email)
      .eq("subject", COMPLIANCE_EMAIL_SUBJECT)
      .limit(1);

    if (existingEmails && existingEmails.length > 0) {
      console.log("Compliance email already exists for user:", profile.email);
      return new Response(
        JSON.stringify({ success: true, message: "Compliance email already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toAddress = profile.email;
    const startDate = profile.start_date || new Date().toISOString().split('T')[0];

    // Insert compliance email - submission_id is optional
    const { error: insertError } = await supabaseAdmin
      .from("received_emails")
      .insert({
        to_address: toAddress,
        from_address: "Daniel Krauss",
        subject: COMPLIANCE_EMAIL_SUBJECT,
        body_html: generateComplianceEmailHtml(profile.first_name || '', profile.last_name || '', startDate),
        body_text: generateComplianceEmailText(profile.first_name || '', profile.last_name || '', startDate),
        submission_id: submissionId || null,
        received_at: new Date().toISOString(),
        headers: { compliance_email: true, user_id: userId },
      });

    if (insertError) {
      console.error("Error inserting compliance email:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert compliance email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Compliance email sent successfully to:", toAddress);

    // Also create a KYC Compliance Officer certificate in employee_documents
    const certTitle = "KYC Compliance Officer – Zertifikat";
    const { data: existingCert } = await supabaseAdmin
      .from("employee_documents")
      .select("id")
      .eq("user_id", userId)
      .eq("title", certTitle)
      .limit(1);

    if (!existingCert || existingCert.length === 0) {
      const certDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Mitarbeiter/in';
      const formattedStartDate = profile.start_date
        ? new Date(profile.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : certDate;

      // Fetch company signature from DB (same as used in contracts)
      const { data: sigData } = await supabaseAdmin
        .from("company_signature")
        .select("signature_data")
        .limit(1)
        .maybeSingle();
      const sigSrc = sigData?.signature_data || '';
      const signatureImg = sigSrc
        ? `<img src="${sigSrc}" alt="Unterschrift" style="max-height: 80px; object-fit: contain; margin-bottom: -5px; background: transparent;" />`
        : '';

      const certificateContent = `<div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; border: 3px double #b8860b; background: linear-gradient(135deg, #fffef5 0%, #fff8e7 50%, #fffef5 100%); position: relative;">
  <div style="border: 1px solid #d4a843; padding: 35px; position: relative;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="font-size: 12px; letter-spacing: 4px; color: #8b7332; text-transform: uppercase; margin-bottom: 8px;">epp GmbH</div>
      <div style="width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #b8860b, transparent); margin: 0 auto 15px;"></div>
      <h1 style="font-size: 32px; font-weight: 700; color: #1a1a2e; margin: 0 0 5px; letter-spacing: 2px;">ZERTIFIKAT</h1>
      <div style="width: 100px; height: 2px; background: linear-gradient(90deg, transparent, #b8860b, transparent); margin: 0 auto 10px;"></div>
      <p style="font-size: 13px; color: #666; margin: 0; font-style: italic;">Bevollmächtigung und Verpflichtungserklärung</p>
    </div>

    <!-- Body -->
    <div style="text-align: center; margin: 25px 0;">
      <p style="font-size: 14px; color: #444; margin-bottom: 20px;">Hiermit wird bestätigt, dass</p>
      <p style="font-size: 26px; font-weight: 700; color: #1a1a2e; margin: 15px 0; font-family: 'Georgia', serif;">${fullName}</p>
      <div style="width: 200px; height: 1px; background: #b8860b; margin: 15px auto;"></div>
      <p style="font-size: 14px; color: #444; margin: 15px 0 5px;">mit Wirkung zum <strong>${formattedStartDate}</strong></p>
      <p style="font-size: 14px; color: #444; margin: 5px 0 20px;">als</p>
      <p style="font-size: 22px; font-weight: 700; color: #1a1a2e; letter-spacing: 1px; margin: 10px 0;">KYC Compliance Officer</p>
      <p style="font-size: 14px; color: #444; margin: 15px 0;">bei der epp GmbH tätig ist und bevollmächtigt wurde, alle erforderlichen Handlungen im Bereich</p>
    </div>

    <!-- Competencies -->
    <div style="background: rgba(184,134,11,0.06); border-left: 3px solid #b8860b; padding: 15px 20px; margin: 20px 0; font-size: 13px; color: #333; line-height: 1.8;">
      <strong>Know Your Customer (KYC)</strong> · Anti-Money Laundering (AML) · Counter Terrorist Financing (CTF) · Internationale Sanktions- und Embargoregelungen · Datenschutz (DSGVO) · Interne Compliance- und Kontrollsysteme
    </div>

    <p style="font-size: 13px; color: #444; text-align: center; margin: 20px 0;">vollumfänglich, ordnungsgemäß und rechtskonform auszuüben.</p>

    <!-- Certificate Number -->
    <div style="text-align: center; margin: 25px 0 15px;">
      <span style="font-size: 11px; color: #8b7332; letter-spacing: 2px;">ZERTIFIKATSNUMMER: PE-KYC-${Date.now().toString(36).toUpperCase()}</span>
    </div>

    <!-- Dates -->
    <div style="display: flex; justify-content: space-between; margin: 20px 0; font-size: 12px; color: #555;">
      <div><strong>Ausstellungsdatum:</strong><br>${certDate}</div>
      <div style="text-align: center;"><strong>Gültig ab:</strong><br>${formattedStartDate}</div>
      <div style="text-align: right;"><strong>Gültig bis:</strong><br>Unbefristet</div>
    </div>

    <!-- Signature and Seal -->
    <div style="margin-top: 35px; display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 30px;">
      <div style="text-align: center;">
        ${signatureImg}
        <div style="width: 200px; max-width: 100%; border-bottom: 1px solid #333; margin: 0 auto 5px;"></div>
        <p style="font-size: 13px; color: #333; margin: 5px 0 0;"><strong>Daniel Krauss</strong></p>
        <p style="font-size: 11px; color: #666; margin: 2px 0;">Geschäftsführer · epp GmbH</p>
      </div>
      <div style="text-align: center; flex: 0 0 auto;">
        <img src="https://trust-gateway-lab.lovable.app/certified-seal.png" alt="Zertifizierungssiegel" width="110" height="110" style="width: 110px; height: 110px; max-width: 110px; object-fit: contain; flex-shrink: 0; opacity: 0.9;" />
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e0d5b5;">
      <p style="font-size: 9px; color: #999; margin: 0;">epp GmbH · Kürschnershof 2 · D-90403 Nürnberg · Amtsgericht Nürnberg HRB 38566</p>
    </div>
  </div>
</div>`;

      const { error: certError } = await supabaseAdmin
        .from("employee_documents")
        .insert({
          user_id: userId,
          document_type: "certificate",
          title: certTitle,
          description: "Ihre offizielle Bevollmächtigung als KYC Compliance Officer bei der epp GmbH",
          contract_type: "kyc_compliance",
          content: certificateContent,
          is_read: false,
        });

      if (certError) {
        console.error("Error inserting KYC certificate:", certError);
      } else {
        console.log("KYC certificate created for user:", userId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Compliance email and certificate sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
