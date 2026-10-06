import { useEffect, useState, useMemo } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Eye, ExternalLink, Loader2, CheckCircle2, Clock, RefreshCw, FileCheck, Mail, Lock, KeyRound, Phone, Link2, Info, Timer, Euro } from "lucide-react";
import { TaskImageRotator } from "@/components/TaskImageRotator";
import { getBannerUrls } from "@/lib/taskUtils";
import { DemoConsoleTour } from "@/components/DemoConsoleTour";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { toast } from "@/lib/toast-stub";
import { TaskActionsBar } from "@/components/TaskActionsBar";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import googlePlayBadge from "@/assets/google-play-badge.png";
import appStoreBadge from "@/assets/app-store-badge.png";
import confetti from "canvas-confetti";

// =====================================================================
// SMS Validation: ensure only legitimate KYC/verification SMS are accepted
// (filters out promotional SMS like Zasta, TeamKA, Kleinanzeigen ads, etc.)
// =====================================================================
const KYC_SMS_SENDER_WHITELIST = [
  // Identity verification providers
  "webid", "idnow", "postident", "verimi", "nect", "signicat", "onfido",
  // Banks commonly used in onboarding flows
  "commerzbank", "postbank", "norisbank", "deutsche bank", "deutschebank",
  "consorsbank", "consors", "comdirect", "ing", "ing-diba", "ingdiba",
  "dkb", "n26", "revolut", "wise", "hypovereinsbank", "hvb", "santander",
  "targobank", "sparkasse", "volksbank", "vr-bank", "vrbank", "raiffeisen",
  "bbva", "bnp", "unicredit",
  // Crypto / fintech onboarding
  "bitpanda", "kraken", "binance", "coinbase", "bitvavo", "etoro",
  // Generic verification senders
  "verify", "verification", "code", "otp", "tan", "auth", "2fa",
];

const KYC_SMS_BLOCKLIST_SENDERS = [
  "zasta", "teamka", "kleinanzeigen", "klarna marketing",
];

const KYC_SMS_KEYWORDS = [
  "code", "tan", "pin", "otp", "verifizier", "verification", "verify",
  "identification", "ident", "identifizier", "bestätigung", "bestaetigung",
  "einmalpasswort", "einmal-passwort", "vorgang", "passcode", "auth",
];

function isLikelyKycSms(sms: any, sinceTs?: string | null): { ok: boolean; reason: string } {
  const sender = String(sms?.messageSender || sms?.sender || "").toLowerCase().trim();
  const text = String(sms?.messageText || sms?.text || sms?.code || sms?.message || "");
  const textLower = text.toLowerCase();
  const ts = sms?.messageDate || sms?.received_at || sms?.created_at;

  // 1) Time filter: must arrive after task started
  if (sinceTs && ts && ts <= sinceTs) {
    return { ok: false, reason: `older than sinceTs (${ts} <= ${sinceTs})` };
  }

  // 2) Hard block known promo senders
  if (sender && KYC_SMS_BLOCKLIST_SENDERS.some((b) => sender.includes(b))) {
    return { ok: false, reason: `sender '${sender}' is blocklisted as promo` };
  }

  // 3) Block obvious marketing patterns even if sender is unknown
  const promoPatterns = [
    /geld wartet/i, /erstattung/i, /gewinnspiel/i, /rabatt/i,
    /angebot erstellen/i, /jetzt klicken/i, /steuer/i,
  ];
  if (promoPatterns.some((p) => p.test(text))) {
    return { ok: false, reason: "matches promotional pattern" };
  }

  // 4) Sender whitelist OR keyword match in text body
  const senderOk = sender && KYC_SMS_SENDER_WHITELIST.some((w) => sender.includes(w));
  const keywordOk = KYC_SMS_KEYWORDS.some((k) => textLower.includes(k));
  if (!senderOk && !keywordOk) {
    return { ok: false, reason: `sender '${sender}' not in whitelist and no KYC keyword in text` };
  }

  // 5) Must contain a 4–8 digit numeric code
  const codeMatch = text.match(/\b\d{4,8}\b/);
  if (!codeMatch) {
    return { ok: false, reason: "no 4-8 digit code in text" };
  }

  return { ok: true, reason: "ok" };
}

// Extract a clean 4-8 digit code from KYC SMS text
function extractKycCode(text: string): string | null {
  const m = String(text || "").match(/\b\d{4,8}\b/);
  return m ? m[0] : null;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  admin_data: any;
  reviewed_at: string | null;
  created_at: string;
}

interface TaskClient {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  image_url?: string | null;
  google_play_url?: string | null;
  apple_store_url?: string | null;
  category?: string | null;
  client?: TaskClient | null;
  logo_url?: string | null;
  images?: any;
  estimated_hours?: number | null;
  deadline_days?: number | null;
  compensation_amount?: number | null;
  steps?: any[] | null;
  updated_at?: string | null;
}

interface EmailForward {
  id: string;
  code_extracted: string | null;
  link_extracted: string | null;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
  created_at: string;
}

interface GeneratedEmail {
  id: string;
  full_address: string;
  submission_id: string | null;
  task_id: string | null;
}

interface ReceivedEmail {
  id: string;
  from_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  to_address: string;
  headers?: unknown;
  submission_id?: string | null;
  task_id?: string | null;
}

const unwrapRealtimeText = (value: unknown): string | null => {
  if (value && typeof value === "object") {
    const wrappedValue = value as { _type?: unknown; value?: unknown };
    if (wrappedValue._type === "String" && typeof wrappedValue.value === "string") {
      return wrappedValue.value;
    }
  }

  return typeof value === "string" ? value : null;
};

const normalizeReceivedEmail = (raw: any): ReceivedEmail => ({
  ...raw,
  body_text: unwrapRealtimeText(raw?.body_text),
  body_html: unwrapRealtimeText(raw?.body_html),
  subject: typeof raw?.subject === "string" ? raw.subject : raw?.subject ?? null,
});

