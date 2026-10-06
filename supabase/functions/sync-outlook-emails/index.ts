import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for Deno edge functions
declare const EdgeRuntime: { waitUntil?: (promise: Promise<any>) => void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutlookEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  body: {
    contentType: string;
    content: string;
  };
  receivedDateTime: string;
  isRead: boolean;
}

interface EmailAccount {
  id: string;
  email_address: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  assigned_to: string | null;
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

async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch {
    // ignore
  }
}

function scheduleTelegramDeletion(botToken: string, chatId: number, messageId: number, delayMs: number = 60000) {
  const deleteTask = (async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await deleteTelegramMessage(botToken, chatId, messageId);
  })();

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(deleteTask);
  }
}

// Check if email is an employee reply (sent FROM an assigned Outlook account with Re: subject)
function isEmployeeReplyOutlook(
  fromAddress: string,
  subject: string,
  accountEmailAddress: string
): boolean {
  // Check if subject indicates a reply
  const isReplySubject = /^(re:|aw:|antwort:)/i.test(subject.trim());
  if (!isReplySubject) return false;
  
  // Check if FROM address matches the assigned Outlook account
  // This means the employee sent the email from their assigned account
  const fromLower = fromAddress.toLowerCase().trim();
  const accountLower = accountEmailAddress.toLowerCase().trim();
  
  return fromLower.includes(accountLower) || accountLower.includes(fromLower);
}

// Send Telegram notification specifically for employee replies
async function sendEmployeeReplyTelegramNotification(
  supabase: any,
  replyInfo: {
    fromAddress: string;
    toAddress: string;
    subject: string;
    employeeName: string | null;
    bodyPreview: string;
  }
) {
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!TELEGRAM_BOT_TOKEN) return;

  // Check if any chat has active monitoring
  const { data: monitoring, error: monitorError } = await supabase
    .from('telegram_monitoring')
    .select('chat_id')
    .eq('is_active', true);

  if (monitorError || !monitoring || monitoring.length === 0) return;

  // Build distinct message for employee replies
  let message = `📬 <b>Mitarbeiter-Antwort (Outlook)</b>\n\n`;
  
  if (replyInfo.employeeName) {
    message += `👤 Von: <b>${escapeTelegramHtml(replyInfo.employeeName)}</b>\n`;
  }
  message += `📤 E-Mail: ${escapeTelegramHtml(replyInfo.fromAddress)}\n`;
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: monitor.chat_id,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      const result = await response.json().catch(() => null);
      console.log('[Outlook->Telegram] Employee reply sent to chat:', monitor.chat_id, result?.ok);
    } catch (e) {
      console.error('[Outlook->Telegram] Failed to send employee reply notification:', e);
    }
  }
}

// NOTE: Telegram notifications for email codes are DISABLED
// Email codes should only be visible in the admin dashboard, not in Telegram
async function sendTelegramEmailNotification(
  _supabase: any,
  _args: {
    toAddress: string;
    fromAddress: string;
    subject: string;
    extractedCodes: string[];
    extractedLinks: string[];
    employeeId: string | null;
  }
) {
  // DISABLED: Email codes should NOT be sent to Telegram
  // They are only visible in the admin E-Mail-Zentrale
  console.log('[Outlook->Telegram] Email notification DISABLED - codes only in admin dashboard');
  return;
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');
  const tenantId = (Deno.env.get('AZURE_TENANT_ID') || 'consumers');

  if (!clientId || !clientSecret || !tenantId) {
    console.error('Missing Azure credentials for token refresh');
    return null;
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Fetch emails from Microsoft Graph API
async function fetchOutlookEmails(accessToken: string, sinceMinutes: number = 60, emailAddress?: string): Promise<OutlookEmail[]> {
  const sinceDate = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  
  // First try Inbox, then also check Junk folder
  const folders = ['inbox', 'junkemail'];
  const allEmails: OutlookEmail[] = [];
  
  for (const folder of folders) {
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$filter=receivedDateTime ge ${sinceDate}&$orderby=receivedDateTime desc&$top=50&$select=id,subject,from,toRecipients,body,receivedDateTime,isRead`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch from ${folder}:`, response.status, errorText);
        continue;
      }

      const data = await response.json();
      const emails = data.value || [];
      console.log(`[${emailAddress || 'unknown'}] Folder ${folder}: ${emails.length} emails found`);
      
      if (emails.length > 0) {
        console.log(`[${emailAddress || 'unknown'}] First email subject: "${emails[0]?.subject}"`);
      }
      
      allEmails.push(...emails);
    } catch (error) {
      console.error(`Error fetching from ${folder}:`, error);
    }
  }
  
  return allEmails;
}

