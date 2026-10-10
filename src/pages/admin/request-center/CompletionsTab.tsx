import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Mail, Loader2, Send, FileText, Eye, Settings, Trophy, Rocket, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast-stub";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TipTapEditor } from "@/components/email-sender/TipTapEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { EditableHtmlPreview } from "@/components/admin/EditableHtmlPreview";
import { wrapEmailHtmlForPreview } from "@/lib/emailPreview";

interface CompletionsTabProps {
  onUpdate?: () => void;
  showTemplates?: boolean;
}

interface AdminData {
  email?: string;
  phone?: string;
  login?: string;
  password?: string;
  ident_link?: string;
  notes?: string;
  [key: string]: string | undefined;
}

interface CompletedSubmission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string;
  admin_data?: AdminData | null;
  step_responses?: Record<string, unknown> | null;
  tasks: {
    id: string;
    title: string;
    description?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    template_id?: string | null;
  } | null;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
  completion_email_sent?: {
    id: string;
    sent_at: string;
    subject: string;
  } | null;
}

interface TaskEmailTemplate {
  id: string;
  task_id: string;
  email_type: 'opening' | 'completion';
  subject: string;
  content: string;
  is_active: boolean;
  sender_email: string | null;
  sender_name: string | null;
}

interface TaskInfo {
  id: string;
  title: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  send_opening_email?: boolean;
  send_completion_email?: boolean;
}

type EmailType = 'opening' | 'completion';

// Helper to detect complex HTML that should use raw HTML mode
const isComplexEmailHtml = (html: string) => {
  return /<html>|<style>|<table|<head|<!DOCTYPE/i.test(html);
};