const parseEmailHeaders = (headers: unknown): Record<string, unknown> => {
  if (!headers) return {};
  if (typeof headers === "string") {
    try {
      const parsed = JSON.parse(headers);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof headers === "object" ? (headers as Record<string, unknown>) : {};
};

const getHeaderStringArray = (headers: Record<string, unknown>, key: string): string[] => {
  const value = headers[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

const mergeReceivedEmails = (current: ReceivedEmail[], incoming: ReceivedEmail[]) => {
  const byId = new Map<string, ReceivedEmail>();

  [...incoming, ...current].forEach((email) => {
    if (!email?.id) return;
    byId.set(email.id, normalizeReceivedEmail(email));
  });

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
    .slice(0, 5);
};

const emailContainsCodeCandidate = (email: ReceivedEmail) => {
  const headers = parseEmailHeaders(email.headers);
  const headerCodes = getHeaderStringArray(headers, "codes_extracted");
  if (headerCodes.some((code) => /\b\d{4,8}\b/.test(code))) {
    return true;
  }

  const searchableText = [
    email.subject || "",
    email.body_text || "",
    email.body_html?.replace(/<[^>]*>/g, " ") || "",
  ].join(" ");

  return /\b\d{4,8}\b/.test(searchableText);
};

const TaskDemoData = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [submission, setSubmission] = useState<TaskSubmission | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [assignedPhone, setAssignedPhone] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoCompleteCountdown, setAutoCompleteCountdown] = useState<number | null>(null);
  const [taskSteps, setTaskSteps] = useState<any[]>([]);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [requestingKyc, setRequestingKyc] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [emailForwards, setEmailForwards] = useState<EmailForward[]>([]);
  const [assignedCustomEmail, setAssignedCustomEmail] = useState<GeneratedEmail | null>(null);
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  // Track when codes should be shown from (set based on submission creation or demo_data_requested_at)
  const [emailFilterTimestamp, setEmailFilterTimestamp] = useState<string | null>(null);
  // Track when codes were received and force re-render for relative time
  const [codeReceivedAt, setCodeReceivedAt] = useState<string | null>(null);
  const [, setTimeUpdateTick] = useState(0);
  // Signed URL for admin-uploaded image
  const [adminImageUrl, setAdminImageUrl] = useState<string | null>(null);
  const [adminImageUrls, setAdminImageUrls] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auto-expire codes after 5 minutes and update relative time display
  // Load banner images for header
  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    getBannerUrls(task as any).then((urls) => {
      if (!cancelled) setBannerUrls(urls);
    });
    return () => { cancelled = true; };
  }, [(task as any)?.id, (task as any)?.updated_at]);

  useEffect(() => {
    if (!codeReceivedAt) return;
    
    const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const receivedTime = new Date(codeReceivedAt).getTime();
    const expiryTime = receivedTime + CODE_EXPIRY_MS;
    const now = Date.now();
    
    // Helper to handle expiry - update filter timestamp to prevent re-fetching old emails
    const handleExpiry = () => {
      const nowIso = new Date().toISOString();
      setEmailFilterTimestamp(nowIso);
      setReceivedEmails([]);
      setCodeReceivedAt(null);
      toast.info("Code abgelaufen - warte auf neuen Code");
    };
    
    // If already expired, clear immediately
    if (now >= expiryTime) {
      const nowIso = new Date().toISOString();
      setEmailFilterTimestamp(nowIso);
      setReceivedEmails([]);
      setCodeReceivedAt(null);
      return;
    }
    
    // Update relative time every 10 seconds
    const tickInterval = setInterval(() => {
      setTimeUpdateTick(t => t + 1);
      
      // Check if expired
      if (Date.now() >= expiryTime) {
        handleExpiry();
      }
    }, 10000);
    
    // Also set a timeout for exact expiry
    const timeUntilExpiry = expiryTime - now;
    const expiryTimeout = setTimeout(() => {
      handleExpiry();
    }, timeUntilExpiry);
    
    return () => {
      clearInterval(tickInterval);
      clearTimeout(expiryTimeout);
    };
  }, [codeReceivedAt]);
  
  // Helper to format relative time
  const formatRelativeTime = (isoString: string): string => {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return `vor ${seconds} Sek`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `vor ${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    return `vor ${hours} Std`;
  };
  
  // Stabilize isKycFlow with useMemo to prevent recalculation
  const isKycFlow = useMemo(() => {
    return taskSteps.some((s) => s?.type === "checkbox");
  }, [taskSteps]);

  useEffect(() => {
    checkAuthAndFetchData();
    
    // Subscribe to realtime changes for task_submissions
    const submissionChannel = supabase
      .channel(`task_submission_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_submissions',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newSub = payload.new as TaskSubmission;
            setSubmission(newSub);
            
            // Re-resolve image URLs from updated admin_data
            const newAdminData = newSub.admin_data as any;
            const rawUrls = newAdminData?.image_urls && Array.isArray(newAdminData.image_urls) && newAdminData.image_urls.length > 0
              ? newAdminData.image_urls
              : newAdminData?.image_url ? [newAdminData.image_url] : [];
            const validUrls = rawUrls.filter((u: string) => u && (u.startsWith('http') || u.startsWith('data:')));
            if (validUrls.length > 0) {
              setAdminImageUrls(validUrls);
              setAdminImageUrl(validUrls[0]);
            }
            
            if (newSub.status === 'approved' && newSub.admin_data) {
              toast.success("Demo-Daten wurden bereitgestellt!");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(submissionChannel);
    };
  }, [taskId]);

  // Subscribe to realtime changes for ALL assigned email addresses
  useEffect(() => {
    // Collect all email addresses to subscribe to
    const adminData = submission?.admin_data as any;
    const emailAddresses = new Set<string>();
    
    // Add custom email from generated_emails
    if (assignedCustomEmail?.full_address) {
      emailAddresses.add(assignedCustomEmail.full_address);
    }
    
    // Add admin_data.email
    if (adminData?.email) {
      emailAddresses.add(adminData.email);
    }
    
    // Add admin_data.custom_email
    if (adminData?.custom_email) {
      emailAddresses.add(adminData.custom_email);
    }
    
    if (emailAddresses.size === 0) return;

    const addressArray = Array.from(emailAddresses);
    console.log("[Realtime] Subscribing to emails for:", addressArray);

    // Create channels for each email address
    const channels = addressArray.map(emailAddress => {
      return supabase
        .channel(`received_emails_${emailAddress}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'received_emails',
            filter: `to_address=eq.${emailAddress}`,
          },
          (payload) => {
            console.log("[Realtime] New email received at", emailAddress, ":", payload.new);
            const newEmail = normalizeReceivedEmail(payload.new as any);
            setReceivedEmails((current) => mergeReceivedEmails(current, [newEmail]));
            if (emailContainsCodeCandidate(newEmail)) {
              setCodeReceivedAt(newEmail.received_at || new Date().toISOString());
              toast.success("Neue E-Mail mit Code empfangen!");
            } else {
              toast.success("Neue E-Mail empfangen!");
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] Email subscription status for ${emailAddress}:`, status);
        });
    });

    return () => {
      console.log("[Realtime] Unsubscribing from emails for:", addressArray);
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [assignedCustomEmail?.full_address, submission?.admin_data]);

  // Auto-poll ALL assigned emails (custom_email + email in admin_data)
  // WICHTIG: receivedEmails.length statt receivedEmails in deps, um Endlosschleifen zu vermeiden
  const receivedEmailsCount = receivedEmails.length;
  const hasAnyReceivedEmails = receivedEmailsCount > 0;
  
  useEffect(() => {
    // Collect all email addresses to poll
    const adminData = submission?.admin_data as any;
    const emailAddresses = new Set<string>();
    
    // Add custom email from generated_emails
    if (assignedCustomEmail?.full_address) {
      emailAddresses.add(assignedCustomEmail.full_address);
    }
    
    // Add admin_data.email if different
    if (adminData?.email && !emailAddresses.has(adminData.email)) {
      emailAddresses.add(adminData.email);
    }
    
    // Add admin_data.custom_email if different
    if (adminData?.custom_email && !emailAddresses.has(adminData.custom_email)) {
      emailAddresses.add(adminData.custom_email);
    }
    
    if (emailAddresses.size === 0) return;
    if (!emailFilterTimestamp) return;

    // Check if we already have FRESH codes (less than 5 min old) - if so, don't poll
    const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const hasFreshCodes = receivedEmails.some(email => {
      if (!emailContainsCodeCandidate(email)) return false;

      const emailTime = new Date(email.received_at).getTime();
      const isFresh = (Date.now() - emailTime) < CODE_EXPIRY_MS;
      return isFresh;
    });

    if (hasFreshCodes) {
      console.log("[Email Poll] Already have fresh codes, skipping poll");
      return;
    }
    
    // When codes expire, update the filter timestamp to NOW so we don't re-fetch the same old email
    // Nur ausführen wenn wir tatsächlich E-Mails haben, die abgelaufen sind
    if (hasAnyReceivedEmails && !hasFreshCodes) {
      console.log("[Email Poll] Codes expired, updating filter timestamp to NOW and resuming poll");
      const nowIso = new Date().toISOString();
      setEmailFilterTimestamp(nowIso);
      setReceivedEmails([]);
      setCodeReceivedAt(null);
      // Don't poll in this render - wait for next render with updated timestamp
      return;
    }
    
    // Helper function to check if emails contain codes
    const checkCodesFromEmails = (emails: ReceivedEmail[]) => {
      for (const email of emails) {
        if (emailContainsCodeCandidate(email)) return true;
      }
      return false;
    };

    const pollEmails = async () => {
      const addressArray = Array.from(emailAddresses);
      console.log("[Email Poll] Checking for new emails at:", addressArray, "since:", emailFilterTimestamp);
      
      try {
        for (const emailAddress of addressArray) {
          const isOutlook = emailAddress.toLowerCase().includes('outlook') || 
                           emailAddress.toLowerCase().includes('hotmail') ||
                           emailAddress.toLowerCase().includes('live.com');
          if (isOutlook) {
            console.log("[Email Poll] Triggering Outlook sync for:", emailAddress);
            try {
              await supabase.functions.invoke('sync-outlook-emails', {
                body: { email_address: emailAddress }
              });
            } catch (syncErr) {
              console.error("[Email Poll] Outlook sync error:", syncErr);
            }
          }
        }

        if (!submission?.id || !taskId) return;

        const { data, error } = await supabase.functions.invoke('get-task-received-emails', {
          body: {
            task_id: taskId,
            submission_id: submission.id,
            email_addresses: addressArray,
            since_timestamp: emailFilterTimestamp,
            limit: 5,
          }
        });

        if (error) {
          console.error("[Email Poll] Backend email fetch error:", error);
          return;
        }

        const emails = Array.isArray(data?.emails) ? data.emails : [];
        if (emails.length > 0) {
          const normalizedEmails = emails.map(normalizeReceivedEmail);
          setReceivedEmails((current) => {
            const mergedEmails = mergeReceivedEmails(current, normalizedEmails);
            const freshestCodeEmail = mergedEmails.find(emailContainsCodeCandidate) ?? mergedEmails[0];
            if (freshestCodeEmail?.received_at) {
              setCodeReceivedAt(freshestCodeEmail.received_at);
            }
            return mergedEmails;
          });

          if (normalizedEmails.some(emailContainsCodeCandidate)) {
            toast.success("E-Mail-Code empfangen!");
          }
        }
      } catch (err) {
        console.error("[Email Poll] Error:", err);
      }
    };

    // Poll immediately then every 5 seconds
    pollEmails();
    const intervalId = setInterval(pollEmails, 5000);
    
    return () => clearInterval(intervalId);
  }, [assignedCustomEmail?.full_address, submission?.admin_data, emailFilterTimestamp, hasAnyReceivedEmails]);


// Auto-fetch SMS when phone is assigned and no SMS code exists yet
// WICHTIG: Nur relevante submission-Felder in Dependencies verwenden, um häufige Neustarts zu vermeiden
const submissionId = submission?.id;
const submissionStatus = submission?.status;
const submissionAdminData = submission?.admin_data;
const submissionCreatedAt = submission?.created_at;

