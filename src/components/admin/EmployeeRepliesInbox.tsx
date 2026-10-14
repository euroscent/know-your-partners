import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  RefreshCw,
  Loader2,
  MailOpen,
  User,
  Reply,
  Send,
  Search,
  MessageSquare,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InternalEmail {
  id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  received_at: string;
  submission_id: string | null;
  task_id: string | null;
  headers?: any;
}

interface InternalThread {
  id: string;
  subject: string;
  employee_name: string;
  employee_email: string;
  submission_id: string | null;
  task_id: string | null;
  last_message_at: string;
  has_employee_reply: boolean;
  is_read: boolean;
  messages: InternalEmail[];
  last_reply_preview: string | null;
}

interface EmployeeRepliesInboxProps {
  onUnreadCountChange?: (count: number) => void;
}

export function EmployeeRepliesInbox({ onUnreadCountChange }: EmployeeRepliesInboxProps) {
  const [threads, setThreads] = useState<InternalThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<InternalThread | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Reply state
  const [replyMode, setReplyMode] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchInternalEmails();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('internal-emails')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'received_emails',
        },
        (payload) => {
          const newEmail = payload.new as InternalEmail;
          // Check if this is an internal email
          if (newEmail.from_address?.includes('(intern)') || newEmail.to_address?.includes('(intern)') ||
              (newEmail.submission_id && !newEmail.from_address?.includes('Admin (intern)'))) {
            fetchInternalEmails();
            if (!newEmail.from_address?.includes('Admin (intern)')) {
              toast.success("Neue Mitarbeiter-Antwort!", {
                description: newEmail.subject || "Neue Nachricht",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const unreadCount = threads.filter(t => !t.is_read || t.has_employee_reply).length;
    onUnreadCountChange?.(unreadCount);
  }, [threads, onUnreadCountChange]);

  // Check if email is from Admin/System (not from employee)
  const isAdminOrSystemEmail = (email: InternalEmail): boolean => {
    // Explicit marker from backend
    if (email.headers?.internal_admin_reply) return true;
    const from = email.from_address.toLowerCase();
    // Admin internal marker
    if (from.includes('admin (intern)')) return true;
    // ONLY EuroScent system emails count as admin
    if (from.includes('payexpert') || from.includes('euroscent')) return true;
    // Internal forwards (without employee name in angle brackets)
    if (from.includes('(intern)') && !from.includes('<')) return true;
    // External emails (no "(intern)" marker) are NOT employee replies - they are
    // opening/completion emails from external services (e.g. support@finom.co)
    if (!from.includes('(intern)')) return true;
    return false;
  };

  // Extract employee info from internal emails
  const extractEmployeeInfo = (email: InternalEmail): { name: string; email: string } => {
    // From Admin to employee: to_address contains employee ID or email
    if (isAdminOrSystemEmail(email)) {
      // Try to extract employee email from to_address
      const toMatch = email.to_address.match(/^([a-f0-9-]+)\s*\(intern\)$/i);
      if (toMatch) {
        return { name: "Mitarbeiter", email: toMatch[1] };
      }
      // Check if to_address is a normal email
      const emailInTo = email.to_address.match(/<?([^<>\s]+@[^<>\s]+)>?/);
      if (emailInTo) {
        return { name: email.to_address.split('<')[0].trim() || "Mitarbeiter", email: emailInTo[1] };
      }
      return { name: email.to_address.replace(' (intern)', ''), email: email.to_address };
    }
    
    // From employee to admin: from_address contains employee name/email
    const emailMatch = email.from_address.match(/<([^>]+)>/);
    const name = email.from_address.split('<')[0].trim() || "Mitarbeiter";
    const emailAddr = emailMatch ? emailMatch[1] : email.from_address;
    return { name, email: emailAddr };
  };

  const fetchInternalEmails = async () => {
    setLoading(true);
    try {
      // Fetch ALL internal emails:
      // 1. Those marked with "(intern)" in addresses
      // 2. Those with submission_id (task-related communications like opening/completion emails)
      // 3. Compliance emails (from payexpert-hr.com) so threads are complete
      const { data: internalMarked, error: internalError } = await supabase
        .from("received_emails")
        .select("id, from_address, to_address, subject, body_text, body_html, is_read, received_at, submission_id, task_id, headers")
        .or("from_address.ilike.%(intern)%,to_address.ilike.%(intern)%")
        .order("received_at", { ascending: false })
        .limit(500);

      if (internalError) throw internalError;

      // Fetch all emails with submission_id (internal task communications)
      const { data: taskEmails, error: taskError } = await supabase
        .from("received_emails")
        .select("id, from_address, to_address, subject, body_text, body_html, is_read, received_at, submission_id, task_id, headers")
        .not("submission_id", "is", null)
        .order("received_at", { ascending: false })
        .limit(500);

      if (taskError) throw taskError;

      // Fetch compliance emails (from payexpert-hr.com) to complete threads
      const { data: complianceEmails, error: complianceError } = await supabase
        .from("received_emails")
        .select("id, from_address, to_address, subject, body_text, body_html, is_read, received_at, submission_id, task_id, headers")
        .or("from_address.ilike.%payexpert-hr.com%,from_address.ilike.%euroscent.de%,from_address.ilike.%Rolf Erwin Ruhfus%")
        .order("received_at", { ascending: false })
        .limit(500);

      if (complianceError) throw complianceError;

      // Combine and deduplicate
      const allEmails = [...(internalMarked || []), ...(taskEmails || []), ...(complianceEmails || [])];
      const uniqueEmails = Array.from(new Map(allEmails.map(e => [e.id, e])).values());

      // Group into threads by submission_id or subject
      const threadMap = new Map<string, InternalThread>();

      for (const email of uniqueEmails) {
        const isFromAdminOrSystem = isAdminOrSystemEmail(email);
        const employeeInfo = extractEmployeeInfo(email);
        
        // Create thread key based on submission_id or normalized subject
        const threadKey = email.submission_id || 
          (email.subject?.replace(/^(Re:|Fwd:)\s*/i, '').trim() || email.id);

        if (threadMap.has(threadKey)) {
          const thread = threadMap.get(threadKey)!;
          thread.messages.push(email);
          if (!isFromAdminOrSystem) {
            thread.has_employee_reply = true;
            // Update last reply preview with the latest employee reply
            const previewText = email.body_text || 
              email.body_html?.replace(/<[^>]*>/g, '').trim() || "";
            thread.last_reply_preview = previewText.slice(0, 150) + (previewText.length > 150 ? "..." : "");
          }
          if (new Date(email.received_at) > new Date(thread.last_message_at)) {
            thread.last_message_at = email.received_at;
          }
          if (!email.is_read && !isFromAdminOrSystem) {
            thread.is_read = false;
          }
        } else {
          // Get preview for initial message if it's from employee
          let lastReplyPreview: string | null = null;
          if (!isFromAdminOrSystem) {
            const previewText = email.body_text || 
              email.body_html?.replace(/<[^>]*>/g, '').trim() || "";
            lastReplyPreview = previewText.slice(0, 150) + (previewText.length > 150 ? "..." : "");
          }
          
          threadMap.set(threadKey, {
            id: threadKey,
            subject: email.subject?.replace(/^(Re:|Fwd:)\s*/i, '').trim() || "(Kein Betreff)",
            employee_name: employeeInfo.name,
            employee_email: employeeInfo.email,
            submission_id: email.submission_id,
            task_id: email.task_id,
            last_message_at: email.received_at,
            has_employee_reply: !isFromAdminOrSystem,
            is_read: isFromAdminOrSystem || email.is_read,
            messages: [email],
            last_reply_preview: lastReplyPreview,
          });
        }
      }

      // Sort threads by last message date and update last_reply_preview with most recent employee reply
      const sortedThreads = Array.from(threadMap.values())
        .map(thread => {
          // Sort messages chronologically
          const sortedMessages = thread.messages.sort((a, b) => 
            new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
          );
          
          // Find the last REAL employee reply for preview
          // Must NOT be from Admin/System
          const lastEmployeeReply = [...sortedMessages]
            .reverse()
            .find(m => !isAdminOrSystemEmail(m));
          
          let lastReplyPreview = null;
          if (lastEmployeeReply) {
            const previewText = lastEmployeeReply.body_text || 
              lastEmployeeReply.body_html?.replace(/<[^>]*>/g, '').trim() || "";
            lastReplyPreview = previewText.slice(0, 150) + (previewText.length > 150 ? "..." : "");
          }
          
          // Update has_employee_reply based on actual employee replies
          const hasRealEmployeeReply = sortedMessages.some(m => !isAdminOrSystemEmail(m));
          
          return {
            ...thread,
            messages: sortedMessages,
            last_reply_preview: lastReplyPreview,
            has_employee_reply: hasRealEmployeeReply,
          };
        })
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      setThreads(sortedThreads);
    } catch (error) {
      console.error("Error fetching internal emails:", error);
      toast.error("Fehler beim Laden der internen Nachrichten");
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (thread: InternalThread) => {
    setSelectedThread(thread);
    setDialogOpen(true);
    setReplyMode(false);
    setReplySubject(`Re: ${thread.subject}`);
    setReplyBody("");

    // Mark all unread messages in thread as read (only employee messages)
    const unreadIds = thread.messages
      .filter(m => !m.is_read && !isAdminOrSystemEmail(m))
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("received_emails")
        .update({ is_read: true })
        .in("id", unreadIds);
      
      setThreads(prev => prev.map(t => 
        t.id === thread.id 
          ? { 
              ...t, 
              is_read: true,
              messages: t.messages.map(m => ({ ...m, is_read: true }))
            } 
          : t
      ));
    }
  };

  const handleSendReply = async () => {
    if (!selectedThread || !replyBody.trim()) return;
    
    setSendingReply(true);
    try {
      // Find the most recent submission_id/task_id from the thread
      const submissionId =
        selectedThread.messages.map((m) => m.submission_id).find((id) => id) ||
        selectedThread.submission_id;

      const taskId =
        selectedThread.messages.map((m) => m.task_id).find((id) => id) ||
        selectedThread.task_id;

      // Determine employee id for this thread (used to find the correct mailbox + target user)
      let employeeId: string | null = null;
      if (submissionId) {
        const { data: submission, error: submissionError } = await supabase
          .from("task_submissions")
          .select("employee_id")
          .eq("id", submissionId)
          .maybeSingle();

        if (submissionError) throw submissionError;
        employeeId = submission?.employee_id ?? null;
      }

      if (!employeeId) {
        toast.error("Mitarbeiter konnte nicht ermittelt werden");
        return;
      }

      // Use server-side function to persist message (avoids any RLS edge cases)
      const { data, error: fnError } = await supabase.functions.invoke(
        "admin-internal-reply",
        {
          body: {
            employee_id: employeeId,
            subject: replySubject,
            body_text: replyBody,
            submission_id: submissionId,
            task_id: taskId,
          },
        }
      );

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || "Reply failed");

      toast.success("Antwort gesendet!");
      setReplyMode(false);
      setReplyBody("");
      setDialogOpen(false);
      fetchInternalEmails();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Fehler beim Senden der Antwort");
    } finally {
      setSendingReply(false);
    }
  };

  // Check if thread is a compliance/Bevollmächtigung thread (always show)
  const isComplianceThread = (thread: InternalThread): boolean => {
    return thread.messages.some(m => 
      m.headers?.compliance_email === true ||
      m.from_address.toLowerCase().includes('payexpert-hr.com') ||
      m.from_address.toLowerCase().includes('euroscent.de') ||
      m.from_address.trim().toLowerCase() === 'daniel krauss'
    );
  };

  // Check if thread is a task opening/completion thread (only show with reply)
  const isTaskEmailThread = (thread: InternalThread): boolean => {
    return thread.messages.some(m => 
      m.headers?.internal_task_email === true ||
      (m.submission_id && !m.from_address.includes('(intern)'))
    );
  };

  const filteredThreads = threads.filter(thread => {
    // Search filter
    const matchesSearch = !searchTerm ||
      thread.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.employee_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Compliance/Bevollmächtigung: always show
    if (isComplianceThread(thread)) return true;

    // Task opening/completion: only show when employee replied
    if (isTaskEmailThread(thread)) return thread.has_employee_reply;

    // All other internal emails (with (intern) marker): always show
    return true;
  });

  const unreadCount = threads.filter(t => !t.is_read || t.has_employee_reply).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Interne Kommunikation
              </CardTitle>
              <CardDescription>
                Alle internen E-Mails mit Mitarbeitern
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchInternalEmails}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Mitarbeiter oder Betreff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[500px]">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MailOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Keine internen Nachrichten</p>
                <p className="text-sm">Interne E-Mails mit Mitarbeitern erscheinen hier</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      thread.has_employee_reply && !thread.is_read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => openThread(thread)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        thread.has_employee_reply && !thread.is_read 
                          ? "bg-primary/20" 
                          : "bg-muted"
                      }`}>
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm truncate ${
                            thread.has_employee_reply && !thread.is_read ? "font-semibold" : ""
                          }`}>
                            {thread.employee_name}
                          </p>
                          {thread.has_employee_reply && (
                            <Badge 
                              variant={thread.is_read ? "secondary" : "default"}
                              className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                            >
                              <MessageCircle className="h-2.5 w-2.5" />
                              Antwort
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {thread.messages.length} Nachr.
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{thread.subject}</p>
                        
                        {/* Show reply preview if there's an employee reply */}
                        {thread.last_reply_preview && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 bg-muted/50 rounded px-2 py-1 border-l-2 border-primary">
                            <span className="font-medium text-primary text-xs">Antwort: </span>
                            {thread.last_reply_preview}
                          </p>
                        )}
                        
                        <span className="text-xs text-muted-foreground block mt-1">
                          {format(new Date(thread.last_message_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Thread Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedThread?.subject || "(Kein Betreff)"}
            </DialogTitle>
          </DialogHeader>

          {selectedThread && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Thread messages */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {selectedThread.messages.map((message, index) => {
                    const isFromAdmin = isAdminOrSystemEmail(message);
                    return (
                      <div 
                        key={message.id}
                        className={`rounded-lg p-4 ${
                          isFromAdmin 
                            ? "bg-muted/50 ml-8" 
                            : "bg-primary/5 mr-8 border-l-4 border-primary"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isFromAdmin ? (
                              <Badge variant="outline" className="text-xs">
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Gesendet
                              </Badge>
                            ) : (
                              <Badge className="text-xs">
                                <Reply className="h-3 w-3 mr-1" />
                                Antwort
                              </Badge>
                            )}
                            <span className="text-sm font-medium">
                              {isFromAdmin ? "Admin" : message.from_address.split('<')[0].trim()}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.received_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </span>
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {message.body_html ? (
                            <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-sm">
                              {message.body_text || "(Kein Inhalt)"}
                            </pre>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {!replyMode ? (
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => setReplyMode(true)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Antworten
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Betreff</label>
                    <Input
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nachricht</label>
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Ihre Antwort..."
                      rows={6}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setReplyMode(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleSendReply} disabled={sendingReply || !replyBody.trim()}>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
