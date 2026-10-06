import { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_KEY, EXTERNAL_PROJECT_ID } from "@/integrations/external/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  Inbox,
  Clock,
  User,
  Globe,
  Settings,
  Loader2,
  MailOpen,
  Sparkles,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Code,
  ExternalLink,
  Search,
  Reply,
  Send,
  CloudCog,
  Pencil,
  Trophy,
  History as HistoryIcon,
  MessageSquare,
} from "lucide-react";
import { EmployeeRepliesInbox } from "@/components/admin/EmployeeRepliesInbox";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface EmailDomain {
  id: string;
  domain: string;
  is_active: boolean;
  is_catch_all: boolean;
  cloudflare_zone_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceivedEmail {
  id: string;
  domain_id: string | null;
  to_address: string;
  from_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  headers: unknown;
  task_id: string | null;
  submission_id: string | null;
  is_read: boolean;
  received_at: string;
  created_at: string;
}

interface GeneratedEmail {
  id: string;
  domain_id: string;
  local_part: string;
  full_address: string;
  task_id: string | null;
  submission_id: string | null;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  email_domains?: EmailDomain;
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface Employee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface EmailAccount {
  id: string;
  email_address: string;
  assigned_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  provider?: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

// Decode Quoted-Printable encoded content with proper UTF-8 handling
const decodeQuotedPrintable = (input: string): string => {
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
};

// Check if content appears to be Quoted-Printable encoded
// Must be more strict to avoid false positives with HTML attributes like width=device
const isQuotedPrintable = (content: string): boolean => {
  if (!content) return false;
  
  // Look for definitive QP markers - =3D is escaped equals, =20 is space, =0D=0A is CRLF
  // Also check for soft line breaks (= at end of line)
  const hasDefinitiveQpMarkers = /=3D|=20|=0D|=0A|=C3|=C2|=E2|=\r?\n\s*[^\s]/i.test(content);
  
  // If content looks like valid HTML (has proper tags), it's likely NOT QP encoded
  const looksLikeValidHtml = /<html[^>]*>[\s\S]*<\/html>/i.test(content) || 
    (/<[a-z][a-z0-9]*[^>]*>/i.test(content) && !content.includes('=3C'));
  
  // Only consider it QP if we have definitive markers AND it doesn't look like valid HTML
  // OR if it has very high density of QP sequences (>5% of content)
  const qpSequences = (content.match(/=[0-9A-Fa-f]{2}/g) || []).length;
  const qpDensity = qpSequences / (content.length / 3);
  
  return hasDefinitiveQpMarkers && (!looksLikeValidHtml || qpDensity > 0.05);
};

// Recursively extract text from MIME parts
const extractTextFromMimePart = (part: string): { text: string; html: string } => {
  let text = "";
  let html = "";
  
  // Check for nested multipart
  const nestedBoundaryMatch = part.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^"\r\n;]+)"?/i);
  if (nestedBoundaryMatch) {
    const nestedBoundary = nestedBoundaryMatch[1];
    const nestedParts = part.split(new RegExp(`--${nestedBoundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    
    for (const nestedPart of nestedParts) {
      if (nestedPart.trim() === '' || nestedPart.trim() === '--') continue;
      const parsed = extractTextFromMimePart(nestedPart);
      if (parsed.text && !text) text = parsed.text;
      if (parsed.html && !html) html = parsed.html;
    }
    return { text, html };
  }
  
  // Check for text/plain or text/html
  const typeMatch = part.match(/Content-Type:\s*text\/(plain|html)/i);
  if (!typeMatch) return { text, html };
  
  // Skip if this is an attachment
  if (part.match(/Content-Disposition:\s*attachment/i)) {
    return { text, html };
  }
  
  // Extract body after headers (double newline)
  const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
  if (!bodyMatch) return { text, html };
  
  let body = bodyMatch[1].trim();
  
  // Remove trailing boundary markers
  body = body.replace(/--[^\r\n]+--[\s]*$/, '').trim();
  body = body.replace(/--[^\r\n]+[\s]*$/, '').trim();
  
  // Check encoding and decode
  const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';
  
  if (encoding === 'base64') {
    try {
      const cleanBase64 = body.replace(/[\r\n\s]/g, "");
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      body = new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      console.log("Failed to decode base64:", e);
    }
  } else if (encoding === 'quoted-printable' || isQuotedPrintable(body)) {
    body = decodeQuotedPrintable(body);
  }
  
  if (typeMatch[1].toLowerCase() === 'plain') {
    text = body;
  } else if (typeMatch[1].toLowerCase() === 'html') {
    html = body;
  }
  
  return { text, html };
};

// Clean up MIME boundaries and headers from content
const cleanMimeContent = (content: string): string => {
  if (!content) return "";
  
  // Check if content contains MIME boundaries (the main multipart indicator)
  const boundaryMatch = content.match(/boundary="?([^"\r\n;]+)"?/i);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = content.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    
    let extractedText = "";
    let extractedHtml = "";
    
    for (const part of parts) {
      // Skip empty parts, closing boundary, and attachments
      if (part.trim() === '' || part.trim() === '--') continue;
      if (part.match(/Content-Disposition:\s*attachment/i)) continue;
      if (part.match(/Content-Type:\s*application\//i)) continue;
      
      const parsed = extractTextFromMimePart(part);
      if (parsed.text && !extractedText) extractedText = parsed.text;
      if (parsed.html && !extractedHtml) extractedHtml = parsed.html;
    }
    
    // Prefer HTML, fallback to text
    if (extractedHtml) return extractedHtml;
    if (extractedText) return extractedText;
  }
  
  // Simple case: content has encoding header but no multipart boundary
  if (content.includes('Content-Transfer-Encoding:')) {
    // Try to find where the actual body starts
    const bodyMatch = content.match(/(?:Content-Transfer-Encoding:[^\r\n]+\r?\n\r?\n)([\s\S]+?)(?:--|$)/);
    if (bodyMatch) {
      let body = bodyMatch[1].trim();
      if (isQuotedPrintable(body)) {
        body = decodeQuotedPrintable(body);
      }
      // Remove any trailing MIME parts (attachments)
      body = body.split(/\r?\n--\d+/)[0].trim();
      return body;
    }
  }
  
  // If content still looks encoded, try decoding it
  if (isQuotedPrintable(content)) {
    return decodeQuotedPrintable(content);
  }
  
  return content;
};

export default function TempMailInbox() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inbox");
  
  // Domains
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [deleteDomainId, setDeleteDomainId] = useState<string | null>(null);
  
  // Generated Emails
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [customLocalPart, setCustomLocalPart] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [emailNote, setEmailNote] = useState("");
  
  // Received Emails
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Reply functionality
  const [replyMode, setReplyMode] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // Webhook Info
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);

  // Outlook Accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isConnectingOutlook, setIsConnectingOutlook] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    email_address: "",
    assigned_to: "unassigned",
    status: "available",
    notes: "",
  });
  
  // Template adoption state
  const [adoptingTemplate, setAdoptingTemplate] = useState(false);
  const [adoptTemplateDialogOpen, setAdoptTemplateDialogOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<{ id: string; title: string }[]>([]);
  const [selectedTaskForTemplate, setSelectedTaskForTemplate] = useState<string>("");
  const [selectedEmailType, setSelectedEmailType] = useState<'opening' | 'completion'>('completion');

  // Send to employee state (dialog removed - now using direct action)
  const [sendingToEmployee, setSendingToEmployee] = useState(false);

  // Employee replies count
  const [employeeRepliesUnreadCount, setEmployeeRepliesUnreadCount] = useState(0);

  const fetchEmailAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("email_accounts")
        .select(`
          *,
          profiles:assigned_to (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmailAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching email accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConnectOutlook = async () => {
    setIsConnectingOutlook(true);
    try {
      const { data, error } = await supabase.functions.invoke('outlook-oauth', {
        body: {
          redirectUrl: window.location.href,
          state: 'outlook-connect'
        }
      });

      if (error) throw error;

      if (data?.authUrl) {
        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'outlook-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=true`
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'outlook-oauth-success') {
            window.removeEventListener('message', handleMessage);
            setIsConnectingOutlook(false);
            toast.success("Outlook-Konto verbunden", {
              description: `E-Mail ${event.data.email} wurde hinzugefügt`,
            });
            fetchEmailAccounts();
          }
        };
        window.addEventListener('message', handleMessage);

        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            window.removeEventListener('message', handleMessage);
            setIsConnectingOutlook(false);
          }
        }, 500);
      } else {
        throw new Error('Keine Auth-URL erhalten');
      }
    } catch (error: any) {
      toast.error(`OAuth-Fehler: ${error.message}`);
      setIsConnectingOutlook(false);
    }
  };

  const updateEmailAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      const { error } = await supabase
        .from("email_accounts")
        .update({
          email_address: accountFormData.email_address,
          assigned_to: accountFormData.assigned_to === "unassigned" ? null : accountFormData.assigned_to,
          status: accountFormData.status,
          notes: accountFormData.notes || null,
        })
        .eq("id", editingAccount.id);

      if (error) throw error;

      toast.success("Konto aktualisiert");
      setEditDialogOpen(false);
      setEditingAccount(null);
      fetchEmailAccounts();
    } catch (error: any) {
      toast.error(`Fehler: ${error.message}`);
    }
  };

  const deleteEmailAccount = async (id: string) => {
    if (!confirm("Möchten Sie dieses E-Mail-Konto wirklich löschen?")) return;

    try {
      const { error } = await supabase.from("email_accounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Konto gelöscht");
      fetchEmailAccounts();
    } catch (error: any) {
      toast.error(`Fehler: ${error.message}`);
    }
  };

  const openEditAccountDialog = (account: EmailAccount) => {
    setEditingAccount(account);
    setAccountFormData({
      email_address: account.email_address,
      assigned_to: account.assigned_to || "unassigned",
      status: account.status,
      notes: account.notes || "",
    });
    setEditDialogOpen(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles?.some((r) => r.role === "admin")) {
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
      
      // Load data
      await Promise.all([
        fetchDomains(),
        fetchGeneratedEmails(),
        fetchReceivedEmails(),
        fetchEmployees(),
        fetchEmailAccounts(),
      ]);
    };

    checkAuth();
  }, [navigate]);

  // Set up realtime subscription for received emails
  useEffect(() => {
    const channel = supabase
      .channel('received-emails')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'received_emails',
        },
        (payload) => {
          console.log('New email received:', payload);
          setReceivedEmails(prev => [payload.new as ReceivedEmail, ...prev]);
          toast.success("Neue E-Mail empfangen!", {
            description: (payload.new as ReceivedEmail).subject || "Neue Nachricht",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const { data, error } = await supabase
        .from("email_domains")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setDomains(data || []);
      
      if (data && data.length > 0 && !selectedDomainId) {
        setSelectedDomainId(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching domains:", error);
      toast.error("Fehler beim Laden der Domains");
    } finally {
      setLoadingDomains(false);
    }
  };

  const fetchGeneratedEmails = async () => {
    setLoadingGenerated(true);
    try {
      const { data, error } = await supabase
        .from("generated_emails")
        .select("*, email_domains(*), profiles:user_id(id, first_name, last_name, email)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setGeneratedEmails(data || []);
    } catch (error: any) {
      console.error("Error fetching generated emails:", error);
    } finally {
      setLoadingGenerated(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("last_name", { ascending: true });
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const escapeIlike = (value: string) =>
    value
      // Escape % and _ for LIKE, and backslash itself
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");

  const fetchReceivedEmails = async (term?: string) => {
    setLoadingReceived(true);
    try {
      const normalizedTerm = (term ?? searchTerm).trim();

      // Only fetch metadata columns to avoid timeout on large body fields
      // EXCLUDE only internal/system emails. External task emails may have a
      // submission_id so admins can still see mail assigned to an employee.
      let query = supabase
        .from("received_emails")
        .select(
          "id, domain_id, to_address, from_address, subject, headers, task_id, submission_id, is_read, received_at, created_at"
        )
        .not("from_address", "ilike", "%(intern)%")
        .not("to_address", "ilike", "%(intern)%")
        .not("from_address", "ilike", "%payexpert-hr.com%")
        .not("from_address", "ilike", "%Daniel Krauss%")
        .order("received_at", { ascending: false });

      // If a search term is provided, search server-side so older emails can be found.
      // Otherwise, we only load the most recent 100 for performance.
      if (normalizedTerm) {
        const t = escapeIlike(normalizedTerm);

        // Also resolve employee-assigned email addresses (Outlook + Custom)
        // so searching by employee name finds their emails too
        const matchingAddresses: string[] = [];
        const lowerTerm = normalizedTerm.toLowerCase();

        // Find employees matching the search term
        const matchingEmployees = employees.filter(emp => {
          const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
          return fullName.includes(lowerTerm) || emp.email?.toLowerCase().includes(lowerTerm);
        });

        if (matchingEmployees.length > 0) {
          const empIds = matchingEmployees.map(e => e.id);

          // Fetch Outlook accounts assigned to matching employees
          const { data: outlookAccounts } = await supabase
            .from("email_accounts")
            .select("email_address")
            .in("assigned_to", empIds);

          if (outlookAccounts) {
            matchingAddresses.push(...outlookAccounts.map(a => a.email_address));
          }

          // Fetch Custom domain emails assigned to matching employees
          const { data: customEmails } = await supabase
            .from("generated_emails")
            .select("full_address")
            .in("user_id", empIds)
            .eq("is_active", true);

          if (customEmails) {
            matchingAddresses.push(...customEmails.map(e => e.full_address));
          }
        }

        // Build OR filter: standard text search + employee email addresses
        const orParts = [
          `to_address.ilike.%${t}%`,
          `from_address.ilike.%${t}%`,
          `subject.ilike.%${t}%`,
        ];

        // Add exact address matches for employee-assigned emails
        for (const addr of matchingAddresses) {
          const escapedAddr = escapeIlike(addr);
          orParts.push(`to_address.ilike.%${escapedAddr}%`);
          orParts.push(`from_address.ilike.%${escapedAddr}%`);
        }

        query = query
          .or(orParts.join(","))
          .limit(200);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      // Cast to ReceivedEmail with null body fields (will be loaded on demand)
      setReceivedEmails((data || []).map(e => ({
        ...e,
        body_text: null,
        body_html: null,
      })) as ReceivedEmail[]);
    } catch (error: any) {
      console.error("Error fetching received emails:", error);
      toast.error("Fehler beim Laden der E-Mails");
    } finally {
      setLoadingReceived(false);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Bitte gib eine Domain ein");
      return;
    }
    
    // Validate domain format (supports multi-level domains like payexpert.com.de)
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      toast.error("Ungültiges Domain-Format");
      return;
    }
    
    setAddingDomain(true);
    try {
      const { data, error } = await supabase
        .from("email_domains")
        .insert({
          domain: newDomain.trim().toLowerCase(),
          is_active: true,
          is_catch_all: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setDomains(prev => [data, ...prev]);
      setNewDomain("");
      setAddDomainOpen(false);
      toast.success("Domain hinzugefügt!");
    } catch (error: any) {
      console.error("Error adding domain:", error);
      if (error.code === "23505") {
        toast.error("Diese Domain existiert bereits");
      } else {
        toast.error("Fehler beim Hinzufügen der Domain");
      }
    } finally {
      setAddingDomain(false);
    }
  };

  const toggleDomainActive = async (domain: EmailDomain) => {
    try {
      const { error } = await supabase
        .from("email_domains")
        .update({ is_active: !domain.is_active })
        .eq("id", domain.id);
      
      if (error) throw error;
      
      setDomains(prev => prev.map(d => 
        d.id === domain.id ? { ...d, is_active: !d.is_active } : d
      ));
      toast.success(domain.is_active ? "Domain deaktiviert" : "Domain aktiviert");
    } catch (error: any) {
      console.error("Error toggling domain:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const deleteDomain = async () => {
    if (!deleteDomainId) return;
    
    try {
      const { error } = await supabase
        .from("email_domains")
        .delete()
        .eq("id", deleteDomainId);
      
      if (error) throw error;
      
      setDomains(prev => prev.filter(d => d.id !== deleteDomainId));
      setDeleteDomainId(null);
      toast.success("Domain gelöscht");
    } catch (error: any) {
      console.error("Error deleting domain:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const generateRandomLocalPart = () => {
    const wordList = [
      "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
      "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
      "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
      "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
      "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
      "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
      "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
      "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
      "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
      "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
      "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
      "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
      "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake",
      "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon", "badge",
      "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain",
      "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
      "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit",
      "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology",
      "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless",
      "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
      "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss",
      "bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread",
      "breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken", "bronze",
      "broom", "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
      "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy",
      "butter", "buyer", "buzz", "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call",
      "calm", "camera", "camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas",
      "canyon", "capable", "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry",
      "cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog", "catch", "category",
      "cattle", "caught", "cause", "caution", "cave", "ceiling", "celery", "cement", "census", "century",
      "cereal", "certain", "chair", "chalk", "champion", "change", "chaos", "chapter", "charge", "chase",
      "chat", "cheap", "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child",
      "chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn", "cigar", "cinnamon", "circle",
      "citizen", "city", "civil", "claim", "clap", "clarify", "claw", "clay", "clean", "clerk",
      "clever", "click", "client", "cliff", "climb", "clinic", "clip", "clock", "clog", "close",
      "cloth", "cloud", "clown", "club", "clump", "cluster", "clutch", "coach", "coast", "coconut",
      "code", "coffee", "coil", "coin", "collect", "color", "column", "combine", "come", "comfort",
      "comic", "common", "company", "concert", "conduct", "confirm", "congress", "connect", "consider", "control",
      "convince", "cook", "cool", "copper", "copy", "coral", "core", "corn", "correct", "cost",
      "cotton", "couch", "country", "couple", "course", "cousin", "cover", "coyote", "crack", "cradle",
      "craft", "cram", "crane", "crash", "crater", "crawl", "crazy", "cream", "credit", "creek",
      "crew", "cricket", "crime", "crisp", "critic", "crop", "cross", "crouch", "crowd", "crucial",
      "cruel", "cruise", "crumble", "crunch", "crush", "cry", "crystal", "cube", "culture", "cup",
      "cupboard", "curious", "current", "curtain", "curve", "cushion", "cute", "cycle", "dad", "damage",
      "damp", "dance", "danger", "daring", "dash", "daughter", "dawn", "day", "deal", "debate",
      "debris", "decade", "december", "decide", "decline", "decorate", "decrease", "deer", "defense", "define",
      "defy", "degree", "delay", "deliver", "demand", "demise", "denial", "dentist", "deny", "depart",
      "depend", "deposit", "depth", "deputy", "derive", "describe", "desert", "design", "desk", "despair",
      "destroy", "detail", "detect", "develop", "device", "devote", "diagram", "dial", "diamond", "diary",
      "dice", "diesel", "diet", "differ", "digital", "dignity", "dilemma", "dinner", "dinosaur", "direct",
      "dirt", "disagree", "discover", "disease", "dish", "dismiss", "disorder", "display", "distance", "divert",
      "divide", "divorce", "dizzy", "doctor", "document", "dog", "doll", "dolphin", "domain", "donate",
      "donkey", "donor", "door", "dose", "double", "dove", "draft", "dragon", "drama", "drastic",
      "draw", "dream", "dress", "drift", "drill", "drink", "drip", "drive", "drop", "drum",
      "dry", "duck", "dumb", "dune", "during", "dust", "dutch", "duty", "dwarf", "dynamic",
      "eager", "eagle", "early", "earn", "earth", "easily", "east", "easy", "echo", "ecology",
      "economy", "edge", "edit", "educate", "effort", "egg", "eight", "either", "elbow", "elder",
      "electric", "elegant", "element", "elephant", "elevator", "elite", "else", "embark", "embody", "embrace",
      "emerge", "emotion", "employ", "empower", "empty", "enable", "enact", "end", "endless", "endorse",
      "enemy", "energy", "enforce", "engage", "engine", "enhance", "enjoy", "enlist", "enough", "enrich",
      "enroll", "ensure", "enter", "entire", "entry", "envelope", "episode", "equal", "equip", "era",
      "erase", "erode", "erosion", "error", "erupt", "escape", "essay", "essence", "estate", "eternal",
      "ethics", "evidence", "evil", "evoke", "evolve", "exact", "example", "excess", "exchange", "excite",
      "exclude", "excuse", "execute", "exercise", "exhaust", "exhibit", "exile", "exist", "exit", "exotic",
      "expand", "expect", "expire", "explain", "expose", "express", "extend", "extra", "eye", "eyebrow",
      "fabric", "face", "faculty", "fade", "faint", "faith", "fall", "false", "fame", "family",
      "famous", "fan", "fancy", "fantasy", "farm", "fashion", "fat", "fatal", "father", "fatigue",
      "fault", "favorite", "feature", "february", "federal", "fee", "feed", "feel", "female", "fence",
      "festival", "fetch", "fever", "few", "fiber", "fiction", "field", "figure", "file", "film",
      "filter", "final", "find", "fine", "finger", "finish", "fire", "firm", "first", "fiscal",
      "fish", "fit", "fitness", "fix", "flag", "flame", "flash", "flat", "flavor", "flee",
      "flight", "flip", "float", "flock", "floor", "flower", "fluid", "flush", "fly", "foam",
      "focus", "fog", "foil", "fold", "follow", "food", "foot", "force", "forest", "forget",
      "fork", "fortune", "forum", "forward", "fossil", "foster", "found", "fox", "fragile", "frame",
      "frequent", "fresh", "friend", "fringe", "frog", "front", "frost", "frown", "frozen", "fruit",
      "fuel", "fun", "funny", "furnace", "fury", "future", "gadget", "gain", "galaxy", "gallery",
      "game", "gap", "garage", "garbage", "garden", "garlic", "garment", "gas", "gasp", "gate",
      "gather", "gauge", "gaze", "general", "genius", "genre", "gentle", "genuine", "gesture", "ghost",
      "giant", "gift", "giggle", "ginger", "giraffe", "girl", "give", "glad", "glance", "glare",
      "glass", "glide", "glimpse", "globe", "gloom", "glory", "glove", "glow", "glue", "goat",
      "goddess", "gold", "good", "goose", "gorilla", "gospel", "gossip", "govern", "gown", "grab",
      "grace", "grain", "grant", "grape", "grass", "gravity", "great", "green", "grid", "grief",
      "grit", "grocery", "group", "grow", "grunt", "guard", "guess", "guide", "guilt", "guitar",
      "gun", "gym", "habit", "hair", "half", "hammer", "hamster", "hand", "happy", "harbor",
      "hard", "harsh", "harvest", "hat", "have", "hawk", "hazard", "head", "health", "heart",
      "heavy", "hedgehog", "height", "hello", "helmet", "help", "hen", "hero", "hidden", "high"
    ];
    
    // Wähle 2-3 zufällige Wörter
    const numWords = Math.floor(Math.random() * 2) + 2; // 2 oder 3 Wörter
    const selectedWords: string[] = [];
    
    for (let i = 0; i < numWords; i++) {
      const randomIndex = Math.floor(Math.random() * wordList.length);
      selectedWords.push(wordList[randomIndex]);
    }
    
    return selectedWords.join(".");
  };

  const generateEmail = async () => {
    if (!selectedDomainId) {
      toast.error("Bitte wähle eine Domain aus");
      return;
    }
    
    const domain = domains.find(d => d.id === selectedDomainId);
    if (!domain) {
      toast.error("Domain nicht gefunden");
      return;
    }
    
    const localPart = customLocalPart.trim() || generateRandomLocalPart();
    const fullAddress = `${localPart}@${domain.domain}`;
    
    setGeneratingEmail(true);
    try {
      const insertData: {
        domain_id: string;
        local_part: string;
        full_address: string;
        is_active: boolean;
        user_id?: string;
      } = {
        domain_id: selectedDomainId,
        local_part: localPart,
        full_address: fullAddress,
        is_active: true,
      };
      
      if (selectedEmployeeId) {
        insertData.user_id = selectedEmployeeId;
      }
      
      const { data, error } = await supabase
        .from("generated_emails")
        .insert(insertData)
        .select("*, email_domains(*), profiles:user_id(id, first_name, last_name, email)")
        .single();
      
      if (error) throw error;
      
      setGeneratedEmails(prev => [data, ...prev]);
      setCustomLocalPart("");
      setSelectedEmployeeId("");
      setEmailNote("");
      setGenerateOpen(false);
      toast.success("E-Mail-Adresse erstellt!");
      
      // Copy to clipboard
      navigator.clipboard.writeText(fullAddress);
      toast.info("In Zwischenablage kopiert!");
    } catch (error: any) {
      console.error("Error generating email:", error);
      if (error.code === "23505") {
        toast.error("Diese E-Mail-Adresse existiert bereits");
      } else {
        toast.error("Fehler beim Erstellen");
      }
    } finally {
      setGeneratingEmail(false);
    }
  };

  const deleteGeneratedEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from("generated_emails")
        .delete()
        .eq("id", emailId);
      
      if (error) throw error;
      
      setGeneratedEmails(prev => prev.filter(e => e.id !== emailId));
      toast.success("E-Mail-Adresse gelöscht");
    } catch (error: any) {
      console.error("Error deleting email:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const markEmailAsRead = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from("received_emails")
        .update({ is_read: true })
        .eq("id", emailId);
      
      if (error) throw error;
      
      setReceivedEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, is_read: true } : e
      ));
    } catch (error: any) {
      console.error("Error marking email as read:", error);
    }
  };

  const openEmail = async (email: ReceivedEmail) => {
    // If body content is not loaded yet, fetch it on demand
    let fullEmail = email;
    if (!email.body_text && !email.body_html) {
      try {
        const { data, error } = await supabase
          .from("received_emails")
          .select("body_text, body_html")
          .eq("id", email.id)
          .single();
        
        if (!error && data) {
          fullEmail = { ...email, ...data };
          // Update the email in the list as well
          setReceivedEmails(prev => prev.map(e => 
            e.id === email.id ? fullEmail : e
          ));
        }
      } catch (err) {
        console.error("Error loading email body:", err);
      }
    }
    
    setSelectedEmail(fullEmail);
    setEmailDialogOpen(true);
    setReplyMode(false);
    setReplySubject("");
    setReplyBody("");
    if (!email.is_read) {
      markEmailAsRead(email.id);
    }
  };

  const startReply = () => {
    if (!selectedEmail) return;
    setReplyMode(true);
    setReplySubject(`Re: ${selectedEmail.subject || "(Kein Betreff)"}`);
    setReplyBody("");
  };

  const sendReply = async () => {
    if (!selectedEmail || !replyBody.trim()) {
      toast.error("Bitte gib einen Nachrichtentext ein");
      return;
    }

    setSendingReply(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-temp-mail", {
        body: {
          from_address: selectedEmail.to_address,
          to_address: selectedEmail.from_address,
          subject: replySubject,
          body_text: replyBody,
          reply_to_email_id: selectedEmail.id,
        },
      });

      if (error) throw error;

      toast.success("Antwort gesendet!");
      setReplyMode(false);
      setReplySubject("");
      setReplyBody("");
      setEmailDialogOpen(false);
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error(`Fehler beim Senden: ${error.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert!");
  };
  
  // Fetch tasks for template adoption
  const fetchTasksForTemplateAdoption = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .is("assigned_to", null)
        .order("title", { ascending: true });
      
      if (error) throw error;
      setAvailableTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };
  
  // Open adopt template dialog
  const openAdoptTemplateDialog = async (emailType: 'opening' | 'completion') => {
    await fetchTasksForTemplateAdoption();
    setSelectedTaskForTemplate("");
    setSelectedEmailType(emailType);
    setAdoptTemplateDialogOpen(true);
  };
  
  // Adopt email layout as template (opening or completion)
  const adoptEmailAsTemplate = async () => {
    if (!selectedEmail || !selectedTaskForTemplate) {
      toast.error("Bitte wähle einen Auftrag aus");
      return;
    }
    
    setAdoptingTemplate(true);
    try {
      // Get the email HTML content - decode multiple times if needed
      const decodeContent = (raw: string): string => {
        if (!raw) return "";
        
        // First clean MIME structure
        let content = cleanMimeContent(raw);
        
        // Decode Quoted-Printable multiple times until stable
        let prevContent = "";
        let iterations = 0;
        while (isQuotedPrintable(content) && content !== prevContent && iterations < 5) {
          prevContent = content;
          content = decodeQuotedPrintable(content);
          iterations++;
        }
        
        // Strip remaining MIME headers that may have slipped through
        content = content.replace(/Content-Type:.*?(\r?\n|\r)/gi, '');
        content = content.replace(/Content-Transfer-Encoding:.*?(\r?\n|\r)/gi, '');
        content = content.replace(/MIME-Version:.*?(\r?\n|\r)/gi, '');
        
        return content.trim();
      };
      
      let htmlContent = decodeContent(selectedEmail.body_html || '');
      let textContent = decodeContent(selectedEmail.body_text || '');
      
      // If HTML content looks corrupted (has lots of replacement chars), try text instead
      const corruptionRatio = (htmlContent.match(/[�◆□]/g) || []).length / (htmlContent.length || 1);
      if (corruptionRatio > 0.1 && textContent && !textContent.includes('◆')) {
        // HTML is corrupted, use text content and wrap in basic HTML
        htmlContent = `<div style="font-family: sans-serif;">${textContent.replace(/\n/g, '<br/>')}</div>`;
      }
      
      const content = (htmlContent && htmlContent.includes('<')) ? htmlContent : textContent;
      
      // Get task info
      const task = availableTasks.find(t => t.id === selectedTaskForTemplate);
      
      // Extract sender info from email
      const senderEmail = selectedEmail.from_address;
      const senderName = senderEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      const emailTypeLabel = selectedEmailType === 'opening' ? 'Eröffnung' : 'Abschluss';
      const defaultSubject = selectedEmailType === 'opening' 
        ? `${task?.title} - Auftrag gestartet`
        : `${task?.title} - Auftrag abgeschlossen`;
      
      // Check if template already exists in new table
      const { data: existing } = await supabase
        .from("task_email_templates")
        .select("id")
        .eq("task_id", selectedTaskForTemplate)
        .eq("email_type", selectedEmailType)
        .single();
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (existing) {
        // Update existing template
        const { error } = await supabase
          .from("task_email_templates")
          .update({
            subject: selectedEmail.subject || defaultSubject,
            content: content,
            sender_email: senderEmail,
            sender_name: senderName,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
        
        if (error) throw error;
        toast.success(`${emailTypeLabel}-Vorlage aktualisiert!`, {
          description: `Layout für "${task?.title}" wurde übernommen`
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from("task_email_templates")
          .insert({
            task_id: selectedTaskForTemplate,
            email_type: selectedEmailType,
            subject: selectedEmail.subject || defaultSubject,
            content: content,
            sender_email: senderEmail,
            sender_name: senderName,
            created_by: user?.id
          });
        
        if (error) throw error;
        toast.success(`${emailTypeLabel}-Vorlage erstellt!`, {
          description: `Layout für "${task?.title}" wurde übernommen`
        });
      }
      
      setAdoptTemplateDialogOpen(false);
      setEmailDialogOpen(false);
    } catch (error: any) {
      console.error("Error adopting template:", error);
      toast.error("Fehler beim Übernehmen des Layouts");
    } finally {
      setAdoptingTemplate(false);
    }
  };

  const getWebhookUrl = () => {
    const projectId = EXTERNAL_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/email-webhook`;
  };

  // Build a set of email addresses assigned to employees for client-side filtering
  const employeeEmailMap = useMemo(() => {
    const map = new Map<string, string>(); // email -> employee display name
    for (const acc of emailAccounts) {
      if (acc.assigned_to && acc.profiles) {
        const name = `${acc.profiles.first_name || ""} ${acc.profiles.last_name || ""}`.trim();
        map.set(acc.email_address.toLowerCase(), name);
      }
    }
    for (const gen of generatedEmails) {
      if (gen.user_id && gen.profiles) {
        const name = `${gen.profiles.first_name || ""} ${gen.profiles.last_name || ""}`.trim();
        map.set(gen.full_address.toLowerCase(), name);
      }
    }
    return map;
  }, [emailAccounts, generatedEmails]);

  const filteredEmails = receivedEmails.filter(email => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    // Standard text match
    if (
      email.to_address.toLowerCase().includes(term) ||
      email.from_address.toLowerCase().includes(term) ||
      email.subject?.toLowerCase().includes(term)
    ) return true;
    // Check if to/from matches an employee-assigned address whose name matches
    const toName = employeeEmailMap.get(email.to_address.toLowerCase());
    if (toName && toName.toLowerCase().includes(term)) return true;
    const fromName = employeeEmailMap.get(email.from_address.toLowerCase());
    if (fromName && fromName.toLowerCase().includes(term)) return true;
    return false;
  });

  const unreadCount = receivedEmails.filter(e => !e.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            E-Mail-Zentrale
          </h1>
          <p className="text-muted-foreground">
            Verwalte alle E-Mail-Konten und empfange Nachrichten zentral
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setWebhookDialogOpen(true)}
          >
            <Code className="h-4 w-4 mr-2" />
            Webhook Setup
          </Button>
          <Button 
            onClick={handleConnectOutlook} 
            disabled={isConnectingOutlook}
            variant="outline"
            className="border-[#0078D4]/30 text-[#0078D4] hover:bg-[#0078D4]/10"
          >
            {isConnectingOutlook ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 21 21" fill="currentColor">
                <path d="M0 3.449L8.543 2.233v8.074H0V3.449zm0 14.1l8.543 1.217V10.76H0v6.788zM9.543 18.95L21 20.62V10.76H9.543v8.19zm0-16.72v8.077H21V.38L9.543 2.23z"/>
              </svg>
            )}
            Azure einrichten wie gehen wir vor?
          </Button>
          <Button onClick={() => setGenerateOpen(true)} disabled={domains.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            E-Mail generieren
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Posteingang</span>
            {unreadCount > 0 && (
              <Badge className="ml-1">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="replies" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Antworten</span>
            {employeeRepliesUnreadCount > 0 && (
              <Badge className="ml-1">{employeeRepliesUnreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outlook" className="flex items-center gap-2">
            <CloudCog className="h-4 w-4" />
            <span className="hidden sm:inline">Outlook</span>
            <Badge variant="secondary">{emailAccounts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="addresses" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Adressen</span>
            <Badge variant="secondary">{generatedEmails.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="domains" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domains</span>
            <Badge variant="secondary">{domains.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Empfangene E-Mails</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Suchen..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") fetchReceivedEmails(e.currentTarget.value);
                      }}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchReceivedEmails(searchTerm)}
                    disabled={loadingReceived}
                  >
                    {loadingReceived ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {filteredEmails.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <MailOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {searchTerm.trim()
                        ? "Keine Treffer für deine Suche"
                        : "Keine E-Mails empfangen"}
                    </p>
                    <p className="text-sm">
                      {searchTerm.trim()
                        ? "Tipp: Drücke Enter oder klicke den Refresh-Button, um serverseitig zu suchen (auch in älteren E-Mails)."
                        : "Konfiguriere Cloudflare Email Routing um E-Mails zu empfangen"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEmails.map((email) => (
                      <div
                        key={email.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          !email.is_read ? "bg-primary/5" : ""
                        }`}
                        onClick={() => openEmail(email)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${!email.is_read ? "bg-primary/20" : "bg-muted"}`}>
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm truncate ${!email.is_read ? "font-semibold" : ""}`}>
                                {email.from_address}
                              </p>
                              {!email.is_read && (
                                <Badge className="text-[10px] px-1.5 py-0">Neu</Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate">{email.subject || "(Kein Betreff)"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {email.to_address}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(email.received_at), "dd.MM.yyyy HH:mm", { locale: de })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Replies Tab */}
        <TabsContent value="replies" className="space-y-4">
          <EmployeeRepliesInbox onUnreadCountChange={setEmployeeRepliesUnreadCount} />
        </TabsContent>

        {/* Outlook Accounts Tab */}
        <TabsContent value="outlook" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="h-5 w-5 text-[#0078D4]" viewBox="0 0 21 21" fill="currentColor">
                      <path d="M0 3.449L8.543 2.233v8.074H0V3.449zm0 14.1l8.543 1.217V10.76H0v6.788zM9.543 18.95L21 20.62V10.76H9.543v8.19zm0-16.72v8.077H21V.38L9.543 2.23z"/>
                    </svg>
                    Outlook-Konten
                  </CardTitle>
                  <CardDescription>
                    Verbundene Microsoft/Outlook-Konten für automatische E-Mail-Synchronisierung
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchEmailAccounts}
                    disabled={loadingAccounts}
                  >
                    {loadingAccounts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleConnectOutlook} 
                    disabled={isConnectingOutlook}
                    className="bg-[#0078D4] hover:bg-[#106EBE] text-white"
                  >
                    {isConnectingOutlook ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Azure einrichten wie gehen wir vor?
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {emailAccounts.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <CloudCog className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Keine Outlook-Konten verbunden</p>
                    <p className="text-sm mb-4">Verbinde ein Outlook-Konto um E-Mails automatisch zu empfangen</p>
                    <Button 
                      onClick={handleConnectOutlook} 
                      disabled={isConnectingOutlook}
                      className="bg-[#0078D4] hover:bg-[#106EBE] text-white"
                    >
                      {isConnectingOutlook ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <svg className="h-4 w-4 mr-2" viewBox="0 0 21 21" fill="currentColor">
                          <path d="M0 3.449L8.543 2.233v8.074H0V3.449zm0 14.1l8.543 1.217V10.76H0v6.788zM9.543 18.95L21 20.62V10.76H9.543v8.19zm0-16.72v8.077H21V.38L9.543 2.23z"/>
                        </svg>
                      )}
                      Mit Outlook verbinden
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {emailAccounts.map((account) => (
                      <div key={account.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-[#0078D4]/10">
                              <svg className="h-5 w-5 text-[#0078D4]" viewBox="0 0 21 21" fill="currentColor">
                                <path d="M0 3.449L8.543 2.233v8.074H0V3.449zm0 14.1l8.543 1.217V10.76H0v6.788zM9.543 18.95L21 20.62V10.76H9.543v8.19zm0-16.72v8.077H21V.38L9.543 2.23z"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{account.email_address}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {account.status === "available" && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verfügbar
                                  </Badge>
                                )}
                                {account.status === "assigned" && (
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                                    <User className="h-3 w-3 mr-1" />
                                    Zugewiesen
                                  </Badge>
                                )}
                                {account.status === "inactive" && (
                                  <Badge variant="secondary">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Inaktiv
                                  </Badge>
                                )}
                                {account.profiles && (
                                  <Badge variant="outline" className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {account.profiles.first_name} {account.profiles.last_name}
                                  </Badge>
                                )}
                                {account.notes && account.notes.includes("Ehem. zugewiesen") && (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                                    <HistoryIcon className="h-3 w-3 mr-1" />
                                    {account.notes.split("\n").filter((n: string) => n.includes("Ehem. zugewiesen")).pop()}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Verbunden: {format(new Date(account.created_at), "dd.MM.yyyy", { locale: de })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Select
                              value={account.assigned_to || "unassigned"}
                              onValueChange={async (value) => {
                                const newAssignedTo = value === "unassigned" ? null : value;
                                const newStatus = newAssignedTo ? "assigned" : "available";
                                try {
                                  const { error } = await supabase
                                    .from("email_accounts")
                                    .update({ assigned_to: newAssignedTo, status: newStatus })
                                    .eq("id", account.id);
                                  if (error) throw error;
                                  toast.success(newAssignedTo ? "Mitarbeiter zugewiesen" : "Zuweisung entfernt");
                                  fetchEmailAccounts();
                                } catch (error: any) {
                                  toast.error(`Fehler: ${error.message}`);
                                }
                              }}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue>
                                  {account.profiles
                                    ? `${account.profiles.first_name || ""} ${account.profiles.last_name || ""}`.trim() || "(Kein Name)"
                                    : "Nicht zugewiesen"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                                {employees.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.first_name || ""} {emp.last_name || ""} {!emp.first_name && !emp.last_name && "(Kein Name)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditAccountDialog(account)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteEmailAccount(account.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generated Addresses Tab */}
        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Generierte E-Mail-Adressen</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchGeneratedEmails}
                  disabled={loadingGenerated}
                >
                  {loadingGenerated ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {generatedEmails.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Keine E-Mail-Adressen generiert</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setGenerateOpen(true)}
                      disabled={domains.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Erste Adresse erstellen
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {generatedEmails.map((email) => (
                      <div key={email.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{email.full_address}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant={email.is_active ? "default" : "secondary"}>
                                {email.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                              {email.profiles && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {email.profiles.first_name} {email.profiles.last_name}
                                </Badge>
                              )}
                              {(email as any).notes && (email as any).notes.includes("Ehem. zugewiesen") && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                                  <HistoryIcon className="h-3 w-3 mr-1" />
                                  {(email as any).notes.split("\n").filter((n: string) => n.includes("Ehem. zugewiesen")).pop()}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Erstellt: {format(new Date(email.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => copyToClipboard(email.full_address)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteGeneratedEmail(email.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Eigene Domains</CardTitle>
                  <CardDescription>
                    Füge Domains hinzu die mit Cloudflare Email Routing konfiguriert sind
                  </CardDescription>
                </div>
                <Button onClick={() => setAddDomainOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Domain hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {domains.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Keine Domains konfiguriert</p>
                    <p className="text-sm mb-4">Füge eine Domain hinzu um E-Mails zu empfangen</p>
                    <Button onClick={() => setAddDomainOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Erste Domain hinzufügen
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {domains.map((domain) => (
                      <div key={domain.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${domain.is_active ? "bg-green-500/20" : "bg-muted"}`}>
                              <Globe className={`h-4 w-4 ${domain.is_active ? "text-green-500" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <p className="font-medium">{domain.domain}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {domain.is_catch_all && (
                                  <Badge variant="outline" className="text-xs">Catch-All</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Hinzugefügt: {format(new Date(domain.created_at), "dd.MM.yyyy", { locale: de })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`active-${domain.id}`} className="text-sm">
                                {domain.is_active ? "Aktiv" : "Inaktiv"}
                              </Label>
                              <Switch
                                id={`active-${domain.id}`}
                                checked={domain.is_active}
                                onCheckedChange={() => toggleDomainActive(domain)}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteDomainId(domain.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Domain Dialog */}
      <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domain hinzufügen</DialogTitle>
            <DialogDescription>
              Füge eine Domain hinzu die bereits mit Cloudflare Email Routing konfiguriert ist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="meine-domain.xyz"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDomainOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={addDomain} disabled={addingDomain}>
              {addingDomain && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Email Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>E-Mail-Adresse generieren</DialogTitle>
            <DialogDescription>
              Erstelle eine neue E-Mail-Adresse und weise sie optional einem Mitarbeiter zu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                <SelectTrigger>
                  <SelectValue placeholder="Domain auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {domains.filter(d => d.is_active).map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="localPart">Lokaler Teil (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="localPart"
                  placeholder="task-abc123"
                  value={customLocalPart}
                  onChange={(e) => setCustomLocalPart(e.target.value)}
                />
                <Button 
                  variant="outline" 
                  onClick={() => setCustomLocalPart(generateRandomLocalPart())}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Leer lassen für automatisch generierte Adresse
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Mitarbeiter zuweisen (optional)
              </Label>
              <Select value={selectedEmployeeId} onValueChange={(val) => setSelectedEmployeeId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Zuweisung</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} {emp.email && `(${emp.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Der Mitarbeiter erhält dann alle E-Mails an diese Adresse (z.B. für laufende Aufträge)
              </p>
            </div>
            
            {selectedDomainId && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium">Vorschau:</p>
                <p className="text-sm font-mono">
                  {customLocalPart || "task-xxxxxxxx"}@{domains.find(d => d.id === selectedDomainId)?.domain}
                </p>
                {selectedEmployeeId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Zugewiesen an: {employees.find(e => e.id === selectedEmployeeId)?.first_name} {employees.find(e => e.id === selectedEmployeeId)?.last_name}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={generateEmail} disabled={generatingEmail || !selectedDomainId}>
              {generatingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen & Kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Setup Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cloudflare Email Routing Setup</DialogTitle>
            <DialogDescription>
              Folge diesen Schritten um E-Mails über deine Domain zu empfangen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>1</Badge>
                Domain bei Cloudflare hinzufügen
              </h4>
              <p className="text-sm text-muted-foreground">
                Füge deine Domain zu Cloudflare hinzu und ändere die Nameserver bei deinem Registrar.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>2</Badge>
                Email Routing aktivieren
              </h4>
              <p className="text-sm text-muted-foreground">
                Gehe zu Email → Email Routing → Destination addresses und aktiviere Email Routing.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>3</Badge>
                Catch-All Regel erstellen
              </h4>
              <p className="text-sm text-muted-foreground">
                Erstelle eine Catch-All Regel die alle E-Mails an einen Worker weiterleitet.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>4</Badge>
                Worker erstellen
              </h4>
              <p className="text-sm text-muted-foreground">
                Erstelle einen Cloudflare Worker der E-Mails an diesen Webhook weiterleitet:
              </p>
              <div className="flex gap-2">
                <Input 
                  value={getWebhookUrl()} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(getWebhookUrl())}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h4 className="font-medium">Worker Code Beispiel:</h4>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`export default {
  async email(message, env, ctx) {
    const payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      text: await new Response(message.raw).text(),
    };
    
    await fetch("${getWebhookUrl()}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}`}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
              Schließen
            </Button>
            <Button onClick={() => window.open("https://dash.cloudflare.com", "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Cloudflare Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Detail Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        setEmailDialogOpen(open);
        if (!open) {
          setReplyMode(false);
          setReplySubject("");
          setReplyBody("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {replyMode ? "Antwort verfassen" : (selectedEmail?.subject || "(Kein Betreff)")}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && !replyMode && (
            <div className="flex-1 overflow-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Von:</span>
                  <p className="font-medium">{selectedEmail.from_address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">An:</span>
                  <p className="font-medium">{selectedEmail.to_address}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Empfangen:</span>
                  <p>{format(new Date(selectedEmail.received_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {(() => {
                  // First, clean up any MIME content and decode
                  let htmlContent = cleanMimeContent(selectedEmail.body_html || '');
                  let textContent = cleanMimeContent(selectedEmail.body_text || '');
                  
                  // Additional QP decoding if still needed
                  if (isQuotedPrintable(htmlContent)) {
                    htmlContent = decodeQuotedPrintable(htmlContent);
                  }
                  if (isQuotedPrintable(textContent)) {
                    textContent = decodeQuotedPrintable(textContent);
                  }
                  
                  // If HTML content exists (and is actual HTML, not just text), render it
                  if (htmlContent && htmlContent.includes('<')) {
                    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
                  } else if (textContent && textContent.includes('<')) {
                    // body_text might actually contain HTML (misclassified)
                    return <div dangerouslySetInnerHTML={{ __html: textContent }} />;
                  } else {
                    // Plain text
                    return <pre className="whitespace-pre-wrap font-sans">{textContent || htmlContent}</pre>;
                  }
                })()}
              </div>
              
              {/* Show extracted links and codes from headers */}
              {(() => {
                const headers = selectedEmail.headers as { links_extracted?: string[]; codes_extracted?: string[] } | null;
                const allLinks = headers?.links_extracted || [];
                // Only show Coinfinity activation links
                const links = allLinks.filter(link => link.includes('login.coinfinity.co'));
                const codes = headers?.codes_extracted || [];
                
                if (links.length === 0 && codes.length === 0) return null;
                
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {codes.length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <Code className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Codes:</span>
                          <div className="flex flex-wrap gap-2">
                            {codes.map((code, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => {
                                  navigator.clipboard.writeText(code);
                                  toast.success("Code kopiert!");
                                }}
                              >
                                {code}
                                <Copy className="h-3 w-3 ml-1" />
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {links.length > 0 && (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Extrahierte Links:</span>
                          </div>
                          <div className="space-y-2">
                            {links.slice(0, 3).map((link, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-background/50 rounded border">
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline truncate flex-1"
                                  title={link}
                                >
                                  {link.length > 80 ? link.substring(0, 80) + '...' : link}
                                </a>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    toast.success("Link kopiert!");
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 flex-shrink-0"
                                  asChild
                                >
                                  <a href={link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              
              <Separator />
              
              <div className="flex justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openAdoptTemplateDialog('opening')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Für Eröffnungs-E-Mail
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openAdoptTemplateDialog('completion')}>
                    <Trophy className="h-4 w-4 mr-2" />
                    Für Abschluss-E-Mail
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={sendingToEmployee}
                    onClick={async () => {
                      if (!selectedEmail) return;
                      
                      setSendingToEmployee(true);
                      try {
                        // Auto-resolve employee from to_address - no manual selection needed
                        const { data, error: forwardError } = await supabase.functions.invoke("forward-internal-email", {
                          body: {
                            email_id: selectedEmail.id,
                            // employee_id NOT provided - server will auto-resolve from to_address
                          },
                        });

                        if (forwardError) throw forwardError;
                        
                        const result = data as { success?: boolean; employee_name?: string; to_address?: string; error?: string; message?: string };
                        
                        if (result?.error) {
                          toast.error(result.message || result.error);
                          return;
                        }

                        toast.success(`E-Mail an ${result?.employee_name || "Mitarbeiter"} geroutet!`, {
                          description: `An: ${result?.to_address || selectedEmail.to_address}`,
                        });
                      } catch (error: any) {
                        console.error("Error routing to employee:", error);
                        toast.error("Fehler beim Routen", {
                          description: error.message
                        });
                      } finally {
                        setSendingToEmployee(false);
                      }
                    }}
                  >
                    {sendingToEmployee ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <User className="h-4 w-4 mr-2" />
                    )}
                    An Mitarbeiter senden
                  </Button>
                </div>
                <Button onClick={startReply}>
                  <Reply className="h-4 w-4 mr-2" />
                  Antworten
                </Button>
              </div>
            </div>
          )}
          
          {selectedEmail && replyMode && (
            <div className="flex-1 overflow-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Von:</span>
                  <p className="font-medium">{selectedEmail.to_address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">An:</span>
                  <p className="font-medium">{selectedEmail.from_address}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reply-subject">Betreff</Label>
                <Input
                  id="reply-subject"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Betreff eingeben..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reply-body">Nachricht</Label>
                <Textarea
                  id="reply-body"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Deine Antwort..."
                  rows={8}
                  className="resize-none"
                />
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setReplyMode(false)}>
                  Abbrechen
                </Button>
                <Button onClick={sendReply} disabled={sendingReply || !replyBody.trim()}>
                  {sendingReply ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Senden
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Domain Confirmation */}
      <AlertDialog open={!!deleteDomainId} onOpenChange={(open) => !open && setDeleteDomainId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Domain löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen E-Mail-Adressen und empfangenen E-Mails werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Outlook Account Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Outlook-Konto bearbeiten</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateEmailAccount}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="account_email">E-Mail-Adresse</Label>
                <Input
                  id="account_email"
                  type="email"
                  value={accountFormData.email_address}
                  onChange={(e) => setAccountFormData((prev) => ({ ...prev, email_address: e.target.value }))}
                  placeholder="beispiel@outlook.de"
                  required
                />
              </div>
              <div>
                <Label htmlFor="account_assigned">Zugewiesen an</Label>
                <Select
                  value={accountFormData.assigned_to}
                  onValueChange={(value) => setAccountFormData((prev) => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name || ""} {emp.last_name || ""} {!emp.first_name && !emp.last_name && "(Kein Name)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="account_status">Status</Label>
                <Select
                  value={accountFormData.status}
                  onValueChange={(value) => setAccountFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Verfügbar</SelectItem>
                    <SelectItem value="assigned">Zugewiesen</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="account_notes">Notizen</Label>
                <Textarea
                  id="account_notes"
                  value={accountFormData.notes}
                  onChange={(e) => setAccountFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optionale Notizen..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit">Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adopt Template Dialog */}
      <Dialog open={adoptTemplateDialogOpen} onOpenChange={setAdoptTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEmailType === 'opening' ? (
                <Mail className="h-5 w-5 text-blue-500" />
              ) : (
                <Trophy className="h-5 w-5 text-amber-500" />
              )}
              E-Mail-Layout übernehmen
            </DialogTitle>
            <DialogDescription>
              Übernehmen Sie das Layout dieser E-Mail als Vorlage für{' '}
              <span className="font-medium">
                {selectedEmailType === 'opening' ? 'Auftragseröffnung' : 'Auftragsabschluss'}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Badge 
                variant={selectedEmailType === 'opening' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedEmailType('opening')}
              >
                <Mail className="h-3 w-3 mr-1" />
                Eröffnung
              </Badge>
              <Badge 
                variant={selectedEmailType === 'completion' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedEmailType('completion')}
              >
                <Trophy className="h-3 w-3 mr-1" />
                Abschluss
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Label>Auftrag auswählen</Label>
              <Select
                value={selectedTaskForTemplate}
                onValueChange={setSelectedTaskForTemplate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auftrag auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedEmail && (
              <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Von dieser E-Mail:</span>
                </div>
                <p className="text-muted-foreground truncate">
                  Betreff: {selectedEmail.subject || "(Kein Betreff)"}
                </p>
                <p className="text-muted-foreground truncate">
                  Absender: {selectedEmail.from_address}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdoptTemplateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={adoptEmailAsTemplate} 
              disabled={adoptingTemplate || !selectedTaskForTemplate}
            >
              {adoptingTemplate ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : selectedEmailType === 'opening' ? (
                <Mail className="h-4 w-4 mr-2" />
              ) : (
                <Trophy className="h-4 w-4 mr-2" />
              )}
              {selectedEmailType === 'opening' ? 'Als Eröffnung' : 'Als Abschluss'} übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Employee Dialog */}
      {/* Send to Employee Dialog - now removed, using direct action instead */}
    </div>
  );
}
