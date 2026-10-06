import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Mail, MailOpen, Send, Reply, Loader2, Calendar, Eye, Download, Check } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "@/lib/toast-stub";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { wrapEmailHtmlForPreview } from "@/lib/emailPreview";

interface ReceivedEmail {
  id: string;
  to_address: string;
  from_address: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  received_at: string;
  submission_id: string | null;
  task_id: string | null;
}

interface EmployeeEmailInboxProps {
  userId: string;
}

export const EmployeeEmailInbox = ({ userId }: EmployeeEmailInboxProps) => {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchEmails();

    // Realtime subscription for new emails
    const channel = supabase
      .channel('employee-emails')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'received_emails' },
        (payload) => {
          console.log("New email received:", payload);
          fetchEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchEmails = async () => {
    try {
      // Get the user's profile email for general (non-submission) emails
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      const userEmail = profile?.email || "";

      // Get the user's submissions to find task-related emails
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("id")
        .eq("employee_id", userId);

      const submissionIds = (submissions || []).map(s => s.id);

      // Nur E-Mails des aktuellen Monats anzeigen.
      // Vergangene Monate werden für den Mitarbeiter ausgeblendet ("Reset" zum Monatswechsel).
      const nowDate = new Date();
      const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).toISOString();

      // Fetch emails matching EITHER:
      // 1) submission_id belongs to this employee (task emails)
      // 2) to_address matches the user's email (general/compliance emails)
      let query = supabase
        .from("received_emails")
        .select("id, to_address, from_address, subject, body_html, body_text, is_read, received_at, submission_id, task_id")
        .gte("received_at", monthStart)
        .order("received_at", { ascending: false });

      if (submissionIds.length > 0 && userEmail) {
        query = query.or(`submission_id.in.(${submissionIds.join(",")}),to_address.eq.${userEmail}`);
      } else if (submissionIds.length > 0) {
        query = query.in("submission_id", submissionIds);
      } else if (userEmail) {
        query = query.eq("to_address", userEmail);
      } else {
        setEmails([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filter: Only show system emails, internal messages "(intern)",
      // and admin-forwarded emails. Normal external emails require explicit admin forwarding.
      const filtered = (data || []).filter(email => {
        const from = (email.from_address || "").toLowerCase();
        // Legacy system emails
        if (from.includes("payexpert-hr.com")) return true;
        // System emails without any address (e.g. Compliance / Geschäftsführung)
        if (from && !from.includes("@")) return true;
        // Internal replies and admin-forwarded emails
        if (from.includes("(intern)")) return true;
        return false;
      });
      
      setEmails(filtered);
    } catch (error) {
      console.error("Error fetching emails:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEmail = async (email: ReceivedEmail) => {
    setSelectedEmail(email);

    // Mark as read if not already
    if (!email.is_read) {
      await supabase
        .from("received_emails")
        .update({ is_read: true })
        .eq("id", email.id);
      
      setEmails(prev => prev.map(e => 
        e.id === email.id ? { ...e, is_read: true } : e
      ));
    }
  };

  // Absender-Anzeige ohne E-Mail-Adresse
  const displaySender = (value: string | null | undefined) => {
    if (!value) return "Unbekannt";
    return value
      .replace(/<[^>]*>/g, "")
      .replace(/[^\s<>]+@[^\s<>]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "System";
  };

  const CONFIRM_TEXT =
    "Hiermit bestätige ich den Erhalt dieser E-Mail sowie mein rechtsverbindliches Einverständnis mit den vorstehenden Regelungen.";

  const handleConfirmReceipt = () => handleSendReply(CONFIRM_TEXT, `Bestätigung: ${selectedEmail?.subject || "Keine Betreffzeile"}`);

  const handleSendReply = async (overrideBody?: string, overrideSubject?: string) => {
    const bodyText = (overrideBody ?? replyBody).trim();
    const subjectText = overrideSubject ?? replySubject;

    if (!selectedEmail || !bodyText) {
      toast.error("Bitte geben Sie eine Nachricht ein");
      return;
    }

    setSendingReply(true);
    try {
      // Get employee profile for sender name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .single();

      const employeeName = profile 
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Mitarbeiter"
        : "Mitarbeiter";

      // Determine the correct *task mailbox* address for this specific task/submission.
      // IMPORTANT: Never use the registration email as sender.
      // Prefer the mailbox that was used as sender of the task email (stored in received_emails.from_address).
      let employeeEmail: string | null = null;

      const extractEmail = (value: string | null | undefined): string | null => {
        if (!value) return null;
        const match = value.match(/<([^>]+)>/);
        if (match?.[1]) return match[1].trim();
        const plain = value.trim();
        // If it's already a plain email address
        if (/^[^\s<>]+@[^\s<>]+$/.test(plain)) return plain;
        // Otherwise, try to find any email-like token
        const token = plain.match(/([^\s<>]+@[^\s<>]+)/);
        return token?.[1] || null;
      };

      // Priority order:
      // 1) Custom/generated email for this submission
      // 2) Task-assigned Outlook (via tasks.email_account_id)
      // 3) Generally assigned Outlook (email_accounts.assigned_to)
      // 4) Extract from received email's from_address (best effort)

      // 1. Check for generated email linked to this submission (custom emails)
      if (selectedEmail.submission_id) {
        const { data: generatedEmail } = await supabase
          .from("generated_emails")
          .select("full_address")
          .eq("submission_id", selectedEmail.submission_id)
          .eq("is_active", true)
          .maybeSingle();

        if (generatedEmail?.full_address) {
          employeeEmail = generatedEmail.full_address;
        }
      }

      // 2. Check if the task has a specific email account assigned
      if (!employeeEmail && selectedEmail.task_id) {
        const { data: task } = await supabase
          .from("tasks")
          .select("email_account_id")
          .eq("id", selectedEmail.task_id)
          .maybeSingle();

        if (task?.email_account_id) {
          const { data: taskEmailAccount } = await supabase
            .from("email_accounts")
            .select("email_address")
            .eq("id", task.email_account_id)
            .maybeSingle();

          if (taskEmailAccount?.email_address) {
            employeeEmail = taskEmailAccount.email_address;
          }
        }
      }

      // 3. Fallback: Check for generally assigned Outlook email
      if (!employeeEmail) {
        const { data: emailAccount } = await supabase
          .from("email_accounts")
          .select("email_address")
          .eq("assigned_to", userId)
          .eq("status", "assigned")
          .maybeSingle();

        if (emailAccount?.email_address) {
          employeeEmail = emailAccount.email_address;
        }
      }

      // 4) For compliance/general emails (no submission_id, no task_id), use profile email
      if (!employeeEmail && !selectedEmail.submission_id && !selectedEmail.task_id) {
        employeeEmail = profile?.email || null;
      }

      // 5) Last resort (no DB permissions needed): use mailbox from the received task email sender
      // e.g. "PayExpert <gas.cheese@outlook.com>" or "info@bbva.de"
      if (!employeeEmail) {
        const fromMailbox = extractEmail(selectedEmail.from_address);
        if (fromMailbox) employeeEmail = fromMailbox;
      }

      // Hard requirement for task emails: only Outlook/custom mailbox is allowed as sender
      if (!employeeEmail) {
        toast.error(
          "Keine Absender-Mailbox zugewiesen. Bitte zuerst eine Outlook- oder Custom-Domain-E-Mail dem Auftrag/Mitarbeiter zuweisen."
        );
        return;
      }

      // Store reply internally in received_emails (visible in E-Mail-Zentrale for admins)
      // Use the original email's submission_id/task_id for context
      const { error: insertError } = await supabase
        .from("received_emails")
        .insert({
          to_address: selectedEmail.from_address,
          from_address: `${employeeName} <${employeeEmail}> (intern)`,
          subject: subjectText,
          body_text: bodyText,
          body_html: `<div style="font-family: sans-serif; padding: 16px;">
            <p style="margin-bottom: 16px;">${bodyText.replace(/\n/g, '<br/>')}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              Antwort von ${employeeName} auf: "${selectedEmail.subject || 'Keine Betreffzeile'}"
            </p>
          </div>`,
          received_at: new Date().toISOString(),
          is_read: false,
          submission_id: selectedEmail.submission_id,
          task_id: selectedEmail.task_id,
        });

      if (insertError) throw insertError;

      // Create admin notification for the reply
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        // Create notification for all admins
        const notifications = adminRoles.map(admin => ({
          admin_id: admin.user_id,
          user_id: userId,
          type: "email_reply",
          message: `${employeeName} hat eine E-Mail bestätigt: "${subjectText}"`,
          reference_id: selectedEmail.id,
          is_read: false,
        }));

        await supabase.from("admin_notifications").insert(notifications);
      }

      toast.success("Bestätigung erfolgreich übermittelt!");
      setShowReplyDialog(false);
      setSelectedEmail(null);
      // Refresh emails to show the reply in the inbox
      fetchEmails();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error(error?.message ? `Fehler: ${error.message}` : "Fehler beim Senden der Antwort");
    } finally {
      setSendingReply(false);
    }
  };

  const unreadCount = emails.filter(e => !e.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            E-Mail Postfach
          </CardTitle>
          <CardDescription>
            Ihre empfangenen E-Mails zu Ihren Aufträgen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine E-Mails vorhanden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => handleOpenEmail(email)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${
                    !email.is_read ? "bg-primary/5 border-primary/20" : "bg-background"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {email.is_read ? (
                        <MailOpen className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Mail className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate ${!email.is_read ? "font-semibold" : "font-medium"}`}>
                          {email.subject || "Keine Betreffzeile"}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(email.received_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        Von: {displaySender(email.from_address)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail && !showReplyDialog} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedEmail?.subject || "Keine Betreffzeile"}
            </DialogTitle>
            <DialogDescription>
              Von: {displaySender(selectedEmail?.from_address)} • {selectedEmail?.received_at && format(new Date(selectedEmail.received_at), "dd. MMMM yyyy, HH:mm", { locale: de })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-auto">
            {selectedEmail?.body_html ? (
              <iframe
                srcDoc={wrapEmailHtmlForPreview(selectedEmail.body_html, "https://payexpert.space")}
                className="w-full min-h-[400px] border-0 rounded-lg bg-white"
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                referrerPolicy="no-referrer"
                style={{ height: '400px' }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm p-4">
                {selectedEmail?.body_text || "Kein Inhalt"}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedEmail(null)}>
              Schließen
            </Button>
            <Button
              variant="secondary"
              disabled={generatingPdf}
              onClick={async () => {
                if (!selectedEmail) return;
                setGeneratingPdf(true);
                
                try {
                  // Create a temporary container for the email content
                  const container = document.createElement("div");
                  container.style.position = "absolute";
                  container.style.left = "-9999px";
                  container.style.top = "0";
                  container.style.width = "794px"; // A4 width at 96dpi
                  container.style.padding = "40px";
                  container.style.backgroundColor = "#ffffff";
                  container.style.fontFamily = "Arial, sans-serif";
                  
                  // Build the email HTML with header
                  const headerHtml = `
                    <div style="margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
                      <h1 style="font-size: 20px; font-weight: bold; margin: 0 0 8px 0; color: #111827;">
                        ${selectedEmail.subject || "Keine Betreffzeile"}
                      </h1>
                      <p style="font-size: 12px; color: #6b7280; margin: 0;">
                        Von: ${displaySender(selectedEmail.from_address)}
                      </p>
                      <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">
                        Datum: ${format(new Date(selectedEmail.received_at), "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr
                      </p>
                    </div>
                  `;
                  
                  // Use body_html if available, otherwise use formatted body_text
                  const bodyContent = selectedEmail.body_html 
                    ? selectedEmail.body_html 
                    : `<div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${selectedEmail.body_text || "Kein Inhalt"}</div>`;
                  
                  container.innerHTML = headerHtml + `<div style="font-size: 14px; line-height: 1.6;">${bodyContent}</div>`;
                  document.body.appendChild(container);
                  
                  // Render to canvas
                  const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: "#ffffff",
                  });
                  
                  document.body.removeChild(container);
                  
                  // Create PDF from canvas
                  const imgData = canvas.toDataURL("image/png");
                  const pdf = new jsPDF({
                    orientation: "portrait",
                    unit: "mm",
                    format: "a4",
                  });
                  
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgWidth = pdfWidth;
                  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                  
                  let heightLeft = imgHeight;
                  let position = 0;
                  
                  // Add first page
                  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                  heightLeft -= pdfHeight;
                  
                  // Add additional pages if needed
                  while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                  }
                  
                  pdf.save(`email-${selectedEmail.id.slice(0, 8)}.pdf`);
                  toast.success("PDF heruntergeladen");
                } catch (error) {
                  console.error("PDF generation error:", error);
                  toast.error("Fehler beim Erstellen der PDF");
                } finally {
                  setGeneratingPdf(false);
                }
              }}
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Als PDF
            </Button>
            <Button onClick={handleConfirmReceipt} disabled={sendingReply}>
              {sendingReply ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};