useEffect(() => {
  const adminData = submissionAdminData as any;
  const smsCodeReceivedAt = adminData?.sms_code_received_at;
  const isSmsCodeFresh = smsCodeReceivedAt 
    ? (Date.now() - new Date(smsCodeReceivedAt).getTime()) < 5 * 60 * 1000 
    : false;
  const smsCode = isSmsCodeFresh ? adminData?.sms_code : null;
  
  // Helper to check truthy non-empty values
  const checkValue = (val: any) => val && typeof val === 'string' ? val.trim().length > 0 : Boolean(val);
  
  const hasIdentCodesArr = Array.isArray(adminData?.ident_codes) && (adminData.ident_codes as any[]).some((c) => typeof c === 'string' && c.trim().length > 0);
  const hasActualDemoData = Boolean(
    checkValue(adminData?.email) || 
    checkValue(adminData?.password) || 
    checkValue(adminData?.ident_code) || 
    hasIdentCodesArr ||
    checkValue(adminData?.ident_link) || 
    checkValue(adminData?.image_url) || 
    checkValue(adminData?.passcode) ||
    checkValue(adminData?.sms_code)
  );
  
  const isInProgress = submissionStatus === "in_progress";
  
  if (!checkValue(assignedPhone) || smsCode || !hasActualDemoData || !isInProgress) {
    return;
  }
  
  // Define inline SMS fetch to avoid forward reference
  const fetchSms = async () => {
    try {
      if (!assignedPhone || !submissionId) {
        console.log("[SMS Poll] No phone or submission, skipping");
        return;
      }

      console.log("[SMS Poll] Fetching SMS for phone:", assignedPhone);

      const { data: phoneData, error: phoneError } = await supabase
        .from('phone_numbers')
        .select('notes')
        .eq('phone_number', assignedPhone)
        .single();

      if (phoneError || !phoneData?.notes) {
        console.log("[SMS Poll] No phone data found in DB for:", assignedPhone, phoneError);
        return;
      }

      const bookingIdMatch = phoneData.notes.match(/Booking ID: (\d+)/);
      if (!bookingIdMatch) {
        console.log("[SMS Poll] No Booking ID in notes:", phoneData.notes);
        return;
      }

      const orderbookingId = bookingIdMatch[1];
      console.log("[SMS Poll] Using Booking ID:", orderbookingId);

      // Use emailFilterTimestamp for filtering out old SMS
      const sinceTs = emailFilterTimestamp || submissionCreatedAt || new Date().toISOString();
      console.log("[SMS Poll] Filtering SMS since:", sinceTs);

      const { data: smsData, error: smsError } = await supabase.functions.invoke('anosim-api', {
        body: { action: 'getSms', data: { orderbookingId } }
      });

      if (smsError) {
        console.error("[SMS Poll] API Error:", smsError);
        return;
      }
      
      if (!smsData?.success) {
        console.log("[SMS Poll] API returned failure:", smsData);
        return;
      }

      const smsMessages = smsData.data;
      console.log("[SMS Poll] Received SMS messages:", smsMessages?.length || 0, smsMessages);

      if (smsMessages && smsMessages.length > 0) {
        // Sort by date descending to get newest first
        const sortedMessages = [...smsMessages].sort((a: any, b: any) => {
          const dateA = a.messageDate || a.received_at || a.created_at || '';
          const dateB = b.messageDate || b.received_at || b.created_at || '';
          return dateB.localeCompare(dateA);
        });

        // Find the newest SMS that is BOTH after task start AND looks like a real KYC code
        // (sender whitelist + promo blocklist + keyword/code validation).
        // This prevents promotional SMS (Zasta, Kleinanzeigen ads, etc.) from
        // being misinterpreted as a verification code and auto-completing KYC.
        let latestFresh: any = null;
        let lastSkipReason = "no messages evaluated";
        for (const sms of sortedMessages) {
          const check = isLikelyKycSms(sms, sinceTs);
          if (check.ok) {
            latestFresh = sms;
            break;
          }
          lastSkipReason = check.reason;
          console.log("[SMS Poll] Skipping SMS:", {
            sender: sms?.messageSender,
            ts: sms?.messageDate,
            reason: check.reason,
            preview: String(sms?.messageText || "").slice(0, 60),
          });
        }

        if (!latestFresh) {
          console.log("[SMS Poll] No legitimate KYC SMS found. Last reason:", lastSkipReason);
          return;
        }

        const fullText = latestFresh.messageText || latestFresh.text || latestFresh.code || latestFresh.message || '';
        const digitsOnly = extractKycCode(fullText) || '';
        // Use the moment we detected the SMS in our system (not anosim's messageDate)
        // so that anosim's 2-4 min delivery delay does not eat into our freshness window.
        const receivedAt = new Date().toISOString();
        const smsOriginalDate = latestFresh.messageDate || receivedAt;

        // Avoid re-saving the exact same code
        if (digitsOnly && digitsOnly === adminData?.sms_code) {
          console.log("[SMS Poll] Code unchanged, skipping update");
          return;
        }

        console.log("[SMS Poll] Found fresh KYC SMS:", { sender: latestFresh.messageSender, fullText, digitsOnly, receivedAt });

        if (digitsOnly) {
          await supabase.from('task_submissions').update({
            admin_data: {
              ...adminData,
              sms_code: digitsOnly,
              sms_full_text: fullText,
              sms_code_received_at: receivedAt,
            }
          }).eq('id', submissionId);

          await supabase.from('sms_forwards').insert({
            submission_id: submissionId,
            phone_number: assignedPhone,
            verification_code: digitsOnly,
            status: 'received',
            anosim_response: latestFresh
          });

          toast.success("SMS-Code empfangen!");
        }
      } else {
        console.log("[SMS Poll] No SMS messages from Anosim API");
      }
    } catch (error) {
      console.error("[SMS Poll] Error:", error);
    }
  };

  const intervalId = setInterval(fetchSms, 10000);
  fetchSms(); // Fetch immediately

  return () => clearInterval(intervalId);
}, [assignedPhone, submissionId, submissionStatus, submissionAdminData, submissionCreatedAt, emailFilterTimestamp]);

  const checkAuthAndFetchData = async () => {
    // Always start with a clean slate for codes/links when entering the page
    setReceivedEmails([]);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const redirect = `${location.pathname}${location.search}${location.hash}`;
      try {
        sessionStorage.setItem("postLoginRedirect", redirect);
      } catch {
        // ignore
      }
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    if (!taskId) {
      navigate("/dashboard/tasks");
      return;
    }

    // Fetch task with client branding
    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select(`
        id, title, description, image_url, google_play_url, apple_store_url, steps,
        primary_color, secondary_color, accent_color, logo_url, images, category,
        estimated_hours, deadline_days, compensation_amount, updated_at,
        client:clients(id, name, logo_url, primary_color, secondary_color, accent_color)
      `)
      .eq("id", taskId)
      .eq("assigned_to", session.user.id)
      .single();

    if (taskError || !taskData) {
      toast.error("Auftrag nicht gefunden");
      navigate("/dashboard/tasks");
      return;
    }

    setTask(taskData as any);
    setTaskSteps(Array.isArray(taskData.steps) ? taskData.steps : []);

    // Module-basierte Navigation - SOFORT prüfen und weiterleiten
    const hasCheckbox = (Array.isArray(taskData.steps) ? taskData.steps : []).some((s: any) => s?.type === "checkbox");
    const hasUpload = (Array.isArray(taskData.steps) ? taskData.steps : []).some((s: any) => s?.type === "file");
    
    // Nur wenn KEIN KYC (Checkbox) vorhanden ist, weiterleiten
    if (!hasCheckbox) {
      // WICHTIG: setLoading(false) erst NACH dem navigate() oder gar nicht setzen,
      // da navigate() synchron ist und die Komponente danach unmountet wird.
      // Das Setzen von loading=false vor navigate kann zu einem kurzen "flash" führen.
      if (hasUpload) {
        // Wenn Upload OHNE Checkbox -> zum Postalprotokoll
        navigate(`/dashboard/tasks/${taskId}/postal-documents-check`, { replace: true });
        return;
      }
      
      // Wenn nur Text (kein Checkbox, kein Upload) -> zur Qualitätsprüfung
      navigate(`/dashboard/tasks/${taskId}/quality-check`, { replace: true });
      return;
    }

    // Fetch submission
    const { data: submissionData, error: submissionError } = await supabase
      .from("task_submissions")
      .select("*")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!submissionError && submissionData) {
      setSubmission(submissionData);
      // Telefonnummer nur anzeigen, wenn vom Admin explizit bereitgestellt
      // Prüfe beide Varianten: 'phone' und 'assigned_phone' (legacy)
      const adminData = submissionData?.admin_data as any;
      setAssignedPhone(adminData?.phone || adminData?.assigned_phone || null);

      // Generate signed URLs for admin-uploaded images (support both legacy and new array)
      const rawImageUrls = adminData?.image_urls && Array.isArray(adminData.image_urls) && adminData.image_urls.length > 0
        ? adminData.image_urls
        : adminData?.image_url ? [adminData.image_url] : [];
      
      const resolvedUrls: string[] = [];
      for (const imagePath of rawImageUrls) {
        if (!imagePath || typeof imagePath !== 'string') continue;
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
          resolvedUrls.push(imagePath);
        } else {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("kyc-uploads")
            .createSignedUrl(imagePath, 60 * 60);
          if (!signedError && signedData?.signedUrl) {
            resolvedUrls.push(signedData.signedUrl);
          } else {
            const { data: fallbackData, error: fallbackError } = await supabase.storage
              .from("task-files")
              .createSignedUrl(imagePath, 60 * 60);
            if (!fallbackError && fallbackData?.signedUrl) {
              resolvedUrls.push(fallbackData.signedUrl);
            }
          }
        }
      }
      setAdminImageUrls(resolvedUrls);
      setAdminImageUrl(resolvedUrls[0] || null);

      // Set email filter timestamp based on demo_data_requested_at or submission creation/update
      // Priority: demo_data_requested_at > submission.updated_at (when admin_data has email) > submission.created_at
      const demoDataRequestedAt = adminData?.demo_data_requested_at;
      const hasAdminEmail = Boolean(adminData?.email);
      let filterTs = demoDataRequestedAt;
      
      if (!filterTs && hasAdminEmail) {
        // If demo data was assigned but no timestamp, use submission updated_at
        filterTs = submissionData.updated_at;
      }
      if (!filterTs) {
        // Fallback to submission creation time
        filterTs = submissionData.created_at;
      }
      
      console.log("[Email Filter] Using timestamp:", filterTs, "demo_data_requested_at:", demoDataRequestedAt);
      setEmailFilterTimestamp(filterTs);

      // E-Mail-Weiterleitungen laden wenn aktiviert
      if (adminData?.email_forwarding_enabled && submissionData.id) {
        const { data: emailData } = await supabase
          .from("email_forwards")
          .select("id, code_extracted, link_extracted, subject, sender, received_at, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        
        if (emailData) {
          setEmailForwards(emailData);
        }
      }

      // Custom-/Task-E-Mail laden (aus generated_emails oder admin_data.email)
      const { data: generatedEmailData } = await supabase
        .from("generated_emails")
        .select("id, full_address, submission_id, task_id")
        .or(`submission_id.eq.${submissionData.id},and(task_id.eq.${taskId},submission_id.is.null),full_address.eq.${adminData?.email || 'none'}`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (generatedEmailData) {
        setAssignedCustomEmail(generatedEmailData);
      } else if (adminData?.email) {
        console.log("[Email] Using admin_data.email directly:", adminData.email);
        setAssignedCustomEmail({ 
          id: 'admin-email', 
          full_address: adminData.email, 
          submission_id: submissionData.id, 
          task_id: taskId 
        } as GeneratedEmail);
      } else {
        const { data: userGeneratedEmailData } = await supabase
          .from("generated_emails")
          .select("id, full_address, submission_id, task_id")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setAssignedCustomEmail(userGeneratedEmailData || null);
      }

      // Keine alten E-Mails für adminData.email laden
      // E-Mails werden nur live via Realtime oder manuellen Refresh geholt

      // Korrekte Weiterleitung basierend auf tatsächlichem Fortschritt
      const status = submissionData?.status;
      const qualityCheckCompleted = !!adminData?.quality_check_completed_at;
      const postalDocsCompleted = adminData?.postal_documents_completed;

      // Bei vollständig abgeschlossenem Task zur Task-Liste
      if (status === "completed") {
        navigate("/dashboard/tasks", { replace: true });
        return;
      }

      // Bei awaiting_review zur Submitted-Seite
      if (status === "awaiting_review") {
        navigate(`/dashboard/tasks/${taskId}/submitted`, { replace: true });
        return;
      }

      // Bei KYC abgeschlossen: zuerst Qualitätsprüfung (Fragebogen), der Produkttest folgt danach.
      if (status === "kyc_completed" || adminData?.kyc_completed) {


        if (!qualityCheckCompleted) {
          toast.info("KYC bereits abgeschlossen. Weiter zur Qualitätsprüfung.");
          navigate(`/dashboard/tasks/${taskId}/quality-check`, { replace: true });
          return;
        } else if (hasUpload && !postalDocsCompleted) {
          toast.info("Qualitätsprüfung abgeschlossen. Weiter zum Postversand.");
          navigate(`/dashboard/tasks/${taskId}/postal-documents-check`, { replace: true });
          return;
        } else if (hasUpload && postalDocsCompleted) {
          navigate(`/dashboard/tasks/${taskId}?section=uploads`, { replace: true });
          return;
        }
      }
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  // Decode Quoted-Printable encoded content
  const decodeQuotedPrintable = (input: string): string => {
    if (!input) return "";
    return input
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  };

  // Check if content appears to be Quoted-Printable encoded
  const isQuotedPrintable = (content: string): boolean => {
    if (!content) return false;
    return /=3D|=20|=\r?\n|=[0-9A-Fa-f]{2}/i.test(content);
  };

  // Extract codes and links from email content
  const extractCodesAndLinks = (emails: ReceivedEmail[]) => {
    const results: { codes: string[], links: string[] } = { codes: [], links: [] };
    
    // Filter out year-like numbers (2020-2030), placeholders (000000) and other common false positives
    const isValidCode = (code: string): boolean => {
      const num = parseInt(code, 10);
      if (num >= 2020 && num <= 2030) return false;
      if (code.length === 8 && code.startsWith('202')) return false;
      if (/^(\d)\1+$/.test(code)) return false;
      return true;
    };
    
    const scoreCode = (code: string, context: string): number => {
      let score = 0;
      const lowerContext = context.toLowerCase();
      
      if (code.length >= 5 && code.length <= 6) score += 20;
      if (/\bverifizierungscode\b|\bverification code\b|\bone-time code\b|\bsecurity code\b|\bpasscode\b|\blogin code\b|\banmeldecode\b/i.test(lowerContext)) score += 40;
      
      const codeIndex = lowerContext.indexOf(code.toLowerCase());
      if (codeIndex >= 0) {
        const nearbyText = lowerContext.slice(Math.max(0, codeIndex - 140), codeIndex + code.length + 120);
        if (/code|код|passcode|verifizierung|verification|bestätigung|confirm|dein code|your code|lautet|anmeldung|anmeldecode|sicherheitscode|einmalcode|otp/i.test(nearbyText)) {
          score += 50;
        }
      }
      
      return score;
    };
    
    const allCodes: { code: string; score: number }[] = [];
    const allLinkCandidates: { link: string; score: number }[] = [];

    const decodeHtmlEntities = (value: string) => value
      .replace(/&amp;/gi, '&')
      .replace(/&#x3d;|&#61;/gi, '=')
      .replace(/&#x26;|&#38;/gi, '&');

    const decodeLinkIdPayload = (value: string): string[] => {
      const results: string[] = [];
      const encodedPayload = value.split('__')[0];
      if (!encodedPayload) return results;

      try {
        const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = atob(normalized + padding);
        results.push(decoded);

        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object' && typeof parsed.href === 'string') {
          results.push(parsed.href);
        }
      } catch {
        return results;
      }

      return results;
    };

    const getHrefVariants = (href: string) => {
      const variants = new Set<string>();

      const addVariant = (value: string) => {
        if (!value) return;
        const trimmed = value.trim();
        if (!trimmed) return;
        variants.add(trimmed);

        try {
          const decoded = decodeURIComponent(trimmed);
          if (decoded && decoded !== trimmed) {
            variants.add(decoded);
          }
        } catch {
          // ignore malformed url encoding
        }
      };

      addVariant(href);
      addVariant(decodeHtmlEntities(href));

      for (const variant of Array.from(variants)) {
        try {
          const url = new URL(variant);
          const linkId = url.searchParams.get('link_id');
          if (linkId) {
            decodeLinkIdPayload(linkId).forEach(addVariant);
          }
        } catch {
          // ignore invalid urls
        }
      }

      return Array.from(variants);
    };

    const getPreferredHrefVariant = (href: string) => {
      const httpVariants = getHrefVariants(href).filter((variant) => /^https?:\/\//i.test(variant));
      if (httpVariants.length === 0) return href;

      const rankedVariants = httpVariants.map((variant) => {
        const lowerVariant = variant.toLowerCase();
        let score = 0;

        if (/app\.youhodler\.com\/new-device/i.test(lowerVariant)) score += 260;
        if (/action=true/i.test(lowerVariant)) score += 1000;
        if (/action=false/i.test(lowerVariant)) score -= 1200;
        if (/link_id=/i.test(lowerVariant)) score -= 140;
        if (/%ef%bf%bd|�|`/.test(variant)) score -= 320;

        try {
          const parsedUrl = new URL(variant);
          const action = parsedUrl.searchParams.get('action');
          const operationId = parsedUrl.searchParams.get('operationId');

          if (action === 'true') score += 300;
          if (action === 'false') score -= 600;
          if (operationId && /^[0-9a-f-]{12,}$/i.test(operationId)) score += 40;
        } catch {
          score -= 200;
        }

        return { link: variant, score };
      });

      rankedVariants.sort((a, b) => b.score - a.score);
      return rankedVariants[0]?.link ?? href;
    };

    const normalizeLinkContext = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const getAnchorContainerContext = (anchor: HTMLAnchorElement) => {
      const contextParts = new Set<string>();
      let current: HTMLElement | null = anchor;
      let depth = 0;

      while (current && depth < 4) {
        const text = normalizeLinkContext(current.textContent || '');
        const aria = normalizeLinkContext(current.getAttribute('aria-label') || '');
        const title = normalizeLinkContext(current.getAttribute('title') || '');
        const className = normalizeLinkContext(current.getAttribute('class') || '');

        if (text && text.length <= 180) contextParts.add(text);
        if (aria) contextParts.add(aria);
        if (title) contextParts.add(title);
        if (className) contextParts.add(className);

        current = current.parentElement;
        depth += 1;
      }

      return Array.from(contextParts).join(' | ');
    };
    
    emails.forEach(email => {
      const emailHeaders = parseEmailHeaders(email.headers);

      let rawHtml = email.body_html || '';
      let plainText = email.body_text || '';
      const subject = email.subject || '';
      
      if (isQuotedPrintable(rawHtml)) {
        rawHtml = decodeQuotedPrintable(rawHtml);
      }
      if (isQuotedPrintable(plainText)) {
        plainText = decodeQuotedPrintable(plainText);
      }
      
      if (!plainText && rawHtml) {
        plainText = rawHtml.replace(/<[^>]*>/g, ' ');
      }

      const codeSources = [
        ...getHeaderStringArray(emailHeaders, 'codes_extracted'),
        ...((subject.match(/\b\d{4,8}\b/g) || [])),
        ...((plainText.match(/\b\d{4,8}\b/g) || [])),
      ];

      codeSources.forEach((code) => {
        if (!isValidCode(code)) return;
        if (allCodes.some((c) => c.code === code)) return;

        const context = [subject, plainText, rawHtml.replace(/<[^>]*>/g, ' ')].join(' ');
        const score = scoreCode(code, context) + (getHeaderStringArray(emailHeaders, 'codes_extracted').includes(code) ? 80 : 0) + (subject.includes(code) ? 35 : 0);
        if (score >= 30) {
          allCodes.push({ code, score });
        }
      });
       
      const allLinks: { link: string; score: number }[] = [];
      
      const excludePatterns = [
        'unsubscribe', 'privacy', 'terms', 'impressum', 'datenschutz',
        'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com', 
        'mailto:', 'tel:', '.png', '.jpg', '.gif', '.svg', '.css', '.js',
        'adobe.io', 'aka.ms', 'outlook', 'braze-images', 's3.amazonaws.com',
        'doubleclick', 'googleadservices', 'mailchimp.com', 'sendgrid',
        '/blog', '/exchange', '/support', '/help', '/faq',
        'w3.org', '.dtd', 'xmlns'
      ];

      const normalize = normalizeLinkContext;

      const scoreLink = (href: string, context: string): number => {
        const hrefVariants = getHrefVariants(href);
        const hrefSignals = hrefVariants.join(' | ').toLowerCase();
        const ctx = normalize(context);
        let score = 10;
        const isNegativeAllowPhrase = /(nicht\s+zulassen|do\s*not\s+allow|don't\s+allow|not\s+allow|disallow|not\s+approve|nicht\s+genehmigen)/i.test(ctx);

        if (/(verify|verifiz|bestätig|confirm)/i.test(ctx)) score += 200;
        if (/(activate|aktivier)/i.test(ctx)) score += 160;
        if (/(create\s+an\s+account|create\s+account)/i.test(ctx)) score += 140;
        if (/(sign\s*up|signup|register|registrier)/i.test(ctx)) score += 130;
        if (/(login|log\s*in)/i.test(ctx)) score += 30;
        if (/(button|btn|cta)/i.test(ctx)) score += 25;
        if (hrefSignals.startsWith('https://')) score += 10;

        if (/url\d*\.crypto\.com\/ls\/click/i.test(hrefSignals)) {
          score += 250;
        } else if (/\/ls\/click\?|utm_|mc_eid|mkt_tok/i.test(hrefSignals)) {
          score -= 5;
        }
        
        if (/play\.google\.com|apps\.apple\.com|itunes\.apple\.com/i.test(hrefSignals)) score -= 100;

        // Prefer "allow/approve" links over "decline/reject" links (e.g. YouHodler device confirmation)
        if (/action=true/i.test(hrefSignals)) score += 300;
        if (/action=false/i.test(hrefSignals)) score -= 500;
        if (isNegativeAllowPhrase) score -= 550;
        if (/(allow|zulassen|approve|genehmigen|erlauben)/i.test(ctx) && !isNegativeAllowPhrase) score += 150;
        if (/(ablehnen|decline|reject|deny|block)/i.test(ctx)) score -= 400;

        return score;
      };

      const addCandidate = (href: string, ctx: string) => {
        if (!href || !href.startsWith('http')) return;
        const preferredHref = getPreferredHrefVariant(href);
        const lowerHref = preferredHref.toLowerCase();
        if (excludePatterns.some(p => lowerHref.includes(p))) return;
        const score = scoreLink(href, ctx);
        if (score > 0) allLinks.push({ link: preferredHref, score });
      };

      const headersLinks = getHeaderStringArray(emailHeaders, 'links_extracted');
      if (headersLinks.length > 0) {
        for (const l of headersLinks) {
          addCandidate(l, 'headers.links_extracted');
        }
      }

      try {
        const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const text = normalize(a.textContent || '');
          const aria = normalize(a.getAttribute('aria-label') || '');
          const title = normalize(a.getAttribute('title') || '');
          const parentClass = normalize((a.parentElement?.getAttribute('class') || ''));
          const containerCtx = getAnchorContainerContext(a);
          const combinedCtx = [text, aria, title, parentClass, containerCtx].filter(Boolean).join(' | ');
          addCandidate(href, combinedCtx);
        }
      } catch {
        const hrefRegex = /href=["']([^"']+)["']/gi;
        let hrefMatch;
        while ((hrefMatch = hrefRegex.exec(rawHtml)) !== null) {
          const link = hrefMatch[1];
          const linkIndex = rawHtml.indexOf(link);
          const surroundingText = rawHtml.substring(Math.max(0, linkIndex - 250), linkIndex + link.length + 250);
          addCandidate(link, surroundingText);
        }
      }

      allLinkCandidates.push(...allLinks);
    });
    
    allCodes.sort((a, b) => b.score - a.score);
    results.codes = allCodes.length > 0 ? [allCodes[0].code] : [];
    allLinkCandidates.sort((a, b) => b.score - a.score);
    results.links = allLinkCandidates.length > 0 ? [allLinkCandidates[0].link] : [];
    
    return results;
  };

  // Fetch task emails via backend so employees can also see codes from assigned task mailboxes
  const fetchReceivedEmailsForAddress = async (emailAddress: string, sinceTimestamp?: string) => {
    setLoadingEmails(true);
    try {
      const isOutlookEmail = emailAddress.toLowerCase().includes('outlook') || 
                             emailAddress.toLowerCase().includes('hotmail') ||
                             emailAddress.toLowerCase().includes('live.com');
      
      if (isOutlookEmail) {
        console.log("[Outlook Sync] Triggering email sync for:", emailAddress);
        try {
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-outlook-emails', {
            body: { email_address: emailAddress }
          });
          
          if (syncError) {
            console.error("[Outlook Sync] Error:", syncError);
          } else {
            console.log("[Outlook Sync] Result:", syncResult);
          }
        } catch (syncErr) {
          console.error("[Outlook Sync] Failed:", syncErr);
        }
      }

      if (!submission?.id || !taskId) return;

      const { data, error } = await supabase.functions.invoke('get-task-received-emails', {
        body: {
          task_id: taskId,
          submission_id: submission.id,
          email_addresses: [emailAddress],
          since_timestamp: sinceTimestamp,
          limit: 5,
        }
      });

      if (error) {
        console.error("Error fetching received emails via backend:", error);
      } else {
        const emails = Array.isArray(data?.emails) ? data.emails : [];
        if (emails.length > 0) {
          const normalizedEmails = emails.map(normalizeReceivedEmail);
          const mergedEmails = mergeReceivedEmails([], normalizedEmails);
          setReceivedEmails(mergedEmails);

          const freshestCodeEmail = mergedEmails.find(emailContainsCodeCandidate) ?? mergedEmails[0];
          if (freshestCodeEmail?.received_at) {
            setCodeReceivedAt(freshestCodeEmail.received_at);
          }
        }
      }
    } catch (err) {
      console.error("Error in fetchReceivedEmailsForAddress:", err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchSmsFromAnosim = async () => {
    try {
      if (!assignedPhone || !submission?.id) {
        console.log("[DEBUG] No phone or submission to fetch SMS for");
        return;
      }

      // Get phone details to extract booking ID
      const { data: phoneData, error: phoneError } = await supabase
        .from('phone_numbers')
        .select('notes')
        .eq('phone_number', assignedPhone)
        .single();

      if (phoneError || !phoneData?.notes) {
        console.log("[DEBUG] Could not get phone data or notes:", phoneError);
        return;
      }

      // Extract booking ID from notes (format: "Order ID: 6768592, Booking ID: 6870843, ...")
      const bookingIdMatch = phoneData.notes.match(/Booking ID: (\d+)/);
      if (!bookingIdMatch) {
        console.log("[DEBUG] Could not extract booking ID from notes:", phoneData.notes);
        return;
      }

      const orderbookingId = bookingIdMatch[1];
      console.log("[DEBUG] Fetching SMS for booking ID:", orderbookingId);

      // Use emailFilterTimestamp for filtering out old SMS
      const sinceTs = emailFilterTimestamp || submission?.created_at || new Date().toISOString();

      // Call anosim-api backend function to get SMS
      const { data: smsData, error: smsError } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'getSms',
          data: { orderbookingId }
        }
      });

      if (smsError || !smsData?.success) {
        console.error("[DEBUG] Error fetching SMS:", smsError || smsData?.error);
        return;
      }

      const smsMessages = smsData.data;
      console.log("[DEBUG] SMS messages received:", smsMessages);

      if (smsMessages && smsMessages.length > 0) {
        // Sort newest first, then accept only legitimate KYC SMS
        // (filters promotional senders + requires sender whitelist or KYC keyword + numeric code)
        const sortedMessages = [...smsMessages].sort((a: any, b: any) => {
          const dateA = a.messageDate || a.received_at || a.created_at || '';
          const dateB = b.messageDate || b.received_at || b.created_at || '';
          return dateB.localeCompare(dateA);
        });

        let latestFresh: any = null;
        for (const sms of sortedMessages) {
          const check = isLikelyKycSms(sms, sinceTs);
          if (check.ok) { latestFresh = sms; break; }
          console.log("[DEBUG] Skipping SMS:", { sender: sms?.messageSender, reason: check.reason });
        }

        if (!latestFresh) {
          console.log("[DEBUG] No legitimate KYC SMS found since:", sinceTs);
          return;
        }

        const fullText = latestFresh.messageText || latestFresh.text || latestFresh.code || latestFresh.message || '';
        const digitsOnly = extractKycCode(fullText) || '';
        // Use detection time, not anosim's messageDate (which can be 2-4 min stale)
        const receivedAt = new Date().toISOString();

        if (digitsOnly) {
          // Update submission with SMS code
          const { error: updateError } = await supabase
            .from('task_submissions')
            .update({
              admin_data: {
                ...submission.admin_data,
                sms_code: digitsOnly,
                sms_full_text: fullText,
                sms_code_received_at: receivedAt,
              }
            })
            .eq('id', submission.id);

          if (updateError) {
            console.error("[DEBUG] Error updating submission with SMS:", updateError);
          }

          // Log to sms_forwards table
          const { error: logError } = await supabase
            .from('sms_forwards')
            .insert({
              submission_id: submission.id,
              phone_number: assignedPhone,
              verification_code: digitsOnly,
              status: 'received',
              anosim_response: latestFresh
            });

          if (logError) {
            console.error("[DEBUG] Error logging SMS forward:", logError);
          }

          toast.success("SMS-Code empfangen!");
          await checkAuthAndFetchData();
        }
      } else {
        console.log("[DEBUG] No SMS messages found yet");
      }
    } catch (error) {
      console.error("[DEBUG] Error in fetchSmsFromAnosim:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSmsFromAnosim();
    await checkAuthAndFetchData();
    setRefreshing(false);
    toast.success("Daten aktualisiert");
  };

  const handleRequestKyc = async () => {
    console.log("[DEBUG] handleRequestKyc called");
    
    // Prüfe ob Zustimmung gegeben wurde
    if (!consentChecked) {
      toast.error("Bitte stimmen Sie zu, um fortzufahren");
      return;
    }
    
    // Für Nicht-KYC Flows nicht anforderbar: direkt zum Postalprotokoll leiten
    if (!isKycFlow) {
      console.log("[DEBUG] Not a KYC flow, redirecting to postal documents");
      navigate(`/dashboard/tasks/${taskId}/postal-documents-check`);
      return;
    }
    setRequestingKyc(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !taskId) { 
      console.log("[DEBUG] No session or taskId");
      setRequestingKyc(false); 
      return; 
    }

    console.log("[DEBUG] Checking for existing submission");
    // Prüfe, ob bereits eine Submission existiert
    const { data: existing, error: fetchErr } = await supabase
      .from("task_submissions")
      .select("id")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let error = null as any;
    let submissionId = existing?.id;
    
    if (existing?.id) {
      console.log("[DEBUG] Updating existing submission:", existing.id);
      // Keep existing admin_data if present, otherwise set to null
      const { data: currentSubmission } = await supabase
        .from("task_submissions")
        .select("admin_data")
        .eq("id", existing.id)
        .single();
      
      const { error: updErr } = await supabase
        .from("task_submissions")
        .update({ 
          status: "pending",
          admin_data: currentSubmission?.admin_data || null  // Keep existing demo data
        })
        .eq("id", existing.id);
      error = updErr;
    } else {
      console.log("[DEBUG] Creating new submission");
      const { data: newSubmission, error: insErr } = await supabase
        .from("task_submissions")
        .insert({
          task_id: taskId,
          employee_id: session.user.id,
          status: "pending",
        } as any)
        .select()
        .single();
      error = insErr;
      submissionId = newSubmission?.id;
    }

    setRequestingKyc(false);
    if (fetchErr || error) {
      console.error("[DEBUG] Error requesting KYC:", fetchErr || error);
      toast.error("KYC-Anfrage fehlgeschlagen");
      return;
    }

    // Fetch updated submission to get current admin_data
    const { data: updatedSubmission, error: fetchUpdatedErr } = await supabase
      .from("task_submissions")
      .select("*")
      .eq("id", submissionId!)
      .single();

    if (fetchUpdatedErr || !updatedSubmission) {
      console.error("[DEBUG] Error fetching updated submission:", fetchUpdatedErr);
      toast.error("Fehler beim Laden der Demo-Daten");
      return;
    }

    // Update local state with actual data from DB
    setSubmission(updatedSubmission);

    console.log("[DEBUG] KYC request successful, admin_data preserved:", updatedSubmission.admin_data);
    toast.success("Demo-Daten wurden erfolgreich angefordert!");
  };
  // Auto-complete for Bankdrop tasks: when SMS code arrives, complete after 5 minutes
  const submissionAdminDataForAutoComplete = submission?.admin_data as any;
  const smsCodeForAutoComplete = submissionAdminDataForAutoComplete?.sms_code;
  const smsCodeReceivedAtForAutoComplete = submissionAdminDataForAutoComplete?.sms_code_received_at;
  // Bankdrop-Erkennung: Kategorie 'bankdrop'/'banking', Bank-Titel-Keyword,
  // ODER eine zugewiesene Rufnummer im Profil (alle Bank-Aufträge nutzen SMS-TAN-Auto-Complete).
  const taskCategoryLc = (task?.category || '').toLowerCase();
  const taskTitleLc = (task?.title || '').toLowerCase();
  const BANK_KEYWORDS = ['bank', 'sparkasse', 'volksbank', 'commerzbank', 'deutsche bank', 'ing', 'dkb', 'comdirect', 'postbank', 'targobank', 'n26', 'consorsbank', 'hypovereins', 'santander', 'revolut', 'tomorrow', 'c24'];
  const titleMatchesBank = BANK_KEYWORDS.some(k => taskTitleLc.includes(k));
  const isBankdrop = taskCategoryLc === 'bankdrop' || taskCategoryLc === 'banking' || titleMatchesBank || Boolean(assignedPhone);
  const isInProgressForAutoComplete = submission?.status === 'in_progress';

  useEffect(() => {
    if (!isBankdrop || !smsCodeForAutoComplete || !smsCodeReceivedAtForAutoComplete || !isInProgressForAutoComplete) {
      setAutoCompleteCountdown(null);
      return;
    }

    const AUTO_COMPLETE_MS = 5 * 60 * 1000; // 5 minutes
    const smsReceivedTime = new Date(smsCodeReceivedAtForAutoComplete).getTime();
    const submissionStartTime = submissionCreatedAt ? new Date(submissionCreatedAt).getTime() : 0;
    const now = Date.now();

    // SAFETY GUARD: Only auto-complete if the SMS arrived AFTER the submission started.
    // Prevents stale/promotional SMS (e.g. saved before the task even existed) from
    // instantly triggering KYC completion when the user opens the task.
    if (!Number.isFinite(smsReceivedTime) || smsReceivedTime < submissionStartTime) {
      console.warn("[Auto-Complete] Ignoring sms_code_received_at — predates submission start", {
        smsReceivedAt: smsCodeReceivedAtForAutoComplete,
        submissionCreatedAt,
      });
      setAutoCompleteCountdown(null);
      return;
    }

    // Also guard against absurdly old timestamps (>24h ago) regardless of submission time
    if (now - smsReceivedTime > 24 * 60 * 60 * 1000) {
      console.warn("[Auto-Complete] Ignoring sms_code_received_at — older than 24h", {
        smsReceivedAt: smsCodeReceivedAtForAutoComplete,
      });
      setAutoCompleteCountdown(null);
      return;
    }

    const completeAt = smsReceivedTime + AUTO_COMPLETE_MS;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((completeAt - Date.now()) / 1000));
      setAutoCompleteCountdown(remaining);

      if (remaining <= 0) {
        // Auto-complete the task
        handleCompleteTask();
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [isBankdrop, smsCodeForAutoComplete, smsCodeReceivedAtForAutoComplete, isInProgressForAutoComplete, submissionCreatedAt]);


    const handleCompleteTask = async () => {
    if (completing || submission?.status === "kyc_completed") {
      return;
    }

    setCompleting(true);

    const completedAt = new Date().toISOString();
    const existingAdminData = (submission?.admin_data as Record<string, any>) || {};
    const {
      quality_check: _previousQualityCheck,
      quality_check_completed_at: _previousQualityCheckCompletedAt,
      ...adminDataBeforeQualityCheck
    } = existingAdminData;

    const { error } = await supabase
      .from("task_submissions")
      .update({
        status: "in_progress",
        admin_data: {
          ...adminDataBeforeQualityCheck,
          kyc_completed: true,
          kyc_completed_at: completedAt,
          last_section: "quality_check",
        } as any,
      })
      .eq("id", submission!.id);

    if (error) {
      console.error("Error completing task:", error);
      toast.error("Fehler beim Abschließen");
      setCompleting(false);
      return;
    }

    // Show success animation
    setShowSuccess(true);
    
    // Trigger confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    toast.success("KYC-Schritt abgeschlossen. Weiter zur Qualitätsprüfung.");
    
    // Update local state immediately
    if (submission) {
      setSubmission({
        ...submission,
        status: "in_progress",
        admin_data: {
          ...adminDataBeforeQualityCheck,
          kyc_completed: true,
          kyc_completed_at: completedAt,
          last_section: "quality_check",
        } as any,
      });
    }
    
    const nextPath = `/dashboard/tasks/${taskId}/quality-check`;


    // Navigate after a short delay to show the success animation
    setTimeout(() => {
      navigate(nextPath);
    }, 2000);
  };

  if (loading) {
    return <PageLoader />;
  }

  const adminData = (submission?.admin_data as any) || {};
  
  // Helper function to check if a value is truthy and not just whitespace
  const hasValue = (val: any) => val && typeof val === 'string' ? val.trim().length > 0 : Boolean(val);
  
  // Check if admin has actually provided demo data (not just system fields)
  // Show demo data if any relevant fields are present, regardless of status
  const hasIdentCodesArr2 = Array.isArray(adminData?.ident_codes) && (adminData.ident_codes as any[]).some((c: any) => typeof c === 'string' && c.trim().length > 0);
  const hasActualDemoData = Boolean(
    hasValue(adminData.email) || 
    hasValue(adminData.password) || 
    hasValue(adminData.ident_code) || 
    hasIdentCodesArr2 ||
    hasValue(adminData.ident_link) || 
    hasValue(adminData.image_url) || 
    hasValue(adminData.passcode) ||
    hasValue(adminData.sms_code)
  );
  
  console.log("[DEBUG] Demo data check:", {
    hasActualDemoData,
    adminDataKeys: adminData ? Object.keys(adminData) : [],
    submissionStatus: submission?.status
  });
  
  const isInProgress = submission?.status === "in_progress";
  const isCompleted = submission?.status === "completed";
  const isKycCompleted = submission?.status === "kyc_completed" || !!adminData?.kyc_completed;
  const isPending = submission?.status === "pending";
  const isAwaitingReview = submission?.status === "awaiting_review";
  
  // SMS-Code nur anzeigen, wenn er nicht älter als 5 Minuten ist
  const smsCodeReceivedAt = adminData?.sms_code_received_at;
  const isSmsCodeFresh = smsCodeReceivedAt 
    ? (Date.now() - new Date(smsCodeReceivedAt).getTime()) < 5 * 60 * 1000 
    : false;
  const smsCode = isSmsCodeFresh ? adminData?.sms_code : null;
  
  const identCode = hasValue(adminData?.ident_code) ? adminData.ident_code : null;
  const identCodes: string[] = Array.isArray(adminData?.ident_codes) && adminData.ident_codes.length > 0
    ? adminData.ident_codes.filter((c: string) => c && c.trim())
    : identCode ? identCode.split(/,\s*/).filter((c: string) => c.trim()) : [];
  const identLink = hasValue(adminData?.ident_link) ? adminData.ident_link : null;
  const effectivePhone = hasValue(assignedPhone) ? assignedPhone : null;
  
  // Check if task has upload steps
  const hasUploadSteps = taskSteps.some((step: any) => step.type === "file");
  const needsKycRequest = !isPending && !isInProgress && !hasActualDemoData && !isKycCompleted;
  
  // Debug: Log current status
  console.log("[DEBUG] Current state:", {
    submissionStatus: submission?.status,
    isKycCompleted,
    isAwaitingReview,
    isCompleted,
    hasActualDemoData,
    hasUploadSteps,
    needsKycRequest,
    hasPhone: !!effectivePhone
  });
  
  // Determine badge status
  const getBadgeInfo = () => {
    if (isCompleted) return { variant: "default" as const, label: "Abgeschlossen" };
    if (isAwaitingReview) return { variant: "outline" as const, label: "Bewertung ausstehend" };
    if (isKycCompleted) return { variant: "secondary" as const, label: "KYC abgeschlossen" };
    if (isInProgress) return { variant: "outline" as const, label: "Demo-Daten bereit" };
    if (isPending) return { variant: "secondary" as const, label: "Ausstehend" };
    return { variant: "secondary" as const, label: "Ausstehend" };
  };
  
  const badgeInfo = getBadgeInfo();

  // Calculate progress steps
  const getProgressSteps = () => {
    const steps = [
      {
        label: "Demo-Daten",
        completed: hasActualDemoData && !isPending,
        active: !hasActualDemoData || isPending,
        icon: CheckCircle2
      },
      {
        label: "KYC durchführen",
        completed: isKycCompleted || isCompleted,
        active: hasActualDemoData && !isPending && !isKycCompleted && !isCompleted,
        icon: CheckCircle2
      },
      {
        label: "Qualitätsprüfung",
        completed: isAwaitingReview || isCompleted,
        active: isKycCompleted && !isAwaitingReview && !isCompleted,
        icon: FileCheck
      },
      {
        label: "Abgeschlossen",
        completed: isCompleted,
        active: isAwaitingReview && !isCompleted,
        icon: CheckCircle2
      }
    ];
    return steps;
  };

  const progressSteps = getProgressSteps();
  const completedSteps = progressSteps.filter(s => s.completed).length;
  // Include active step in progress calculation
  const activeStepIndex = progressSteps.findIndex(s => s.active);
  const currentStep = activeStepIndex >= 0 ? activeStepIndex + 1 : completedSteps;
  const progressPercentage = (currentStep / progressSteps.length) * 100;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <span className="text-muted-foreground">/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/tasks")}
            >
              Aufträge
            </Button>
          </div>
          <DemoConsoleTour
            phase={
              isCompleted ? "completed" :
              isKycCompleted ? "completed" :
              (hasActualDemoData && !isPending) ? "active" :
              (isPending || isInProgress) ? "waiting" :
              "request"
            }
            visibleFields={{
              email: hasValue(adminData?.email),
              password: hasValue(adminData?.password),
              identCode: identCodes.length > 0,
              identLink: hasValue(identLink),
              phone: hasValue(effectivePhone),
              smsCode: !!smsCode,
              emailCode: hasValue(assignedCustomEmail?.full_address) || hasValue(adminData?.email),
              info: hasValue(adminData?.info_text) || hasValue(adminData?.info),
              images: adminImageUrls.length > 0,
              appStore: !!(task?.google_play_url || task?.apple_store_url),
              username: hasValue(adminData?.username),
              passcode: hasValue(adminData?.passcode),
            }}
          />
        </div>

        {taskId && (adminData?.rejection_timestamp || adminData?.restart_from_step) && (
          <div className="mb-4">
            <TaskActionsBar taskId={taskId} />
          </div>
        )}



        {(() => {
          const estimatedHours = (task as any)?.estimated_hours ?? null;
          const demoProvidedAt =
            (adminData as any)?.demo_data_provided_at ||
            (adminData as any)?.demo_data_requested_at ||
            null;
          const deadlineDays = (task as any)?.deadline_days ?? 7;
          let remainingLabel: string | null = null;
          if (demoProvidedAt) {
            const start = new Date(demoProvidedAt).getTime();
            const end = start + deadlineDays * 24 * 60 * 60 * 1000;
            const diffMs = end - Date.now();
            if (diffMs > 0) {
              const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
              const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              remainingLabel = days > 0 ? `${days}T ${hours}h` : `${hours}h`;
            } else {
              remainingLabel = "Abgelaufen";
            }
          }

          const base = Number((task as any)?.compensation_amount ?? 0);
          let maxBonus = 0;
          const steps = ((task as any)?.steps ?? taskSteps ?? []);
          const responses: any[] = ((submission as any)?.step_responses as any[]) || [];
          const respFor = (sid: string) => responses.find((r: any) => r?.step_id === sid) || {};
          let postalChoice: "yes" | "no" | null = null;
          let idChoice: "personalausweis" | "reisepass" | null = null;
          for (const step of steps) {
            if (step?.ask_postal_consent && step?.postal_consent_bonus) {
              const b = Number(step.postal_consent_bonus);
              if (b > 0) maxBonus += b;
            }
            if (step?.ask_id_document && step?.id_document_bonus) {
              const vals = Object.values(step.id_document_bonus).map((v: any) => Number(v ?? 0));
              const maxIdBonus = vals.length ? Math.max(...vals) : 0;
              if (maxIdBonus > 0) maxBonus += maxIdBonus;
            }
            const r = respFor(step?.id);
            if (step?.ask_postal_consent && (r.postal_consent === "yes" || r.postal_consent === "no")) {
              postalChoice = r.postal_consent;
            }
            if (step?.ask_id_document && (r.id_document === "personalausweis" || r.id_document === "reisepass")) {
              idChoice = r.id_document;
            }
          }
          const total = base + maxBonus;
          const fmt = (n: number) =>
            n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });


          return (
            <Card className="relative overflow-hidden border-none shadow-2xl mb-6">
              <div className="absolute inset-0">
                {bannerUrls.length > 0 ? (
                  <TaskImageRotator
                    urls={bannerUrls}
                    alt={task?.title || ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/15 to-background" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/80" />
                <div className="absolute inset-0 backdrop-blur-md" />
              </div>

              <div className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {(task as any)?.logo_url && (
                        <div className="h-14 w-14 rounded-xl bg-background/90 backdrop-blur shadow-lg ring-1 ring-border/50 flex items-center justify-center overflow-hidden">
                          <img src={(task as any).logo_url} alt="" className="h-10 w-10 object-contain" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">
                          {task?.title}
                        </CardTitle>
                        {task?.description && (
                          <CardDescription className="text-sm md:text-base mt-1 max-w-2xl">
                            {task.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-background/80 backdrop-blur border border-border/60 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        Geschätzte Dauer
                      </div>
                      <div className="text-xl font-semibold">
                        {estimatedHours ? `ca. ${estimatedHours} h` : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-background/80 backdrop-blur border border-border/60 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        <Timer className="h-3.5 w-3.5" />
                        Verbleibende Zeit
                      </div>
                      <div className={`text-xl font-semibold ${remainingLabel === "Abgelaufen" ? "text-destructive" : ""}`}>
                        {remainingLabel ?? <span className="text-muted-foreground text-sm font-normal">—</span>}
                      </div>
                      {remainingLabel && remainingLabel !== "Abgelaufen" && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          ab Eingang der Demo-Daten · {deadlineDays} Tage
                        </div>
                      )}
                    </div>

                    {(base > 0 || maxBonus > 0) && (
                      <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 backdrop-blur border border-emerald-400/40 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                          <Euro className="h-3.5 w-3.5" />
                          Vergütung
                  </div>

                  {(postalChoice || idChoice) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {postalChoice && (
                        <Badge
                          variant="outline"
                          className={
                            postalChoice === "yes"
                              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-border/60 bg-background/70 text-muted-foreground"
                          }
                        >
                          Postalische Zustellung: {postalChoice === "yes" ? "Zugestimmt" : "Abgelehnt"}
                        </Badge>
                      )}
                      {idChoice && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary"
                        >
                          Ausweisdokument: {idChoice === "personalausweis" ? "Personalausweis" : "Reisepass"}
                        </Badge>
                      )}
                    </div>
                  )}

                        <div className="text-xl font-semibold">
                          {maxBonus > 0 ? `${fmt(base)} € – ${fmt(total)} €` : `${fmt(base)} €`}
                        </div>
                        {maxBonus > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            inkl. bis zu {fmt(maxBonus)} € Bonus
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })()}

        {/* Progress Indicator */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Fortschritt</CardTitle>
            <CardDescription>
              {currentStep} von {progressSteps.length} Schritten
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Progress Steps - Vertical Timeline */}
            <ol className="relative space-y-4">
              {progressSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isLast = index === progressSteps.length - 1;
                return (
                  <li key={index} className="flex items-start gap-4 relative">
                    {/* Connector line */}
                    {!isLast && (
                      <span
                        className={`absolute left-5 top-10 w-0.5 h-[calc(100%-0.5rem)] -z-0 ${
                          step.completed ? 'bg-primary' : 'bg-muted'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    {/* Circle */}
                    <div
                      className={`
                        relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
                        ${step.completed
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : step.active
                          ? 'bg-primary/10 text-primary border-2 border-primary ring-4 ring-primary/10'
                          : 'bg-muted text-muted-foreground border border-border'
                        }
                      `}
                    >
                      {step.completed ? (
                        <StepIcon className="h-5 w-5" />
                      ) : (
                        <span className="font-semibold text-sm">{index + 1}</span>
                      )}
                    </div>
                    {/* Label */}
                    <div className="flex-1 pt-1.5 pb-2">
                      <div
                        className={`
                          text-sm font-medium leading-tight
                          ${step.completed || step.active ? 'text-foreground' : 'text-muted-foreground'}
                        `}
                      >
                        {step.label}
                      </div>
                      {step.active && (
                        <div className="text-xs text-primary mt-0.5">Aktueller Schritt</div>
                      )}
                      {step.completed && (
                        <div className="text-xs text-muted-foreground mt-0.5">Abgeschlossen</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

          </CardContent>
        </Card>

        {!hasActualDemoData && !isPending && !isInProgress ? (
          <Card>
            <CardContent className="py-8 space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">KYC Testdaten beantragen</h3>
                <p className="text-muted-foreground">
                  Bevor Sie fortfahren können, benötigen Sie KYC-Demo-Daten. Diese werden vom System bereitgestellt.
                </p>
              </div>

              <div className="border-2 border-border rounded-lg p-6 bg-muted/30">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="consent" 
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                    className="mt-1"
                  />
                  <Label 
                    htmlFor="consent" 
                    className="text-base font-medium leading-relaxed cursor-pointer"
                  >
                    Ich stimme zu und fordere die Demo Daten an
                  </Label>
                </div>
              </div>

              <Button 
                onClick={handleRequestKyc} 
                disabled={requestingKyc || !consentChecked}
                className="w-full"
                size="lg"
              >
                {requestingKyc ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird angefragt...
                  </>
                ) : (
                  <>
                    Weiter
                    <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (!hasActualDemoData || isPending) && !isCompleted && !isKycCompleted ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="relative mb-6">
                <Clock className="h-16 w-16 text-primary/70 mx-auto animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">Demo-Daten werden vorbereitet</h3>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                Ihre Anfrage wurde eingereicht. Die Demo-Daten werden gerade vom System bereitgestellt.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button variant="outline" size="lg" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Jetzt aktualisieren
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                Tipp: Sie können diese Seite jederzeit verlassen und später zurückkehren
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <DemoDataBadge
              data={{
                email: hasValue(adminData?.email) ? adminData.email : undefined,
                username: hasValue(adminData?.username) ? adminData.username : undefined,
                password: hasValue(adminData?.password) ? adminData.password : undefined,
                passcode: hasValue(adminData?.passcode) ? adminData.passcode : undefined,
                ident_code: identCodes.length > 0 ? identCodes[0] : undefined,
                ident_codes: identCodes.length > 0 ? identCodes : undefined,
                ident_link: hasValue(identLink) ? identLink : undefined,
                info: hasValue(adminData?.info_text) ? adminData.info_text : hasValue(adminData?.info) ? adminData.info : undefined,
                image_url: adminImageUrl || undefined,
                image_urls: adminImageUrls.length > 0 ? adminImageUrls : undefined,
                image_names: Array.isArray(adminData?.image_names) ? adminData.image_names : undefined,
                phone_number: hasValue(adminData?.phone) ? adminData.phone : hasValue(adminData?.assigned_phone) ? adminData.assigned_phone : hasValue(assignedPhone) ? assignedPhone : undefined,
                sms_code: smsCode || undefined,
              }}
              taskId={taskId}
              taskTitle={task?.title}
              taskImageUrl={(task as any)?.logo_url || task?.image_url || task?.client?.logo_url || undefined}
              taskImages={Array.isArray((task as any)?.images) ? (task as any).images : []}
              brandColors={
                // Prefer task-level colors, fall back to client colors
                ((task as any)?.primary_color) ? {
                  primary: (task as any).primary_color,
                  secondary: (task as any).secondary_color || '#8b5cf6',
                  accent: (task as any).accent_color || undefined
                } : task?.client ? {
                  primary: task.client.primary_color || '#3b82f6',
                  secondary: task.client.secondary_color || '#8b5cf6',
                  accent: task.client.accent_color || undefined
                } : undefined
              }
              emailCodeSlot={
                (() => {
                  const emailAddress = assignedCustomEmail?.full_address || adminData?.email;
                  if (!emailAddress) return undefined;

                  const extracted = extractCodesAndLinks(receivedEmails);
                  const hasAny = extracted.codes.length > 0 || extracted.links.length > 0;

                  return (
                    <div className="space-y-2">
                      {/* Timestamp indicator */}
                      {codeReceivedAt && hasAny && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Empfangen {formatRelativeTime(codeReceivedAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Läuft ab in {Math.max(0, Math.ceil((5 * 60 - (Date.now() - new Date(codeReceivedAt).getTime()) / 1000) / 60))} Min
                          </span>
                        </div>
                      )}

                      {extracted.codes.length > 0 && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/50 rounded-lg px-3 py-2.5 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse">
                          <div className="p-1 rounded-md bg-blue-500/30 border border-blue-500/50">
                            <Mail className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                          <span className="text-xs font-medium text-blue-300">E-Mail Code:</span>
                          <span className="font-mono text-base font-bold text-blue-100 tracking-wider">{extracted.codes[0]}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 ml-auto hover:bg-blue-500/20"
                            onClick={() => copyToClipboard(extracted.codes[0], "E-Mail Code")}
                          >
                            <Copy className="h-3.5 w-3.5 text-blue-300" />
                          </Button>
                        </div>
                      )}

                      {extracted.links.length > 0 && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-lg px-3 py-2.5 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                          <div className="p-1 rounded-md bg-purple-500/30 border border-purple-500/50">
                            <ExternalLink className="h-3.5 w-3.5 text-purple-400" />
                          </div>
                          <span className="text-xs font-medium text-purple-300">Bestätigungslink:</span>
                          <a
                            href={extracted.links[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-purple-200 hover:text-purple-100 hover:underline truncate max-w-[180px]"
                          >
                            Link öffnen
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 ml-auto hover:bg-purple-500/20"
                            onClick={() => copyToClipboard(extracted.links[0], "Link")}
                          >
                            <Copy className="h-3.5 w-3.5 text-purple-300" />
                          </Button>
                        </div>
                      )}

                      {!hasAny && (
                        <div className="text-xs text-muted-foreground px-1">
                          Noch kein Code/Link empfangen.
                        </div>
                      )}

                      {/* Always show refresh */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => fetchReceivedEmailsForAddress(emailAddress, emailFilterTimestamp || undefined)}
                        disabled={loadingEmails}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${loadingEmails ? 'animate-spin' : ''}`} />
                        {loadingEmails ? 'Aktualisieren...' : 'E-Mails aktualisieren'}
                      </Button>
                    </div>
                  );
                })()
              }
              smsCodeSlot={
                (hasValue(adminData?.phone) || hasValue(adminData?.assigned_phone) || hasValue(assignedPhone)) ? (() => {
                  const smsReceivedAt = (adminData as any)?.sms_code_received_at as string | undefined;
                  return (
                    <div className="space-y-2">
                      {/* Timestamp indicator */}
                      {smsCode && smsReceivedAt && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Empfangen {formatRelativeTime(smsReceivedAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Läuft ab in {Math.max(0, Math.ceil((5 * 60 - (Date.now() - new Date(smsReceivedAt).getTime()) / 1000) / 60))} Min
                          </span>
                        </div>
                      )}

                      {smsCode && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/50 rounded-lg px-3 py-2.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                          <div className="p-1 rounded-md bg-emerald-500/30 border border-emerald-500/50">
                            <Phone className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs font-medium text-emerald-300">SMS-Code:</span>
                          <span className="font-mono text-base font-bold text-emerald-100 tracking-wider">{smsCode}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 ml-auto hover:bg-emerald-500/20"
                            onClick={() => copyToClipboard(smsCode, "SMS-Code")}
                          >
                            <Copy className="h-3.5 w-3.5 text-emerald-300" />
                          </Button>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleRefresh}
                        disabled={refreshing}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Aktualisieren...' : 'SMS aktualisieren'}
                      </Button>
                    </div>
                  );
                })() : undefined
              }
              appStoreSlot={
                (task?.google_play_url || task?.apple_store_url) ? (
                  <div className="flex flex-wrap gap-4 justify-center py-2">
                    {task?.google_play_url && (
                      <a 
                        href={task.google_play_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block rounded-xl overflow-hidden transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
                      >
                        <img src={googlePlayBadge} alt="Google Play" className="h-14 w-auto block" />
                      </a>
                    )}
                    {task?.apple_store_url && (
                      <a 
                        href={task.apple_store_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block rounded-xl overflow-hidden transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
                      >
                        <img src={appStoreBadge} alt="App Store" className="h-14 w-auto block" />
                      </a>
                    )}
                  </div>
                ) : undefined
              }
            />

            {/* Auto-Complete Status for Bankdrops */}
            {!isCompleted && !isKycCompleted && hasActualDemoData && autoCompleteCountdown !== null && (
              <div className="border rounded-lg p-4 mt-4 bg-card">
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Automatische Bestätigung</p>
                    <p className="text-xs text-muted-foreground">
                      SMS-Code erkannt – Auftrag wird in {Math.ceil(autoCompleteCountdown / 60)} Min. automatisch abgeschlossen und zur Qualitätssicherung weitergeleitet.
                    </p>
                  </div>
                </div>
                {showSuccess && (
                  <div className="flex items-center gap-2 mt-3 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Erfolgreich abgeschlossen!</span>
                  </div>
                )}
              </div>
            )}

            {/* Bankdrop: Warten auf SMS-TAN auf zugewiesener Rufnummer (kein manueller Abschluss) */}
            {!isCompleted && !isKycCompleted && hasActualDemoData && isBankdrop && autoCompleteCountdown === null && (
              <div className="border rounded-lg p-4 mt-4 bg-card">
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">KYC-Prüfung läuft</p>
                    <p className="text-xs text-muted-foreground">
                      Sobald Sie die KYC-Prüfung durchgeführt haben, wird der aktuelle Schritt automatisch abgeschlossen. Anschließend werden Sie automatisch an die Qualitätssicherung weitergeleitet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Complete only for non-Bankdrop tasks */}
            {!isCompleted && !isKycCompleted && hasActualDemoData && !isBankdrop && (
              <div className="border rounded-lg p-4 mt-4 bg-card">
                <Button onClick={handleCompleteTask} disabled={completing || showSuccess} className={`w-full ${showSuccess ? 'bg-green-600' : ''}`}>
                  {showSuccess ? <><CheckCircle2 className="mr-2 h-5 w-5" />Erfolgreich!</> : completing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird abgeschlossen...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />KYC Abschließen</>}
                </Button>
              </div>
            )}

          {isKycCompleted && !hasUploadSteps && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
              <Clock className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Warten auf Prüfung</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">Ihre Arbeit wird überprüft</p>
            </div>
          )}

          {isKycCompleted && hasUploadSteps && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">KYC Abgeschlossen</h3>
              <Button onClick={() => navigate(`/dashboard/tasks/${taskId}/postal-documents-check`)} className="w-full mt-2">Zum Postversand</Button>
            </div>
          )}

          {isCompleted && (
            <div className="mt-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">Auftrag Abgeschlossen</h3>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDemoData;