// Extract verification codes from email content
// IMPORTANT: Only extract codes that appear in verification-related contexts
// to avoid false positives like bounce IDs (e.g., "bounces+8141987...")
function extractVerificationCodes(content: string): string[] {
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
  // but only if no context-based codes were found
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

// Extract verification links from email content with scoring
function extractVerificationLinks(content: string): string[] {
  const allLinks: { url: string; score: number }[] = [];
  
  // URL pattern
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = content.matchAll(urlPattern);
  
  // Exclude patterns
  const excludePatterns = [
    'unsubscribe', 'abmelden', 'mailto:', 'tel:', '.png', '.jpg', '.gif', '.svg',
    '.css', '.js', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'pinterest.com', 'tiktok.com', 'apps.apple.com', 'play.google.com',
    'itunes.apple.com', 'doubleclick', 'googleadservices', 'adobe.io',
    'w3.org', '.dtd', 'xmlns'
  ];
  
  for (const match of matches) {
    const url = match[0].replace(/[.,;:!?)\]']+$/, ''); // Remove trailing punctuation
    const lowerUrl = url.toLowerCase();
    
    // Skip excluded patterns
    if (excludePatterns.some(p => lowerUrl.includes(p))) continue;
    
    let score = 10; // Base score for valid links
    
    // HIGHEST PRIORITY: crypto.com tracking links (they use url*.crypto.com/ls/click)
    if (/url\d*\.crypto\.com\/ls\/click/i.test(url)) {
      score += 300;
    }
    
    // High priority: verification keywords
    if (lowerUrl.includes('verify') || lowerUrl.includes('confirm') || lowerUrl.includes('bestätig') || lowerUrl.includes('verifiz')) {
      score += 200;
    }
    
    // Medium priority: activation/validation
    if (lowerUrl.includes('activate') || lowerUrl.includes('aktivier') || lowerUrl.includes('validate')) {
      score += 150;
    }
    
    // Lower priority: auth/token/code
    if (lowerUrl.includes('auth') || lowerUrl.includes('token') || lowerUrl.includes('code')) {
      score += 100;
    }
    
    // Tracking links from known services can still be important
    if (/\/ls\/click|\/c\/|\/l\//i.test(lowerUrl)) {
      score += 50;
    }
    
    // Penalty for marketing trackers (unless already high priority)
    if (score < 100 && /utm_|mc_eid|mkt_tok/i.test(lowerUrl)) {
      score -= 20;
    }
    
    if (score > 0 && !allLinks.some(l => l.url === url)) {
      allLinks.push({ url, score });
    }
  }
  
  // Sort by score and return URLs
  allLinks.sort((a, b) => b.score - a.score);
  return allLinks.map(l => l.url);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional email address filter and sync window
    let specificEmail: string | null = null;
    let sinceMinutes: number = 15; // default: last 15 min (reduced from 24h to avoid spam)
    try {
      const body = await req.json();
      specificEmail = body?.email_address || null;
      if (typeof body?.sinceMinutes === 'number' && Number.isFinite(body.sinceMinutes) && body.sinceMinutes > 0) {
        sinceMinutes = Math.min(Math.max(5, Math.floor(body.sinceMinutes)), 60 * 24 * 7); // clamp: 5 min .. 7 days
      }
    } catch {
      // No body or invalid JSON - sync all accounts
    }

    console.log('Starting Outlook email sync', specificEmail ? `for ${specificEmail}` : 'for all accounts', `window=${sinceMinutes}min`);

    // Fetch all Outlook OAuth email accounts
    let query = supabase
      .from('email_accounts')
      .select('id, email_address, access_token, refresh_token, token_expires_at, assigned_to')
      .eq('provider', 'outlook_oauth')
      .in('status', ['available', 'assigned']);

    if (specificEmail) {
      query = query.eq('email_address', specificEmail);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      console.error('Error fetching email accounts:', accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log('No Outlook OAuth accounts found');
      return new Response(
        JSON.stringify({ message: 'No Outlook OAuth accounts found', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${accounts.length} Outlook account(s) to sync`);

    let totalSynced = 0;
    const results: Array<{ email: string; synced: number; error?: string }> = [];

    for (const account of accounts as EmailAccount[]) {
      console.log(`Processing account: ${account.email_address}`);
      
      let accessToken = account.access_token;
      
      // Check if token is expired or missing
      if (!accessToken || (account.token_expires_at && new Date(account.token_expires_at) < new Date())) {
        console.log(`Token expired or missing for ${account.email_address}, refreshing...`);
        
        if (!account.refresh_token) {
          console.error(`No refresh token for ${account.email_address}`);
          results.push({ email: account.email_address, synced: 0, error: 'No refresh token' });
          continue;
        }

        const newTokens = await refreshAccessToken(account.refresh_token);
        if (!newTokens) {
          console.error(`Failed to refresh token for ${account.email_address}`);
          results.push({ email: account.email_address, synced: 0, error: 'Token refresh failed' });
          continue;
        }

        // Update tokens in database
        const { error: updateError } = await supabase
          .from('email_accounts')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          })
          .eq('id', account.id);

        if (updateError) {
          console.error(`Failed to update tokens for ${account.email_address}:`, updateError);
        }

        accessToken = newTokens.access_token;
      }

      // Fetch emails from Outlook
      const emails = await fetchOutlookEmails(accessToken, sinceMinutes, account.email_address);
      console.log(`Fetched ${emails.length} emails for ${account.email_address}`);

      let accountSynced = 0;
      // Track the newest email inserted this sync cycle for Telegram notification
      let newestEmailForTelegram: {
        toAddress: string;
        fromAddress: string;
        subject: string;
        extractedCodes: string[];
        extractedLinks: string[];
        receivedAt: string;
        bodyPreview: string;
        isEmployeeReply: boolean;
      } | null = null;

      for (const email of emails) {
        // Check if email already exists using the unique Outlook message ID
        // This is more reliable than timestamp matching which can have precision issues
        const { data: existingEmails } = await supabase
          .from('received_emails')
          .select('id')
          .eq('to_address', account.email_address)
          .contains('headers', { outlook_id: email.id });

        if (existingEmails && existingEmails.length > 0) {
          console.log(`Email already exists (outlook_id: ${email.id}): ${email.subject}`);
          continue;
        }

        // Extract codes and links
        const bodyContent = email.body.content || '';
        const plainText = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const codes = extractVerificationCodes(plainText);
        const links = extractVerificationLinks(bodyContent);

        console.log(`Email "${email.subject}" - Codes: ${codes.join(', ')}, Links: ${links.length}`);

        // Insert into received_emails table
        const { error: insertError } = await supabase
          .from('received_emails')
          .insert({
            to_address: account.email_address,
            from_address: email.from.emailAddress.address,
            subject: email.subject,
            body_text: plainText,
            body_html: email.body.contentType === 'html' ? bodyContent : null,
            received_at: email.receivedDateTime,
            is_read: email.isRead,
            headers: {
              outlook_id: email.id,
              codes_extracted: codes,
              links_extracted: links,
            },
          });

        if (insertError) {
          console.error(`Failed to insert email for ${account.email_address}:`, insertError);
        } else {
          accountSynced++;
          totalSynced++;

          // Track only the newest email for Telegram notification
          // (emails are already sorted by receivedDateTime desc, so first inserted is newest)
          if (!newestEmailForTelegram) {
            // Check if this is an employee reply (sent FROM the assigned account with Re: subject)
            const isReply = isEmployeeReplyOutlook(
              email.from.emailAddress.address,
              email.subject || '',
              account.email_address
            );
            
            newestEmailForTelegram = {
              toAddress: account.email_address,
              fromAddress: email.from.emailAddress.address,
              subject: email.subject || '(Kein Betreff)',
              extractedCodes: codes,
              extractedLinks: links,
              receivedAt: email.receivedDateTime,
              bodyPreview: plainText,
              isEmployeeReply: isReply,
            };
          }
        }
      }

      // Send Telegram notification ONLY for the newest email (if any new emails were synced)
      if (newestEmailForTelegram) {
        try {
          console.log(`[Outlook->Telegram] Forwarding only newest email: "${newestEmailForTelegram.subject}" from ${newestEmailForTelegram.receivedAt}`);
          
          if (newestEmailForTelegram.isEmployeeReply) {
            // Get employee name for the reply notification
            let employeeName: string | null = null;
            if (account.assigned_to) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', account.assigned_to)
                .single();
              if (profile) {
                employeeName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null;
              }
            }
            
            console.log(`[Outlook->Telegram] Detected employee reply from: ${employeeName || newestEmailForTelegram.fromAddress}`);
            await sendEmployeeReplyTelegramNotification(supabase, {
              fromAddress: newestEmailForTelegram.fromAddress,
              toAddress: newestEmailForTelegram.toAddress,
              subject: newestEmailForTelegram.subject,
              employeeName,
              bodyPreview: newestEmailForTelegram.bodyPreview,
            });
          } else {
            // Regular email notification
            await sendTelegramEmailNotification(supabase, {
              toAddress: newestEmailForTelegram.toAddress,
              fromAddress: newestEmailForTelegram.fromAddress,
              subject: newestEmailForTelegram.subject,
              extractedCodes: newestEmailForTelegram.extractedCodes,
              extractedLinks: newestEmailForTelegram.extractedLinks,
              employeeId: account.assigned_to,
            });
          }
        } catch (e) {
          console.error('[Outlook->Telegram] Notification error:', e);
        }
      }

      results.push({ email: account.email_address, synced: accountSynced });
    }

    console.log(`Sync completed. Total emails synced: ${totalSynced}`);

    return new Response(
      JSON.stringify({ 
        message: 'Outlook email sync completed',
        totalSynced,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in sync-outlook-emails:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
