import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for Deno edge functions
declare const EdgeRuntime: { waitUntil?: (promise: Promise<any>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CloudflareEmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  raw?: string;
}

// Decode Quoted-Printable encoded content and convert to UTF-8
function decodeQuotedPrintable(input: string): string {
  if (!input) return "";
  
  // First, handle soft line breaks (= at end of line)
  let decoded = input.replace(/=\r?\n/g, "");
  
  // Decode all =XX hex sequences to bytes
  const bytes: number[] = [];
  let i = 0;
  while (i < decoded.length) {
    if (decoded[i] === '=' && i + 2 < decoded.length) {
      const hex = decoded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    bytes.push(decoded.charCodeAt(i));
    i++;
  }
  
  // Convert bytes to UTF-8 string
  try {
    const uint8Array = new Uint8Array(bytes);
    return new TextDecoder('utf-8').decode(uint8Array);
  } catch (e) {
    // Fallback to simple replacement if UTF-8 decoding fails
    return input
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}

// Check if content appears to be Quoted-Printable encoded
function isQuotedPrintable(content: string): boolean {
  if (!content) return false;
  // Look for common QP patterns like =3D (=), =20 (space), or soft line breaks
  return /=3D|=20|=\r?\n|=[0-9A-Fa-f]{2}/i.test(content);
}

// Recursively parse MIME parts
function parseMimePart(
  content: string,
  opts: { depth?: number; seenBoundaries?: Set<string> } = {}
): { text: string; html: string } {
  const depth = opts.depth ?? 0;
  const seenBoundaries = opts.seenBoundaries ?? new Set<string>();

  // Safety guard: prevent infinite recursion on malformed emails
  if (depth > 12) {
    console.log("MIME parse: max depth reached, stopping recursion");
    return { text: "", html: "" };
  }

  let text = "";
  let html = "";
  
  // Check for nested multipart
  const nestedBoundaryMatch = content.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^"\r\n;]+)"?/i);
  if (nestedBoundaryMatch) {
    const nestedBoundary = nestedBoundaryMatch[1];

    // Avoid cycles / repeated boundary parsing
    if (seenBoundaries.has(nestedBoundary)) {
      console.log("MIME parse: boundary already seen, skipping:", nestedBoundary);
    } else {
      seenBoundaries.add(nestedBoundary);

    const nestedParts = content.split(new RegExp(`--${nestedBoundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

      // If split didn't actually find any boundary markers, do NOT recurse (prevents infinite loop)
      if (nestedParts.length <= 1) {
        console.log("MIME parse: boundary declared but markers missing, falling back to direct parsing");
      } else {
    
    for (const nestedPart of nestedParts) {
      if (nestedPart.trim() === '' || nestedPart.trim() === '--') continue;
        // Prevent self-recursion when content isn't actually split
        if (nestedPart === content) continue;
        const parsed = parseMimePart(nestedPart, { depth: depth + 1, seenBoundaries });
      if (parsed.text && !text) text = parsed.text;
      if (parsed.html && !html) html = parsed.html;
    }
    return { text, html };
      }
    }
  }
  
  // Extract content type
  const contentTypeMatch = content.match(/Content-Type:\s*([^\r\n;]+)/i);
  if (!contentTypeMatch) return { text, html };
  
  const contentType = contentTypeMatch[1].toLowerCase().trim();
  
  // Skip non-text content types (like attachments)
  if (!contentType.includes("text/plain") && !contentType.includes("text/html")) {
    return { text, html };
  }
  
  // Find the body (after double newline - the actual content starts after headers)
  const bodyMatch = content.match(/\r?\n\r?\n([\s\S]*)/);
  if (!bodyMatch) return { text, html };
  
  let body = bodyMatch[1];
  
  // Remove trailing boundary markers if present
  body = body.replace(/--[^\r\n]+--[\s]*$/, '').trim();
  
  // Check encoding
  const encodingMatch = content.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';
  
  if (encoding === "base64") {
    try {
      const cleanBase64 = body.replace(/[\r\n\s]/g, "");
      // Decode base64 to bytes, then interpret as UTF-8
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      body = new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      console.log("Failed to decode base64:", e);
    }
  } else if (encoding === "quoted-printable") {
    body = decodeQuotedPrintable(body);
  }
  
  if (contentType.includes("text/plain")) {
    text = body;
  } else if (contentType.includes("text/html")) {
    html = body;
  }
  
  return { text, html };
}

// Parse MIME multipart content from raw email
function parseRawEmail(raw: string): { text: string; html: string } {
  let text = "";
  let html = "";

  // Try to find boundary in Content-Type header
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    
    for (const part of parts) {
      // Skip empty parts and closing boundary
      if (part.trim() === '' || part.trim() === '--') continue;
      
      const parsed = parseMimePart(part, { depth: 0, seenBoundaries: new Set([boundary]) });
      if (parsed.text && !text) text = parsed.text;
      if (parsed.html && !html) html = parsed.html;
    }
  }
  
  // Fallback: try to extract content directly if no boundary or no content found
  if (!text && !html) {
    // Check for simple text email (no multipart)
    const simpleBodyMatch = raw.match(/\r?\n\r?\n([\s\S]+)$/);
    if (simpleBodyMatch) {
      let body = simpleBodyMatch[1].trim();
      
      // Check if the raw email has quoted-printable encoding
      const encodingMatch = raw.match(/Content-Transfer-Encoding:\s*quoted-printable/i);
      if (encodingMatch || isQuotedPrintable(body)) {
        body = decodeQuotedPrintable(body);
      }
      
      text = body;
    }
  }

  return { text, html };
}

// Extract verification links from email content
function extractVerificationLinks(content: string): string[] {
  if (!content) return [];
  
  const links: string[] = [];
  
  // Exclude patterns (DOCTYPE, w3.org, etc.)
  const excludePatterns = [
    'w3.org', '.dtd', 'xmlns', 'unsubscribe', 'privacy', 'terms',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com',
    'mailto:', 'tel:', '.png', '.jpg', '.gif', '.svg', '.css', '.js',
    'doubleclick', 'googleadservices', 'adobe.io', 'play.google.com', 'apps.apple.com'
  ];
  
  // URL pattern - more comprehensive
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]']+/gi;
  const matches = content.matchAll(urlPattern);
  
  for (const match of matches) {
    let url = match[0].replace(/[.,;:!?)\]']+$/, ''); // Remove trailing punctuation
    const lowerUrl = url.toLowerCase();
    
    // Skip excluded patterns
    if (excludePatterns.some(p => lowerUrl.includes(p))) continue;
    
    // Clean up any remaining encoded characters
    url = url.replace(/&amp;/g, '&');
    
    if (!links.includes(url)) {
      links.push(url);
    }
  }
  
  return links;
}

// Extract verification codes from email content
// IMPORTANT: Only extract codes that appear in verification-related contexts
// to avoid false positives like bounce IDs (e.g., "bounces+8141987...")
function extractVerificationCodes(content: string): string[] {
  if (!content) return [];
  
  const codes: string[] = [];
  
  // Helper to validate codes (exclude years, placeholders, repeated digits)
  const isValidCode = (code: string): boolean => {
    const num = parseInt(code, 10);
    if (num >= 2020 && num <= 2030) return false; // Years
    if (code.length === 8 && code.startsWith('202')) return false; // Dates like 20260126
    if (/^(\d)\1+$/.test(code)) return false; // Repeated digits like 000000, 111111
    return true;
  };
  
  // Context-aware patterns - these REQUIRE verification keywords nearby
  const contextPatterns = [
    /(?:code|verification|bestätigungscode|verifizierungscode|pin|otp|passcode|dein code|your code|lautet|ist)[:\s]+(\d{4,8})/gi,
    /(\d{4,8})(?:\s+is your|lautet dein)/gi,
  ];
  
  // Extract codes WITH context (high confidence)
  for (const pattern of contextPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const code = match[1];
      if (code && isValidCode(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }
  }
  
  // Also check for standalone 5-6 digit codes (most common for verification)
  // but only if they appear in the main text body, not headers
  if (codes.length === 0) {
    const standalonePattern = /\b(\d{5,6})\b/g;
    const matches = content.matchAll(standalonePattern);
    for (const match of matches) {
      const code = match[1];
      if (code && isValidCode(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }
  }

  return codes;
}

// Delete a Telegram message
async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    console.log("Deleted Telegram message:", messageId, "in chat:", chatId);
  } catch (e) {
    console.log("Could not delete Telegram message:", messageId);
  }
}

// Check if email is an employee reply to a task mail
async function isEmployeeReply(
  supabase: any,
  fromAddress: string,
  subject: string
): Promise<{ isReply: boolean; employeeId: string | null; employeeName: string | null; taskTitle: string | null }> {
  // Check if subject indicates a reply
  const isReplySubject = /^(re:|aw:|antwort:)/i.test(subject.trim());
  if (!isReplySubject) {
    return { isReply: false, employeeId: null, employeeName: null, taskTitle: null };
  }

  const fromLower = fromAddress.toLowerCase().trim();
  // Extract just the email address if it includes a name
  const emailMatch = fromLower.match(/<([^>]+)>/) || [null, fromLower];
  const cleanFromAddress = emailMatch[1] || fromLower;

  // Check if sender is a generated email (custom domain) assigned to an employee
  const { data: genEmail } = await supabase
    .from("generated_emails")
    .select("user_id, task_id")
    .ilike("full_address", cleanFromAddress)
    .eq("is_active", true)
    .maybeSingle();

  if (genEmail?.user_id) {
    // Get employee name and task title
    const [profileRes, taskRes] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name").eq("id", genEmail.user_id).single(),
      genEmail.task_id ? supabase.from("tasks").select("title").eq("id", genEmail.task_id).single() : { data: null }
    ]);
    
    const employeeName = profileRes.data 
      ? `${profileRes.data.first_name || ''} ${profileRes.data.last_name || ''}`.trim() 
      : null;
    
    return {
      isReply: true,
      employeeId: genEmail.user_id,
      employeeName,
      taskTitle: taskRes.data?.title || null,
    };
  }

  // Check if sender is an Outlook email assigned to an employee
  const { data: emailAccount } = await supabase
    .from("email_accounts")
    .select("assigned_to")
    .ilike("email_address", cleanFromAddress)
    .eq("status", "assigned")
    .maybeSingle();

  if (emailAccount?.assigned_to) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", emailAccount.assigned_to)
      .single();
    
    const employeeName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
      : null;
    
    return {
      isReply: true,
      employeeId: emailAccount.assigned_to,
      employeeName,
      taskTitle: null, // Outlook accounts don't have direct task link
    };
  }

  return { isReply: false, employeeId: null, employeeName: null, taskTitle: null };
}

// Send Telegram notification specifically for employee replies
async function sendEmployeeReplyTelegramNotification(
  supabase: any,
  replyInfo: {
    fromAddress: string;
    toAddress: string;
    subject: string;
    employeeName: string | null;
    taskTitle: string | null;
    bodyPreview: string;
  }
) {
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.log("Telegram bot token not configured, skipping employee reply notification");
      return;
    }

    // Check if any chat has active monitoring
    const { data: monitoring, error: monitorError } = await supabase
      .from("telegram_monitoring")
      .select("chat_id")
      .eq("is_active", true);

    if (monitorError || !monitoring || monitoring.length === 0) {
      console.log("No active Telegram monitoring for employee reply");
      return;
    }

    // Build distinct message for employee replies
    let message = `📬 <b>Mitarbeiter-Antwort</b>\n\n`;
    
    if (replyInfo.employeeName) {
      message += `👤 Von: <b>${escapeTelegramHtml(replyInfo.employeeName)}</b>\n`;
    }
    message += `📤 E-Mail: ${escapeTelegramHtml(replyInfo.fromAddress)}\n`;
    
    if (replyInfo.taskTitle) {
      message += `📋 Auftrag: ${escapeTelegramHtml(replyInfo.taskTitle)}\n`;
    }
    
    message += `📝 Betreff: ${escapeTelegramHtml(replyInfo.subject)}\n`;
    
    // Add short preview of reply content
    if (replyInfo.bodyPreview) {
      const preview = replyInfo.bodyPreview.substring(0, 200);
      message += `\n💬 <i>${escapeTelegramHtml(preview)}${replyInfo.bodyPreview.length > 200 ? '...' : ''}</i>\n`;
    }
    
    message += `\n<i>→ Antworten-Tab in E-Mail-Zentrale öffnen</i>`;

    // Send to all active monitoring chats (no auto-delete for replies - they're important)
    for (const monitor of monitoring) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: monitor.chat_id,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        const result = await response.json();
        console.log("Telegram employee reply notification sent to chat:", monitor.chat_id, result.ok);
      } catch (e) {
        console.error("Failed to send employee reply Telegram notification:", e);
      }
    }
  } catch (error) {
    console.error("Error in sendEmployeeReplyTelegramNotification:", error);
  }
}

// Schedule message deletion after delay (60 seconds = 60000ms)
function scheduleEmailDeletion(botToken: string, chatId: number, messageId: number, delayMs: number = 60000) {
  const deleteTask = (async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await deleteTelegramMessage(botToken, chatId, messageId);
  })();
  
  // Use EdgeRuntime.waitUntil if available
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(deleteTask);
  }
}

// Send Telegram notification for new email
async function sendTelegramNotification(
  supabase: any,
  emailInfo: {
    toAddress: string;
    fromAddress: string;
    subject: string;
    extractedCodes: string[];
    extractedLinks: string[];
    userId: string | null;
  }
) {
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.log("Telegram bot token not configured, skipping notification");
      return;
    }

    // Check if any chat has active monitoring
    const { data: monitoring, error: monitorError } = await supabase
      .from("telegram_monitoring")
      .select("chat_id")
      .eq("is_active", true);

    if (monitorError || !monitoring || monitoring.length === 0) {
      console.log("No active Telegram monitoring");
      return;
    }

    // Get employee info if userId is available
    let employeeName = "";
    if (emailInfo.userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", emailInfo.userId)
        .single();
      
      if (profile) {
        employeeName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      }
    }

    // Note: Email notifications are ALWAYS forwarded to Telegram
    // The telegram_notifications_enabled toggle only controls /worker listing

    // Build message
    let message = `📧 <b>Neue E-Mail</b>\n\n`;
    message += `📬 An: ${escapeTelegramHtml(emailInfo.toAddress)}\n`;
    message += `📤 Von: ${escapeTelegramHtml(emailInfo.fromAddress)}\n`;
    message += `📝 Betreff: ${escapeTelegramHtml(emailInfo.subject)}\n`;
    
    if (employeeName) {
      message += `👤 Mitarbeiter: ${escapeTelegramHtml(employeeName)}\n`;
    }

    if (emailInfo.extractedCodes.length > 0) {
      message += `\n🔢 <b>Codes:</b> ${emailInfo.extractedCodes.join(", ")}\n`;
    }

    // Only show the TOP link (most important one based on scoring)
    if (emailInfo.extractedLinks.length > 0) {
      message += `\n🔗 <b>Link:</b>\n`;
      message += `• ${escapeTelegramHtml(emailInfo.extractedLinks[0])}\n`;
    }

    // Send to all active monitoring chats and schedule deletion
    for (const monitor of monitoring) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: monitor.chat_id,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        const result = await response.json();
        console.log("Telegram email notification sent to chat:", monitor.chat_id);
        
        // Schedule deletion after 60 seconds
        if (result.ok && result.result?.message_id) {
          scheduleEmailDeletion(TELEGRAM_BOT_TOKEN, monitor.chat_id, result.result.message_id, 60000);
        }
      } catch (e) {
        console.error("Failed to send Telegram notification:", e);
      }
    }
  } catch (error) {
    console.error("Error in sendTelegramNotification:", error);
  }
}

// Escape special characters for Telegram HTML parse mode
function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Email webhook received:", req.method);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CloudflareEmailPayload = await req.json();
    console.log("Email payload keys:", Object.keys(payload));
    console.log("Email from:", payload.from, "to:", payload.to);

    const toAddress = payload.to.toLowerCase();
    const fromAddress = payload.from;
    const subject = payload.subject || "(Kein Betreff)";
    
    // Parse raw email to extract text and html if not provided directly
    let bodyText = payload.text || "";
    let bodyHtml = payload.html || "";
    
    if ((!bodyText && !bodyHtml) && payload.raw) {
      console.log("Parsing raw email content...");
      const parsed = parseRawEmail(payload.raw);
      bodyText = parsed.text;
      bodyHtml = parsed.html;
      console.log(`Parsed text length: ${bodyText.length}, html length: ${bodyHtml.length}`);
    }

    // IMPORTANT: Decode Quoted-Printable if the content appears to be encoded
    // This handles cases where Cloudflare sends already-encoded content
    if (isQuotedPrintable(bodyText)) {
      console.log("Decoding Quoted-Printable text content...");
      bodyText = decodeQuotedPrintable(bodyText);
    }
    if (isQuotedPrintable(bodyHtml)) {
      console.log("Decoding Quoted-Printable HTML content...");
      bodyHtml = decodeQuotedPrintable(bodyHtml);
    }

    // Extract domain from to address
    const domain = toAddress.split("@")[1];

    console.log(`Processing email to: ${toAddress} from: ${fromAddress}`);

    // Find the domain in our database
    const { data: domainData, error: domainError } = await supabase
      .from("email_domains")
      .select("id")
      .eq("domain", domain)
      .eq("is_active", true)
      .single();

    if (domainError || !domainData) {
      console.log(`Domain not found or inactive: ${domain}`);
      // Still accept the email but log it
      return new Response(
        JSON.stringify({ success: true, message: "Domain not registered but email logged" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this email address was generated/assigned for a specific employee/task
    const { data: generatedEmail } = await supabase
      .from("generated_emails")
      .select("task_id, submission_id, user_id")
      .eq("full_address", toAddress)
      .eq("is_active", true)
      .maybeSingle();

    let resolvedTaskId = generatedEmail?.task_id || null;
    let resolvedSubmissionId = generatedEmail?.submission_id || null;

    // NOTE: We intentionally do NOT auto-attach the newest submission when the
    // generated address has no task/submission binding. Otherwise unrelated
    // incoming mails (e.g. spam or another service) would appear in the wrong
    // task. Such mails only land in the admin E-Mail-Zentrale for manual routing.

    // Extract codes and links for storage in headers
    const plainText = bodyHtml ? bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : bodyText;
    const extractedCodes = extractVerificationCodes(plainText);
    const extractedLinks = extractVerificationLinks(bodyHtml || bodyText);
    
    console.log(`Extracted codes: ${extractedCodes.join(', ')}`);
    console.log(`Extracted links: ${extractedLinks.length}`);

    // Insert the received email
    // IMPORTANT: Do NOT auto-assign submission_id to incoming emails!
    // Emails must first appear in Admin's E-Mail-Zentrale for review.
    // Admin can then manually route approved emails to employees via "An Mitarbeiter senden".
    // Only task_id is set for filtering purposes, but submission_id stays null.
    const { data: emailData, error: emailError } = await supabase
      .from("received_emails")
      .insert({
        domain_id: domainData.id,
        to_address: toAddress,
        from_address: fromAddress,
        subject: subject,
        body_text: bodyText,
        body_html: bodyHtml,
        headers: {
          ...payload.headers,
          codes_extracted: extractedCodes,
          links_extracted: extractedLinks,
          // Store reference for potential later routing
          generated_email_user_id: generatedEmail?.user_id || null,
          generated_email_submission_id: resolvedSubmissionId,
        },
        raw_email: payload.raw || "",
        task_id: resolvedTaskId,
        submission_id: resolvedSubmissionId,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailError) {
      console.error("Error inserting email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to save email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email saved successfully:", emailData.id);

    // Check if this is an employee reply to a task mail
    const replyCheck = await isEmployeeReply(supabase, fromAddress, subject);
    
    if (replyCheck.isReply) {
      // Send specialized employee reply notification
      console.log("Detected employee reply from:", replyCheck.employeeName || fromAddress);
      await sendEmployeeReplyTelegramNotification(supabase, {
        fromAddress,
        toAddress,
        subject,
        employeeName: replyCheck.employeeName,
        taskTitle: replyCheck.taskTitle,
        bodyPreview: bodyText || bodyHtml?.replace(/<[^>]*>/g, ' ').substring(0, 300) || '',
      });
    }
    // Generic email forwarding to Telegram removed per user request

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailData.id,
        codes_extracted: extractedCodes,
        links_extracted: extractedLinks.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in email-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
