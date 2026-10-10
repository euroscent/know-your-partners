/**
 * Formats contract content with proper paragraphs and bold clause headings.
 * Works with both numbered sections (1. Title, 2. Title) and § sections (§ 1 Title).
 * Also handles {{startdatum}} and other placeholders.
 */
export function formatContractContent(content: string): string {
  if (!content) return "";

  let formatted = content;

  // First, normalize line breaks
  formatted = formatted.replace(/\r\n/g, '\n');

  // Check if content already has <strong> tags (pre-formatted from template editor)
  const hasExistingStrong = /<strong>/i.test(formatted);

  if (!hasExistingStrong) {
    // Only apply auto-formatting if there are no existing <strong> tags
    // Format numbered sections like "1. Vertragsbeginn" - make them bold headings
    // IMPORTANT: avoid matching years like "2026. Die" by restricting to 1-2 digit section numbers.
    formatted = formatted.replace(
      /^(\d{1,2})\.\s+([A-ZÄÖÜ][A-Za-zäöüÄÖÜß\s,\-&]+?)(?=\n|\s+[A-ZÄÖÜ]|\s+Der\/die|\s+Die\s|\s+Das\s|\s+Es\s|\s+Dieser|\s+Diese|\s+Ein\s|\s+Eine\s|$)/gm,
      '\n\n<strong>$1. $2</strong>\n\n'
    );

    // Format § sections like "§ 1 Vertragsgegenstand" or "§1 Title"
    // IMPORTANT: Only match at LINE START (^) to avoid matching inline references like "gemäß § 8 SGB IV"
    formatted = formatted.replace(
      /^(§\s*\d+)\s+([A-ZÄÖÜ][A-Za-zäöüÄÖÜß\s,\-&]+?)(?=\n|\s+[A-ZÄÖÜ]|\s+Der\/die|\s+Die\s|\s+Das\s|$)/gm,
      '\n\n<strong>$1 $2</strong>\n\n'
    );

    // Also handle standalone bold patterns like "**1. Title**" that might be in the template
    formatted = formatted.replace(
      /\*\*(\d{1,2}\.\s+[^*]+)\*\*/g,
      '<strong>$1</strong>'
    );
  }

  // IMPORTANT: Ensure there's always a double newline BEFORE each <strong> tag
  // This guarantees headings become their own block even if the template only has one newline
  formatted = formatted.replace(/([^\n])\n(<strong>)/g, '$1\n\n$2');
  formatted = formatted.replace(/\n(<strong>)/g, '\n\n$1');

  // Convert double newlines to paragraph breaks
  // Split content by double (or more) newlines
  const blocks = formatted.split(/\n{2,}/);
  
  // Process each block
  const processedBlocks = blocks
    .map(block => block.trim())
    .filter(block => block.length > 0)
    .map(block => {
      // If block starts with <strong> it's intended as a clause heading.
      // In the editor, headings are often written as:
      // <strong>3. Vergütung</strong>\nDie monatliche Vergütung ...
      // If we wrap the whole block, the following paragraph becomes bold too.
      if (block.startsWith('<strong>')) {
        const m = block.match(/^<strong>[\s\S]*?<\/strong>/i);
        const headingHtml = m?.[0] ?? block;
        const rest = block.slice(headingHtml.length).replace(/^\s+/, '');

        const parts: string[] = [];
        parts.push(`<p class="contract-heading">${headingHtml}</p>`);

        if (rest.length > 0) {
          // If rest is already HTML, keep it; otherwise wrap as normal paragraph.
          if (rest.startsWith('<p>') || rest.startsWith('<div>') || rest.startsWith('<img') || rest.startsWith('<h')) {
            parts.push(rest);
          } else {
            const withBreaks = rest.replace(/\n/g, '<br/>');
            parts.push(`<p>${withBreaks}</p>`);
          }
        }

        return parts.join('\n');
      }

      // If block contains other HTML tags, leave as-is
      if (block.startsWith('<p>') || block.startsWith('<div>') || block.startsWith('<img') || block.startsWith('<h')) {
        return block;
      }

      // Convert single newlines within block to <br/>
      const withBreaks = block.replace(/\n/g, '<br/>');
      return `<p>${withBreaks}</p>`;
    });

  formatted = processedBlocks.join('\n');

  // Clean up any empty paragraphs
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');
  formatted = formatted.replace(/<p>\s*<br\/?>\s*<\/p>/g, '');
  
  // Clean up excessive spacing
  formatted = formatted.replace(/(<\/p>)\s*\n*\s*(<p)/g, '$1\n$2');

  return formatted;
}

/**
 * Data required for contract placeholder replacement.
 */
export interface ContractPlaceholderData {
  startDate?: string;
  salary?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  companySignature?: string;
  employeeSignature?: string;
}

/**
 * Company info for the parties block.
 */