const CompletionsTab = ({ onUpdate, showTemplates = false }: CompletionsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<CompletedSubmission[]>([]);
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<CompletedSubmission | null>(null);
  
  // Templates: keyed by `${task_id}_${email_type}`
  const [templates, setTemplates] = useState<Record<string, TaskEmailTemplate>>({});
  
  const [editingTemplate, setEditingTemplate] = useState<{ 
    taskId: string; 
    taskTitle: string; 
    emailType: EmailType;
  } | null>(null);
  
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [templateSenderEmail, setTemplateSenderEmail] = useState("office@euroscent.de");
  const [templateSenderName, setTemplateSenderName] = useState("EuroScent");
  const [contentMode, setContentMode] = useState<'visual' | 'html'>('visual');
  
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; content: string } | null>(null);
  const [demoDataPreview, setDemoDataPreview] = useState<CompletedSubmission | null>(null);
  const [taskEmail, setTaskEmail] = useState<string | null>(null);
  const [loadingTaskEmail, setLoadingTaskEmail] = useState(false);
  const [activeCompletionTemplate, setActiveCompletionTemplate] = useState<TaskEmailTemplate | null>(null);
  const [generatingSubject, setGeneratingSubject] = useState(false);

  useEffect(() => {
    fetchCompletedSubmissions();
    fetchTemplates();
    fetchAllTasks();

    const channel = supabase
      .channel('completed-submissions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_submissions' },
        () => {
          fetchCompletedSubmissions();
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCompletedSubmissions = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminIds = adminRoles?.map(r => r.user_id) || [];

    let query = supabase
      .from("task_submissions")
      .select("*, admin_data, tasks!inner (id, title, description, logo_url, primary_color, secondary_color, accent_color, template_id)")
      .in("status", ["approved"])
      .order("reviewed_at", { ascending: false });

    if (adminIds.length > 0) {
      query = query.not("employee_id", "in", `(${adminIds.join(",")})`);
    }

    const { data: submissionsData, error } = await query;

    if (error) {
      console.error("Error fetching completed submissions:", error);
      toast.error("Fehler beim Laden der Auftragsabschlüsse");
      setLoading(false);
      return;
    }

    const employeeIds = submissionsData?.map(s => s.employee_id) || [];
    const submissionIds = submissionsData?.map(s => s.id) || [];
    
    const [profilesResult, emailsSentResult] = await Promise.all([
      employeeIds.length > 0 
        ? supabase.from("profiles").select("id, first_name, last_name, email").in("id", employeeIds)
        : { data: [] as any[] },
      submissionIds.length > 0
        ? supabase.from("task_completion_emails_sent").select("id, submission_id, sent_at, subject").in("submission_id", submissionIds)
        : { data: [] as any[] }
    ]);

    const profilesMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p] as [string, any]));
    const emailsSentMap = new Map((emailsSentResult.data || []).map((e: any) => [e.submission_id, e] as [string, any]));
    
    const enrichedSubmissions = submissionsData?.map(sub => ({
      ...sub,
      profiles: profilesMap.get(sub.employee_id) || {
        first_name: "Unbekannt",
        last_name: "",
        email: ""
      },
      completion_email_sent: emailsSentMap.get(sub.id) || null
    })) || [];

    setSubmissions(enrichedSubmissions as any);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("task_email_templates")
      .select("*");

    if (!error && data) {
      const templatesMap: Record<string, TaskEmailTemplate> = {};
      data.forEach(t => {
        const key = `${t.task_id}_${t.email_type}`;
        templatesMap[key] = t as TaskEmailTemplate;
      });
      setTemplates(templatesMap);
    }
  };

  const fetchAllTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, logo_url, primary_color, secondary_color, accent_color, send_opening_email, send_completion_email")
      .is("assigned_to", null)
      .order("title", { ascending: true });

    if (!error && data) {
      setAllTasks(data);
    }
  };

  const handleToggleEmail = async (taskId: string, field: 'send_opening_email' | 'send_completion_email', value: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value } as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    toast.success(value ? "Automatischer Versand aktiviert" : "Automatischer Versand deaktiviert");
  };

  const getTemplateKey = (taskId: string, emailType: EmailType) => `${taskId}_${emailType}`;

  const resolveCompletionTemplate = async (
    submission: CompletedSubmission,
    localTemplates: Record<string, TaskEmailTemplate>
  ): Promise<TaskEmailTemplate | null> => {
    const templateId = submission.tasks?.template_id;
    const taskId = submission.task_id;

    // 1) local cache by templateId -> taskId
    let template: TaskEmailTemplate | null = templateId
      ? localTemplates[getTemplateKey(templateId, "completion")] || null
      : null;
    if (!template) template = localTemplates[getTemplateKey(taskId, "completion")] || null;

    // 2) DB by templateId/taskId
    if (!template) {
      const idsToTry = [templateId, taskId].filter(Boolean) as string[];
      if (idsToTry.length > 0) {
        const { data: dbTemplates } = await supabase
          .from("task_email_templates")
          .select("*")
          .eq("email_type", "completion")
          .eq("is_active", true)
          .in("task_id", idsToTry)
          .order("updated_at", { ascending: false });

        if (dbTemplates && dbTemplates.length > 0) {
          template = dbTemplates[0] as TaskEmailTemplate;
        }
      }
    }

    // 3) DB by task title (duplicate task rows like "bonify")
    if (!template && submission.tasks?.title) {
      const title = submission.tasks.title.trim();
      if (title) {
        const { data: matchingTasks } = await supabase
          .from("tasks")
          .select("id")
          .ilike("title", title);

        const matchingIds = (matchingTasks || []).map((t) => t.id).filter(Boolean) as string[];
        if (matchingIds.length > 0) {
          const { data: titleTemplates } = await supabase
            .from("task_email_templates")
            .select("*")
            .eq("email_type", "completion")
            .eq("is_active", true)
            .in("task_id", matchingIds)
            .order("updated_at", { ascending: false });

          if (titleTemplates && titleTemplates.length > 0) {
            template = titleTemplates[0] as TaskEmailTemplate;
          }
        }
      }
    }

    return template;
  };

  const getDefaultEmailContent = (submission: CompletedSubmission) => {
    const firstName = submission.profiles.first_name || "Mitarbeiter";
    const taskTitle = submission.tasks?.title || "Auftrag";
    
    return `<p>Hallo ${firstName},</p><p>herzlichen Glückwunsch! Sie haben den Auftrag <strong>"${taskTitle}"</strong> erfolgreich abgeschlossen.</p><p>Vielen Dank für Ihre hervorragende Arbeit. Ihr Engagement wird sehr geschätzt.</p><p>Die Vergütung wird in Kürze auf Ihr Konto überwiesen.</p><p>Mit freundlichen Grüßen,<br/><strong>Das EuroScent HR-Team</strong></p>`;
  };

  const getDefaultOpeningContent = (taskTitle: string) => {
    return `<p>Hallo {vorname},</p><p>Ihr Auftrag <strong>"{auftrag}"</strong> wurde erfolgreich eröffnet.</p><p>Sie können nun mit der Bearbeitung beginnen. Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen,<br/><strong>Das EuroScent HR-Team</strong></p>`;
  };

  const getDefaultCompletionContent = (taskTitle: string) => {
    return `<p>Hallo {vorname},</p><p>herzlichen Glückwunsch! Sie haben den Auftrag <strong>"{auftrag}"</strong> erfolgreich abgeschlossen.</p><p>Vielen Dank für Ihre hervorragende Arbeit. Ihr Engagement wird sehr geschätzt.</p><p>Die Vergütung wird in Kürze auf Ihr Konto überwiesen.</p><p>Mit freundlichen Grüßen,<br/><strong>Das EuroScent HR-Team</strong></p>`;
  };

  const handleOpenEmailDialog = async (submission: CompletedSubmission) => {
    setSelectedSubmission(submission);
    setTaskEmail(null);
    setLoadingTaskEmail(true);
    setActiveCompletionTemplate(null);
    
    // Fetch the email that is actually used for this order.
    // Priority:
    // 1) Outlook mailbox assigned to the task (or its template)
    // 2) Generated email for this submission
    // 3) Outlook mailbox assigned to the employee
    try {
      let resolvedTaskEmail: string | null = null;

      // 1) Outlook mailbox assigned to the task (or template task)
      const { data: taskInfo } = await supabase
        .from("tasks")
        .select("email_account_id, template_id")
        .eq("id", submission.task_id)
        .maybeSingle();

      let emailAccountId: string | null = taskInfo?.email_account_id ?? null;

      if (!emailAccountId && taskInfo?.template_id) {
        const { data: templateTaskInfo } = await supabase
          .from("tasks")
          .select("email_account_id")
          .eq("id", taskInfo.template_id)
          .maybeSingle();

        emailAccountId = templateTaskInfo?.email_account_id ?? null;
      }

      if (emailAccountId) {
        const { data: emailAccount } = await supabase
          .from("email_accounts")
          .select("email_address")
          .eq("id", emailAccountId)
          .maybeSingle();

        if (emailAccount?.email_address) {
          resolvedTaskEmail = emailAccount.email_address;
        }
      }

      // 2) Generated email linked to this submission (only if no Outlook on task/template)
      if (!resolvedTaskEmail) {
        const { data: generatedEmail } = await supabase
          .from("generated_emails")
          .select("full_address")
          .eq("submission_id", submission.id)
          .eq("is_active", true)
          .maybeSingle();

        if (generatedEmail?.full_address) {
          resolvedTaskEmail = generatedEmail.full_address;
        }
      }

      // 3) Outlook mailbox assigned to the employee
      if (!resolvedTaskEmail) {
        const { data: assignedEmail } = await supabase
          .from("email_accounts")
          .select("email_address")
          .eq("assigned_to", submission.employee_id)
          .eq("status", "assigned")
          .maybeSingle();

        if (assignedEmail?.email_address) {
          resolvedTaskEmail = assignedEmail.email_address;
        }
      }

      setTaskEmail(resolvedTaskEmail);
    } catch (error) {
      console.error("Error fetching task email:", error);
    } finally {
      setLoadingTaskEmail(false);
    }
    
    const template = await resolveCompletionTemplate(submission, templates);
    if (template) {
      // update local cache so UI badges stay correct without refresh
      setTemplates((prev) => ({
        ...prev,
        [getTemplateKey(template.task_id, 'completion')]: template,
      }));
    }
    
    if (template) {
      setActiveCompletionTemplate(template);
      setTemplateSubject(template.subject);
      setTemplateContent(template.content);
      setTemplateSenderEmail(template.sender_email || "office@euroscent.de");
      setTemplateSenderName(template.sender_name || "EuroScent");
      setContentMode(isComplexEmailHtml(template.content) ? 'html' : 'visual');
    } else {
      setTemplateSubject(`Auftrag "${submission.tasks?.title}" erfolgreich abgeschlossen`);
      setTemplateContent(getDefaultEmailContent(submission));
      setTemplateSenderEmail("office@euroscent.de");
      setTemplateSenderName("EuroScent");
      setContentMode('visual');
    }
  };

  const handleOpenTemplateEditor = (taskId: string, taskTitle: string, emailType: EmailType) => {
    setEditingTemplate({ taskId, taskTitle, emailType });
    
    const key = getTemplateKey(taskId, emailType);
    const template = templates[key];
    
    if (template) {
      setTemplateSubject(template.subject);
      setTemplateContent(template.content);
      setTemplateSenderEmail(template.sender_email || "office@euroscent.de");
      setTemplateSenderName(template.sender_name || "EuroScent");
      setContentMode(isComplexEmailHtml(template.content) ? 'html' : 'visual');
    } else {
      if (emailType === 'opening') {
        setTemplateSubject(`Auftrag "${taskTitle}" wurde eröffnet`);
        setTemplateContent(getDefaultOpeningContent(taskTitle));
      } else {
        setTemplateSubject(`Auftrag "${taskTitle}" erfolgreich abgeschlossen`);
        setTemplateContent(getDefaultCompletionContent(taskTitle));
      }
      setTemplateSenderEmail("office@euroscent.de");
      setTemplateSenderName("EuroScent");
      setContentMode('visual');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    setSavingTemplate(true);
    try {
      const key = getTemplateKey(editingTemplate.taskId, editingTemplate.emailType);
      const existingTemplate = templates[key];

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("[Templates] getUser error:", userError);
        toast.error("Nicht angemeldet – bitte neu einloggen und erneut versuchen");
        return;
      }

      if (existingTemplate) {
        const { error } = await supabase
          .from("task_email_templates")
          .update({
            subject: templateSubject,
            content: templateContent,
            sender_email: templateSenderEmail,
            sender_name: templateSenderName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTemplate.id);

        if (error) {
          console.error("[Templates] update error:", error);
          toast.error(`Fehler beim Speichern der Vorlage: ${error.message}`);
          return;
        }

        toast.success("Vorlage aktualisiert");
        await fetchTemplates();
        setEditingTemplate(null);
        return;
      }

      const { error } = await supabase.from("task_email_templates").insert({
        task_id: editingTemplate.taskId,
        email_type: editingTemplate.emailType,
        subject: templateSubject,
        content: templateContent,
        sender_email: templateSenderEmail,
        sender_name: templateSenderName,
        created_by: user?.id,
      });

      if (error) {
        console.error("[Templates] insert error:", error);
        toast.error(`Fehler beim Erstellen der Vorlage: ${error.message}`);
        return;
      }

      toast.success("Vorlage erstellt");
      await fetchTemplates();
      setEditingTemplate(null);
    } catch (err) {
      console.error("[Templates] unexpected save error:", err);
      toast.error("Unerwarteter Fehler beim Speichern der Vorlage");
    } finally {
      setSavingTemplate(false);
    }
  };

  const replacePlaceholders = (text: string, submission: CompletedSubmission) => {
    const firstName = submission.profiles.first_name || "";
    const lastName = submission.profiles.last_name || "";
    const taskTitle = submission.tasks?.title || "";
    const email = submission.profiles.email || "";
    
    // Extract ident_code from admin_data
    const adminData = (submission.admin_data || {}) as Record<string, any>;
    const identCode = adminData.ident_code || "";
    
    // Generate task link - always use canonical domain (not preview origin)
    const baseUrl = "https://epp-dashboard.net";
    const taskLink = `${baseUrl}/dashboard/tasks/${submission.task_id}/demo-data`;
    
    return text
      // Support both {placeholder} and [Placeholder] formats (case-insensitive)
      .replace(/{vorname}/gi, firstName)
      .replace(/\[vorname\]/gi, firstName)
      .replace(/{nachname}/gi, lastName)
      .replace(/\[nachname\]/gi, lastName)
      .replace(/{auftrag}/gi, taskTitle)
      .replace(/\[auftrag\]/gi, taskTitle)
      .replace(/{email}/gi, email)
      .replace(/\[email\]/gi, email)
      // Also support English variants (with and without space)
      .replace(/{firstname}/gi, firstName)
      .replace(/\[firstname\]/gi, firstName)
      .replace(/\[first name\]/gi, firstName)
      .replace(/{first name}/gi, firstName)
      .replace(/{lastname}/gi, lastName)
      .replace(/\[lastname\]/gi, lastName)
      .replace(/\[last name\]/gi, lastName)
      .replace(/{last name}/gi, lastName)
      .replace(/{name}/gi, `${firstName} ${lastName}`.trim())
      .replace(/\[name\]/gi, `${firstName} ${lastName}`.trim())
      // Combined "Vorname Nachname" placeholder
      .replace(/{Vorname Nachname}/gi, `${firstName} ${lastName}`.trim())
      .replace(/\[Vorname Nachname\]/gi, `${firstName} ${lastName}`.trim())
      // Vorgangsnummer as alias for ident_code
      .replace(/{vorgangsnummer}/gi, identCode)
      .replace(/\[vorgangsnummer\]/gi, identCode)
      .replace(/{ident_code}/gi, identCode)
      .replace(/\[ident_code\]/gi, identCode)
      // Additional ident code variants
      .replace(/{identcode}/gi, identCode)
      .replace(/\[identcode\]/gi, identCode)
      // More ident code variants with spaces and different capitalizations
      .replace(/{ident code}/gi, identCode)
      .replace(/\[ident code\]/gi, identCode)
      .replace(/{Ident Code}/gi, identCode)
      .replace(/\[Ident Code\]/gi, identCode)
      .replace(/{Ident-Code}/gi, identCode)
      .replace(/\[Ident-Code\]/gi, identCode)
      .replace(/{ident-code}/gi, identCode)
      .replace(/\[ident-code\]/gi, identCode)
      // Task link placeholders - direct link to the task
      .replace(/{aufgaben_link}/gi, taskLink)
      .replace(/\[aufgaben_link\]/gi, taskLink)
      .replace(/{task_link}/gi, taskLink)
      .replace(/\[task_link\]/gi, taskLink)
      .replace(/{auftrag_link}/gi, taskLink)
      .replace(/\[auftrag_link\]/gi, taskLink)
      .replace(/{link}/gi, taskLink)
      .replace(/\[link\]/gi, taskLink);
  };

  const handleSendEmail = async () => {
    if (!selectedSubmission) return;
    
    setSending(true);
    
    const finalSubject = replacePlaceholders(templateSubject, selectedSubmission);
    const finalContent = replacePlaceholders(templateContent, selectedSubmission);

    // Resolve template freshly on send to avoid stale state (especially for duplicated tasks like "bonify")
    const template = await resolveCompletionTemplate(selectedSubmission, templates);
    if (template) {
      setActiveCompletionTemplate(template);
      setTemplates((prev) => ({
        ...prev,
        [getTemplateKey(template.task_id, 'completion')]: template,
      }));
    }
    
    // Check if the content is a full HTML template (not just text content)
    const isHtmlTemplate = isComplexEmailHtml(finalContent);
    
    try {
      // Use resolved task email, fallback to profile email for internal messaging
      const recipientEmail = taskEmail || selectedSubmission.profiles.email;
      if (!recipientEmail) {
        toast.error("Keine E-Mail-Adresse gefunden.");
        return;
      }

      // Sender identity must come from the completion template (as configured in the editor)
      const senderEmail = template?.sender_email || templateSenderEmail;
      const senderName = template?.sender_name || templateSenderName;
      
      const { error: functionError } = await supabase.functions.invoke("send-task-completion-email", {
        body: {
          to: recipientEmail,
          firstName: selectedSubmission.profiles.first_name,
          lastName: selectedSubmission.profiles.last_name,
          taskTitle: selectedSubmission.tasks?.title,
          subject: finalSubject,
          content: finalContent,
          isHtmlTemplate,
          submissionId: selectedSubmission.id,
          taskId: selectedSubmission.task_id,
          senderEmail,
          senderName,
          primaryColor: selectedSubmission.tasks?.primary_color || "#22c55e",
          secondaryColor: selectedSubmission.tasks?.secondary_color || "#ffffff",
          accentColor: selectedSubmission.tasks?.accent_color || "#16a34a",
          logoUrl: selectedSubmission.tasks?.logo_url
        }
      });

      if (functionError) throw functionError;

      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("task_completion_emails_sent")
        .insert({
          submission_id: selectedSubmission.id,
          template_id: template?.id || null,
          recipient_email: recipientEmail,
          recipient_name: `${selectedSubmission.profiles.first_name} ${selectedSubmission.profiles.last_name}`,
          subject: finalSubject,
          content: finalContent,
          sent_by: user?.id
        });

      toast.success("E-Mail erfolgreich versendet!");
      setSelectedSubmission(null);
      fetchCompletedSubmissions();
    } catch (error) {
      console.error("Error sending email:", error);
      const msg = (error as any)?.message || (error as any)?.error_description || null;
      toast.error(msg ? `Fehler beim Versenden der E-Mail: ${msg}` : "Fehler beim Versenden der E-Mail");
    }

    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Email Templates Section - only in Taskmails view */}
        {showTemplates && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                E-Mail-Vorlagen pro Auftrag
              </CardTitle>
              <CardDescription>
                Verwalten Sie individuelle E-Mail-Vorlagen für Auftragseröffnung und -abschluss
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine Aufträge vorhanden
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allTasks.map(task => {
                    const openingKey = getTemplateKey(task.id, 'opening');
                    const completionKey = getTemplateKey(task.id, 'completion');
                    const openingTemplate = templates[openingKey];
                    const completionTemplate = templates[completionKey];
                    
                    return (
                      <div 
                        key={task.id} 
                        className="border rounded-lg p-4 space-y-3"
                        style={{
                          borderLeftColor: task.primary_color || undefined,
                          borderLeftWidth: task.primary_color ? '3px' : undefined
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {task.logo_url && !task.logo_url.startsWith('data:') && (
                            <img 
                              src={task.logo_url} 
                              alt={task.title}
                              className="h-6 w-auto object-contain flex-shrink-0"
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{task.title}</p>
                          </div>
                        </div>
                        
                        {/* Toggle + Template Status */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Rocket className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-xs text-muted-foreground">Eröffnung</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {openingTemplate ? (
                                <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Vorlage
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Standard</Badge>
                              )}
                              <Switch
                                checked={task.send_opening_email ?? false}
                                onCheckedChange={(v) => handleToggleEmail(task.id, 'send_opening_email', v)}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Trophy className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-xs text-muted-foreground">Abschluss</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {completionTemplate ? (
                                <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Vorlage
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Standard</Badge>
                              )}
                              <Switch
                                checked={task.send_completion_email ?? false}
                                onCheckedChange={(v) => handleToggleEmail(task.id, 'send_completion_email', v)}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => handleOpenTemplateEditor(task.id, task.title, 'opening')}
                          >
                            <Mail className="h-4 w-4 mr-1.5" />
                            Eröffnung
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => handleOpenTemplateEditor(task.id, task.title, 'completion')}
                          >
                            <Trophy className="h-4 w-4 mr-1.5" />
                            Abschluss
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completed Submissions - Simple Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Erfolgreich abgeschlossene Aufträge
            </CardTitle>
            <CardDescription>
              Übersicht aller genehmigten Aufträge sämtlicher Mitarbeiter
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine abgeschlossenen Aufträge</h3>
                <p className="text-muted-foreground">
                  Hier erscheinen genehmigte Aufträge
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Auftrag</TableHead>
                    <TableHead>Abgeschlossen am</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {submission.profiles.first_name} {submission.profiles.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {submission.profiles.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {submission.tasks?.title || "Unbekannt"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.reviewed_at 
                          ? format(new Date(submission.reviewed_at), "dd.MM.yyyy HH:mm")
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {submission.completion_email_sent ? (
                          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                            <Mail className="h-3 w-3 mr-1" />
                            Versendet
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            —
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDemoDataPreview(submission)}
                          title="Demo-Daten anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Demo Data Preview Dialog */}
      <Dialog open={!!demoDataPreview} onOpenChange={(open) => !open && setDemoDataPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Demo-Daten
            </DialogTitle>
            <DialogDescription>
              {demoDataPreview?.tasks?.title} – {demoDataPreview?.profiles?.first_name} {demoDataPreview?.profiles?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {demoDataPreview?.admin_data ? (
              <>
                {(demoDataPreview.admin_data.custom_email || demoDataPreview.admin_data.email) && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">E-Mail:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.custom_email || demoDataPreview.admin_data.email}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.username && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">Benutzername:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.username}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.password && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">Passwort:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.password}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.passcode && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">Passcode:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.passcode}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.assigned_phone && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">Telefon:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.assigned_phone}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.ident_code && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground text-sm">Ident-Code:</span>
                    <span className="font-mono text-sm">{demoDataPreview.admin_data.ident_code}</span>
                  </div>
                )}
                {demoDataPreview.admin_data.ident_link && (
                  <div className="flex flex-col gap-1 py-2 border-b">
                    <span className="text-muted-foreground text-sm">Ident-Link:</span>
                    <a 
                      href={demoDataPreview.admin_data.ident_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-primary hover:underline break-all"
                    >
                      {demoDataPreview.admin_data.ident_link}
                    </a>
                  </div>
                )}
                {demoDataPreview.admin_data.info_text && (
                  <div className="flex flex-col gap-1 py-2 border-b">
                    <span className="text-muted-foreground text-sm">Info:</span>
                    <div className="max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2">
                      <span className="text-sm whitespace-pre-wrap">{demoDataPreview.admin_data.info_text}</span>
                    </div>
                  </div>
                )}
                {demoDataPreview.admin_data.image_url && (
                  <div className="flex flex-col gap-1 py-2 border-b">
                    <span className="text-muted-foreground text-sm">Bild:</span>
                    <img 
                      src={demoDataPreview.admin_data.image_url} 
                      alt="Demo-Bild" 
                      className="max-w-full h-auto rounded border"
                    />
                  </div>
                )}
                {!demoDataPreview.admin_data.custom_email && 
                 !demoDataPreview.admin_data.email && 
                 !demoDataPreview.admin_data.username && 
                 !demoDataPreview.admin_data.password && 
                 !demoDataPreview.admin_data.passcode &&
                 !demoDataPreview.admin_data.assigned_phone && 
                 !demoDataPreview.admin_data.ident_code && 
                 !demoDataPreview.admin_data.ident_link && 
                 !demoDataPreview.admin_data.info_text &&
                 !demoDataPreview.admin_data.image_url && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">Keine Zugangsdaten eingetragen</p>
                    <p className="text-xs mt-1">Nur Zeitstempel vorhanden</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Demo-Daten hinterlegt</p>
              </div>
            )}

            {/* Uploaded Files from step_responses */}
            {(() => {
              const responses = demoDataPreview?.step_responses;
              if (!responses) return null;
              const files: { name: string; url: string }[] = [];
              for (const [, value] of Object.entries(responses)) {
                if (Array.isArray(value)) {
                  for (const item of value) {
                    if (typeof item === "object" && item !== null && "url" in item && "name" in item) {
                      files.push({ name: (item as any).name, url: (item as any).url });
                    }
                  }
                }
              }
              if (files.length === 0) return null;
              return (
                <div className="pt-2">
                  <Separator className="mb-3" />
                  <p className="text-muted-foreground text-sm mb-2">Hochgeladene Dokumente ({files.length})</p>
                  <div className="space-y-1.5">
                    {files.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm bg-muted hover:bg-muted/80 rounded-md px-3 py-2 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Editor Dialog */}
      {showTemplates && (
        <Dialog 
          open={!!editingTemplate} 
          onOpenChange={(open) => !open && setEditingTemplate(null)}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingTemplate?.emailType === 'opening' ? (
                  <>
                    <Rocket className="h-5 w-5 text-blue-600" />
                    Eröffnungs-E-Mail bearbeiten
                  </>
                ) : (
                  <>
                    <Trophy className="h-5 w-5 text-amber-600" />
                    Abschluss-E-Mail bearbeiten
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Vorlage für: {editingTemplate?.taskTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Verfügbare Platzhalter:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{"{vorname}"}</Badge>
                  <Badge variant="secondary">{"{nachname}"}</Badge>
                  <Badge variant="secondary">{"{auftrag}"}</Badge>
                  <Badge variant="secondary">{"{email}"}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Absender-Einstellungen
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Absender Name</Label>
                    <Input
                      value={templateSenderName}
                      onChange={(e) => setTemplateSenderName(e.target.value)}
                      className="mt-1"
                      placeholder="EuroScent"
                    />
                  </div>
                  <div>
                    <Label>Absender E-Mail</Label>
                    <Input
                      value={templateSenderEmail}
                      onChange={(e) => setTemplateSenderEmail(e.target.value)}
                      className="mt-1"
                      placeholder="office@euroscent.de"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  E-Mail-Inhalt
                </h4>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Betreff</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setGeneratingSubject(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("generate-email-subject", {
                            body: {
                              taskTitle: editingTemplate?.taskTitle || "Demo-Auftrag",
                              emailType: editingTemplate?.emailType || "opening",
                              currentContent: templateContent
                            }
                          });
                          if (error) throw error;
                          if (data?.subject) {
                            setTemplateSubject(data.subject);
                            toast.success("Betreff wurde generiert!");
                          }
                        } catch (err) {
                          console.error("Error generating subject:", err);
                          toast.error("Fehler beim Generieren des Betreffs");
                        }
                        setGeneratingSubject(false);
                      }}
                      disabled={generatingSubject}
                    >
                      {generatingSubject ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      KI-Betreff
                    </Button>
                  </div>
                  <Input
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Inhalt</Label>
                  <div className="mt-2">
                    <Tabs value={contentMode} onValueChange={(v) => setContentMode(v as 'visual' | 'html')}>
                      <TabsList className="mb-2">
                        <TabsTrigger value="visual">Visual</TabsTrigger>
                        <TabsTrigger value="html">HTML-Code</TabsTrigger>
                      </TabsList>
                      <TabsContent value="visual">
                        {contentMode === 'visual' && (
                          <TipTapEditor
                            content={templateContent}
                            onChange={setTemplateContent}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="html">
                        <EditableHtmlPreview
                          content={templateContent}
                          onChange={setTemplateContent}
                          taskTitle={editingTemplate?.taskTitle}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditingTemplate(null)}
                  disabled={savingTemplate}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                >
                  {savingTemplate ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Vorlage speichern
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default CompletionsTab;