export interface CompanyInfo {
  name?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

/**
 * Replaces all placeholder variations in contract content.
 * Handles various spellings and formats like {{startdatum}}, {{stardatum}}, etc.
 */
export function replaceContractPlaceholders(
  content: string,
  data: ContractPlaceholderData
): string {
  if (!content) return "";

  const safe = (v: string | undefined) => v || "";
  let result = content;

  // Replace startdatum with various spellings (including typo "stardatum")
  result = result.replace(/\{\{\s*star?t?datum\s*\}\}/gi, safe(data.startDate));
  
  // Replace salary placeholders
  result = result.replace(/\{\{\s*salary\s*\}\}/gi, safe(data.salary));
  result = result.replace(/\{\{\s*gehalt\s*\}\}/gi, safe(data.salary));
  
  // Replace name placeholders
  result = result.replace(/\{\{\s*first_name\s*\}\}/gi, safe(data.firstName));
  result = result.replace(/\{\{\s*vorname\s*\}\}/gi, safe(data.firstName));
  result = result.replace(/\{\{\s*last_name\s*\}\}/gi, safe(data.lastName));
  result = result.replace(/\{\{\s*nachname\s*\}\}/gi, safe(data.lastName));
  const fullName = data.fullName || `${safe(data.firstName)} ${safe(data.lastName)}`.trim();
  result = result.replace(/\{\{\s*full_name\s*\}\}/gi, fullName);
  result = result.replace(/\{\{\s*name\s*\}\}/gi, fullName);

  // Replace address placeholders
  result = result.replace(/\{\{\s*street\s*\}\}/gi, safe(data.street));
  result = result.replace(/\{\{\s*strasse\s*\}\}/gi, safe(data.street));
  result = result.replace(/\{\{\s*adresse\s*\}\}/gi, safe(data.street));
  result = result.replace(/\{\{\s*postal_code\s*\}\}/gi, safe(data.postalCode));
  result = result.replace(/\{\{\s*plz\s*\}\}/gi, safe(data.postalCode));
  result = result.replace(/\{\{\s*postleitzahl\s*\}\}/gi, safe(data.postalCode));
  result = result.replace(/\{\{\s*city\s*\}\}/gi, safe(data.city));
  result = result.replace(/\{\{\s*stadt\s*\}\}/gi, safe(data.city));
  result = result.replace(/\{\{\s*ort\s*\}\}/gi, safe(data.city));

  // Replace signature placeholders
  if (data.companySignature) {
    const companySigTag = `<div class="signature-block"><p><strong>Unterschrift Arbeitgeber</strong></p><img src="${data.companySignature}" alt="Unterschrift Arbeitgeber" style="max-height:128px;object-fit:contain;" /></div>`;
    result = result.replace(/\{\{\s*company_signature\s*\}\}/gi, companySigTag);
  }

  if (data.employeeSignature) {
    const employeeSigTag = `<div class="signature-block"><p><strong>Unterschrift Arbeitnehmer</strong></p><img src="${data.employeeSignature}" alt="Unterschrift Arbeitnehmer" style="max-height:128px;object-fit:contain;" /></div>`;
    if (/\{\{\s*signature\s*\}\}/i.test(result)) {
      result = result.replace(/\{\{\s*signature\s*\}\}/gi, employeeSigTag);
    }
  }

  return result;
}

/**
 * Generates the contract header HTML with logo.
 * Matches the PDF layout.
 */
export function generateContractHeader(logoUrl: string): string {
  return `
    <div class="contract-header" style="text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb;">
      <img src="${logoUrl}" alt="EuroScent GmbH Logo" style="max-height: 56px; margin-bottom: 0.5rem;" />
    </div>
  `;
}

/**
 * Generates the "Vertrag zwischen" (Contract between) block with company and employee info.
 * Automatically inserted after the header and before the contract clauses.
 */
export function generateContractPartiesBlock(
  contractTitle: string,
  company: CompanyInfo,
  employee: { firstName?: string; lastName?: string; street?: string; postalCode?: string; city?: string; country?: string }
): string {
  const companyName = company.name || "EuroScent GmbH";
  const companyStreet = company.street || "";
  const companyPostal = company.postalCode || "";
  const companyCity = company.city || "";
  const companyCountry = company.country || "Deutschland";

  const empName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "—";
  const empStreet = employee.street || "";
  const empPostalCity = `${employee.postalCode || ""} ${employee.city || ""}`.trim();
  const empCountry = employee.country || "";

  return `
    <h2 style="text-align:center; font-size:1.25rem; font-weight:700; margin:1.5rem 0 1rem;">${contractTitle}</h2>
    <p style="font-weight:600; margin-bottom:0.25rem;">Vertrag zwischen</p>
    <div style="display:flex; justify-content:space-between; background:#f3f4f6; border-radius:8px; padding:1rem 1.25rem; margin-bottom:1.5rem; gap:2rem; flex-wrap:wrap;">
      <div style="flex:1; min-width:180px;">
        <p style="margin:0 0 0.25rem; font-weight:600; font-size:0.875rem; color:#64748b;">Unternehmen:</p>
        <p style="margin:0 0 0.5rem; font-weight:700; font-size:1rem;">${companyName}</p>
        <p style="margin:0; font-size:0.9rem; line-height:1.4;">${companyStreet}${companyStreet ? "<br/>" : ""}${companyPostal} ${companyCity}${companyPostal || companyCity ? "<br/>" : ""}${companyCountry}</p>
      </div>
      <div style="flex:1; min-width:180px;">
        <p style="margin:0 0 0.25rem; font-weight:600; font-size:0.875rem; color:#64748b;">Mitarbeiter/in:</p>
        <p style="margin:0 0 0.5rem; font-weight:700; font-size:1rem;">${empName}</p>
        <p style="margin:0; font-size:0.9rem; line-height:1.4;">${empStreet}${empStreet ? "<br/>" : ""}${empPostalCity}${empCountry ? "<br/>" + empCountry : ""}</p>
      </div>
    </div>
  `;
}
