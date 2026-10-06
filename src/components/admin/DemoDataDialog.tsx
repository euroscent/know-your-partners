import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Copy, Upload, Save, RefreshCw, Sparkles, Plus, Trash2, FileText } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { format } from "date-fns";

interface DemoDataDialogProps {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface Submission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  submitted_at: string;
  admin_data: any;
  step_responses?: any;
  tasks: {
    id: string;
    title: string;
  } | null;
  employee?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface EmailDomain {
  id: string;
  domain: string;
  is_active: boolean;
}

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
}

interface GeneratedEmailEntry {
  id: string;
  full_address: string;
  is_active: boolean;
}

interface PhoneNumber {
  id: string;
  phone_number: string;
  status: string;
  assigned_to: string | null;
}

const DemoDataDialog = ({ submissionId, open, onOpenChange, onSaved }: DemoDataDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  
  // Email generation
  const [emailDomains, setEmailDomains] = useState<EmailDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  
  // Outlook accounts
  const [outlookAccounts, setOutlookAccounts] = useState<EmailAccount[]>([]);
  
  // All generated custom domain emails for this employee
  const [allGeneratedEmails, setAllGeneratedEmails] = useState<GeneratedEmailEntry[]>([]);
  
  // Phone numbers
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  
  // Form fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [identCodes, setIdentCodes] = useState<string[]>([""]);
  const [identLink, setIdentLink] = useState("");
  const [infoText, setInfoText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [generatingInfoText, setGeneratingInfoText] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open && submissionId) {
      fetchData();
    }
  }, [open, submissionId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch submission with task and employee
    const { data: submissionData, error: subError } = await supabase
      .from("task_submissions")
      .select(`
        *,
        tasks!inner (id, title, default_info_text, template_id)
      `)
      .eq("id", submissionId)
      .single();

    if (subError || !submissionData) {
      toast.error("Fehler beim Laden der Submission");
      setLoading(false);
      return;
    }

    // Fetch employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", submissionData.employee_id)
      .single();

    const enrichedSubmission = {
      ...submissionData,
      employee: profile || { first_name: "Unbekannt", last_name: "", email: "" }
    } as Submission;

    setSubmission(enrichedSubmission);

    // Load existing admin_data into form
    const adminData = (submissionData.admin_data || {}) as Record<string, any>;
    setEmail(adminData.email || "");
    setUsername(adminData.username || "");
    setPassword(adminData.password || "");
    setPasscode(adminData.passcode || "");
    // Support both legacy ident_code (string) and new ident_codes (array)
    const existingCodes = adminData.ident_codes && Array.isArray(adminData.ident_codes) && adminData.ident_codes.length > 0
      ? adminData.ident_codes
      : adminData.ident_code ? [adminData.ident_code] : [""];
    setIdentCodes(existingCodes);
    setIdentLink(adminData.ident_link || "");
    // Prefill from task template's default_info_text if not yet set
    const taskRow: any = (submissionData as any).tasks || {};
    let defaultInfoText: string = taskRow.default_info_text || "";
    if (!defaultInfoText && taskRow.template_id) {
      const { data: tmpl } = await supabase
        .from("tasks")
        .select("default_info_text")
        .eq("id", taskRow.template_id)
        .maybeSingle();
      defaultInfoText = (tmpl as any)?.default_info_text || "";
    }
    setInfoText(adminData.info_text || defaultInfoText || "");
    setSelectedPhone(adminData.assigned_phone || "");
    setGeneratedEmail(adminData.custom_email || null);
    
    // Support both legacy image_url (string) and new image_urls (array)
    const existingImages = adminData.image_urls && Array.isArray(adminData.image_urls) && adminData.image_urls.length > 0
      ? adminData.image_urls
      : adminData.image_url ? [adminData.image_url] : [];
    setImagePreviews(existingImages);
    setImageNames(Array.isArray(adminData.image_names) ? adminData.image_names : []);
    setImageFiles([]);


    // Fetch email domains, outlook accounts, phone numbers, and all generated emails in parallel
    const [domainsRes, accountsRes, phonesRes, allGenEmailsRes] = await Promise.all([
      supabase.from("email_domains").select("*").eq("is_active", true),
      supabase.from("email_accounts").select("*").eq("assigned_to", submissionData.employee_id),
      supabase.from("phone_numbers").select("*").in("status", ["available", "assigned"]),
      supabase.from("generated_emails").select("id, full_address, is_active").eq("user_id", submissionData.employee_id).order("created_at", { ascending: false })
    ]);

    setEmailDomains(domainsRes.data || []);
    setOutlookAccounts(accountsRes.data || []);
    setPhoneNumbers(phonesRes.data || []);
    setAllGeneratedEmails((allGenEmailsRes.data || []) as GeneratedEmailEntry[]);

    // Check for existing generated email for this submission
    const { data: existingEmail } = await supabase
      .from("generated_emails")
      .select("full_address")
      .eq("submission_id", submissionId)
      .eq("is_active", true)
      .single();

    if (existingEmail) {
      setGeneratedEmail(existingEmail.full_address);
    }

    setLoading(false);
  };

  const handleGenerateEmail = async () => {
    if (!selectedDomain || !submission) return;
    
    setGeneratingEmail(true);
    
    try {
      // Generate random email local part
      const randomPart = Math.random().toString(36).substring(2, 10);
      const domain = emailDomains.find(d => d.id === selectedDomain);
      
      if (!domain) {
        toast.error("Domain nicht gefunden");
        setGeneratingEmail(false);
        return;
      }
      
      const fullAddress = `${randomPart}@${domain.domain}`;
      
      // Save to generated_emails table
      const { error } = await supabase
        .from("generated_emails")
        .insert({
          domain_id: selectedDomain,
          local_part: randomPart,
          full_address: fullAddress,
          submission_id: submission.id,
          task_id: submission.task_id,
          user_id: submission.employee_id
        });
      
      if (error) {
        console.error("Error generating email:", error);
        toast.error("Fehler beim Generieren der E-Mail");
      } else {
        setGeneratedEmail(fullAddress);
        toast.success("E-Mail-Adresse generiert!");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Fehler beim Generieren");
    }
    
    setGeneratingEmail(false);
  };

  const handleCopyEmail = (emailAddress: string) => {
    navigator.clipboard.writeText(emailAddress);
    toast.success("In Zwischenablage kopiert!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...imageFiles];
      while (newFiles.length <= index) newFiles.push(null as any);
      newFiles[index] = file;
      setImageFiles(newFiles);

      const newNames = [...imageNames];
      while (newNames.length <= index) newNames.push("");
      newNames[index] = file.name;
      setImageNames(newNames);

      const reader = new FileReader();
      reader.onload = () => {
        const newPreviews = [...imagePreviews];
        while (newPreviews.length <= index) newPreviews.push("");
        newPreviews[index] = reader.result as string;
        setImagePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const addImageSlot = () => {
    setImagePreviews([...imagePreviews, ""]);
  };

  const removeImageSlot = (index: number) => {
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setImageFiles(imageFiles.filter((_, i) => i !== index));
    setImageNames(imageNames.filter((_, i) => i !== index));
  };

  const isPdfEntry = (preview: string, name?: string) => {
    if (!preview) return false;
    if (preview.startsWith("data:application/pdf")) return true;
    if (name && name.toLowerCase().endsWith(".pdf")) return true;
    if (preview.toLowerCase().endsWith(".pdf")) return true;
    return false;
  };


  // Helper function to replace placeholders in email templates with demo data
  const replaceDemoDataPlaceholders = (content: string, adminData: Record<string, any>, employeeData: { first_name?: string | null; last_name?: string | null }, taskId?: string) => {
    let result = content;
    
    // Generate task link for demo-data page
    const baseUrl = "https://epp-dashboard.net";
    const taskLink = taskId ? `${baseUrl}/dashboard/tasks/${taskId}/demo-data` : "";
    
    // Replace employee name placeholders (case-insensitive)
    const nameReplacements: [RegExp, string][] = [
      [/\{vorname\}/gi, employeeData.first_name || ""],
      [/\[vorname\]/gi, employeeData.first_name || ""],
      [/\{nachname\}/gi, employeeData.last_name || ""],
      [/\[nachname\]/gi, employeeData.last_name || ""],
      [/\{name\}/gi, `${employeeData.first_name || ""} ${employeeData.last_name || ""}`.trim()],
      [/\[name\]/gi, `${employeeData.first_name || ""} ${employeeData.last_name || ""}`.trim()],
    ];
    
    for (const [pattern, replacement] of nameReplacements) {
      result = result.replace(pattern, replacement);
    }
    
    // Replace demo data placeholders
    const demoReplacements: [RegExp, string][] = [
      [/\{email\}/gi, adminData.email || adminData.custom_email || ""],
      [/\[email\]/gi, adminData.email || adminData.custom_email || ""],
      [/\{benutzername\}/gi, adminData.username || ""],
      [/\[benutzername\]/gi, adminData.username || ""],
      [/\{username\}/gi, adminData.username || ""],
      [/\[username\]/gi, adminData.username || ""],
      [/\{passwort\}/gi, adminData.password || ""],
      [/\[passwort\]/gi, adminData.password || ""],
      [/\{password\}/gi, adminData.password || ""],
      [/\[password\]/gi, adminData.password || ""],
      [/\{passcode\}/gi, adminData.passcode || ""],
      [/\[passcode\]/gi, adminData.passcode || ""],
      [/\{ident_code\}/gi, adminData.ident_code || ""],
      [/\[ident_code\]/gi, adminData.ident_code || ""],
      [/\{ident_link\}/gi, adminData.ident_link || ""],
      [/\[ident_link\]/gi, adminData.ident_link || ""],
      [/\{telefon\}/gi, adminData.assigned_phone || ""],
      [/\[telefon\]/gi, adminData.assigned_phone || ""],
      [/\{phone\}/gi, adminData.assigned_phone || ""],
      [/\[phone\]/gi, adminData.assigned_phone || ""],
      [/\{telefonnummer\}/gi, adminData.assigned_phone || ""],
      [/\[telefonnummer\]/gi, adminData.assigned_phone || ""],
      [/\{Telefonnummer\}/gi, adminData.assigned_phone || ""],
      [/\[Telefonnummer\]/gi, adminData.assigned_phone || ""],
      [/\{rufnummer\}/gi, adminData.assigned_phone || ""],
      [/\[rufnummer\]/gi, adminData.assigned_phone || ""],
    ];
    
    // Task link placeholders - direct link to the demo-data page
    const linkReplacements: [RegExp, string][] = [
      [/\{aufgaben_link\}/gi, taskLink],
      [/\[aufgaben_link\]/gi, taskLink],
      [/\{task_link\}/gi, taskLink],
      [/\[task_link\]/gi, taskLink],
      [/\{auftrag_link\}/gi, taskLink],
      [/\[auftrag_link\]/gi, taskLink],
      [/\{link\}/gi, taskLink],
      [/\[link\]/gi, taskLink],
      [/\{demo_link\}/gi, taskLink],
      [/\[demo_link\]/gi, taskLink],
    ];
    
    for (const [pattern, replacement] of demoReplacements) {
      result = result.replace(pattern, replacement);
    }
    
    for (const [pattern, replacement] of linkReplacements) {
      result = result.replace(pattern, replacement);
    }
    
    return result;
  };

  // Send opening email when demo data is saved
  const sendOpeningEmail = async (adminData: Record<string, any>) => {
    if (!submission) return;
    
    try {
      // Fetch the task to get template_id
      const { data: task } = await supabase
        .from("tasks")
        .select("id, title, template_id, logo_url, primary_color, secondary_color, accent_color")
        .eq("id", submission.task_id)
        .single();
      
      if (!task) return;
      
      // Prioritize template_id, fallback to task_id
      const lookupId = task.template_id || task.id;
      
      // Fetch opening email template for this task
      const { data: template } = await supabase
        .from("task_email_templates")
        .select("*")
        .eq("task_id", lookupId)
        .eq("email_type", "opening")
        .eq("is_active", true)
        .single();
      
      if (!template) {
        console.log("No opening email template found for task:", lookupId);
        return;
      }
      
      // Don't send if template content or subject is empty
      const hasContent = template.content && template.content.trim().length > 0;
      const hasSubject = template.subject && template.subject.trim().length > 0;
      
      if (!hasContent || !hasSubject) {
        console.log("Opening email template is empty, skipping send for task:", lookupId);
        return;
      }
      
      // Replace placeholders in subject and content
      const employeeData = {
        first_name: submission.employee?.first_name,
        last_name: submission.employee?.last_name
      };
      
      const processedSubject = replaceDemoDataPlaceholders(template.subject, adminData, employeeData, submission.task_id);
      const processedContent = replaceDemoDataPlaceholders(template.content, adminData, employeeData, submission.task_id);
      
      // Resolve recipient: prefer assigned resource email over private email
      // Priority: (1) Custom domain email for this submission, (2) any custom domain email for this employee,
      // (3) Outlook account assigned to employee, (4) fallback to private profile email
      let recipientEmail = "";
      
      // Check for submission-specific generated email
      const { data: submissionEmail } = await supabase
        .from("generated_emails")
        .select("full_address")
        .eq("submission_id", submission.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (submissionEmail?.full_address) {
        recipientEmail = submissionEmail.full_address;
      } else {
        // Check for any active generated email for this employee
        const { data: genEmails } = await supabase
          .from("generated_emails")
          .select("full_address")
          .eq("user_id", submission.employee_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (genEmails && genEmails.length > 0) {
          recipientEmail = genEmails[0].full_address;
        } else {
          // Check for assigned Outlook account
          const { data: outlookAcc } = await supabase
            .from("email_accounts")
            .select("email_address")
            .eq("assigned_to", submission.employee_id)
            .eq("status", "assigned")
            .limit(1);
          
          if (outlookAcc && outlookAcc.length > 0) {
            recipientEmail = outlookAcc[0].email_address;
          } else {
            // Fallback to private email
            recipientEmail = submission.employee?.email || "";
          }
        }
      }
      
      console.log("Opening email recipient resolved to:", recipientEmail);
      
      // Send via edge function (stores in received_emails)
      const { error: emailError } = await supabase.functions.invoke("send-task-completion-email", {
        body: {
          to: recipientEmail,
          firstName: submission.employee?.first_name || "",
          lastName: submission.employee?.last_name || "",
          taskTitle: task.title,
          subject: processedSubject,
          content: processedContent,
          isHtmlTemplate: true,
          submissionId: submission.id,
          taskId: submission.task_id,
          senderEmail: template.sender_email || "info@payexpert.space",
          senderName: template.sender_name || "PayExpert",
          primaryColor: task.primary_color || "#22c55e",
          secondaryColor: task.secondary_color || "#ffffff",
          accentColor: task.accent_color || "#16a34a",
          logoUrl: task.logo_url
        }
      });
      
      if (emailError) {
        console.error("Error sending opening email:", emailError);
      } else {
        console.log("Opening email sent successfully for submission:", submission.id);
      }
    } catch (err) {
      console.error("Error in sendOpeningEmail:", err);
    }
  };

  const handleSave = async () => {
    if (!submission) return;
    
    setSaving(true);
    
    try {
      const currentAdminData = (submission.admin_data || {}) as Record<string, any>;
      
      // Process all images/PDFs - convert new files to data URLs
      const finalImageUrls: string[] = [];
      const finalImageNames: string[] = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        const preview = imagePreviews[i];
        if (!preview) continue;
        
        // If there's a new file for this index, convert it
        if (imageFiles[i]) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(imageFiles[i]);
          });
          finalImageUrls.push(await base64Promise);
          finalImageNames.push(imageFiles[i].name || "");
        } else if (preview) {
          // Keep existing URL
          finalImageUrls.push(preview);
          finalImageNames.push(imageNames[i] || "");
        }
      }
      
      const imageUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : null;
      
      // Build admin_data object
      // Clear restart_from_step when saving new demo data after a rejection
      // This prevents the employee from being stuck in a pending loop
      const adminData = {
        ...currentAdminData,
        email: email || null,
        username: username || null,
        password: password || null,
        passcode: passcode || null,
        ident_code: identCodes.filter(c => c.trim()).join(", ") || null,
        ident_codes: identCodes.filter(c => c.trim()),
        ident_link: identLink || null,
        info_text: infoText || null,
        assigned_phone: selectedPhone || null,
        custom_email: generatedEmail || null,
        image_url: imageUrl,
        image_urls: finalImageUrls.length > 0 ? finalImageUrls : null,
        image_names: finalImageNames.length > 0 ? finalImageNames : null,
        demo_data_updated_at: new Date().toISOString(),
        opening_email_sent: currentAdminData.opening_email_sent || false,
        restart_from_step: null,
        rejection_timestamp: null,
        last_section: null,
        quality_check: null,
        completed_at: null,
      };
      
      // Update submission with new admin_data and set status to in_progress
      const { error } = await supabase
        .from("task_submissions")
        .update({
          admin_data: adminData,
          status: "in_progress"
        })
        .eq("id", submission.id);
      
      if (error) {
        console.error("Error saving demo data:", error);
        toast.error("Fehler beim Speichern");
      } else {
        // Start deadline timer on the assigned task (only if not already set)
        try {
          const { data: taskRow } = await supabase
            .from("tasks")
            .select("id, due_date, deadline_days")
            .eq("id", submission.task_id)
            .maybeSingle();

          if (taskRow && !taskRow.due_date) {
            const days = Math.max(1, (taskRow as any).deadline_days ?? 3);
            const due = new Date();
            due.setDate(due.getDate() + days);
            await supabase
              .from("tasks")
              .update({ due_date: due.toISOString() })
              .eq("id", submission.task_id);
          }
        } catch (e) {
          console.warn("Could not set task deadline:", e);
        }

        // Only send opening email if:
        // 1. Not already sent
        // 2. Demo data has actually been filled (email/username/password/ident/images)
        // 3. An ACTIVE opening template exists for this task (checked inside sendOpeningEmail)
        const alreadySent = currentAdminData.opening_email_sent === true;
        const hasDemoContent = Boolean(
          adminData.email || adminData.username || adminData.password ||
          adminData.passcode || adminData.ident_code || adminData.ident_link ||
          (adminData.image_urls && adminData.image_urls.length > 0)
        );

        // Check whether an active opening template exists for this task
        let hasActiveTemplate = false;
        if (!alreadySent && hasDemoContent) {
          const { data: taskRow } = await supabase
            .from("tasks")
            .select("id, template_id")
            .eq("id", submission.task_id)
            .single();
          const lookupId = taskRow?.template_id || taskRow?.id;
          if (lookupId) {
            const { data: tpl } = await supabase
              .from("task_email_templates")
              .select("id, is_active, content, subject")
              .eq("task_id", lookupId)
              .eq("email_type", "opening")
              .eq("is_active", true)
              .maybeSingle();
            hasActiveTemplate = Boolean(tpl && tpl.content?.trim() && tpl.subject?.trim());
          }
        }

        if (!alreadySent && hasDemoContent && hasActiveTemplate) {
          await sendOpeningEmail(adminData);
          await supabase
            .from("task_submissions")
            .update({ admin_data: { ...adminData, opening_email_sent: true } })
            .eq("id", submission.id);
          toast.success("Demo-Daten gespeichert & Eröffnungsmail versendet!");
        } else if (alreadySent) {
          toast.success("Demo-Daten aktualisiert (Eröffnungsmail wurde bereits versendet)");
        } else {
          toast.success("Demo-Daten gespeichert");
        }

        // Push-Benachrichtigung an Mitarbeiter über freigegebene Demo-Daten
        const employeeId = (submission as any).employee_id || (submission as any).employee?.id;
        if (employeeId) {
          supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: employeeId,
              title: "Demo-Daten freigegeben",
              body: `Für „${submission?.tasks?.title || "deinen Auftrag"}" sind die Daten jetzt verfügbar.`,
              url: `/dashboard/tasks/${submission.task_id}/demo-data`,
              tag: `demo-${submission.id}`,
              category: "demo_data_approved",
            },
          }).catch(() => {});
        }

        onOpenChange(false);
        onSaved?.();
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Fehler beim Speichern");
    }
    
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{submission?.tasks?.title || "Demo-Daten bearbeiten"}</DialogTitle>
          <DialogDescription>
            Eingereicht von: {submission?.employee?.first_name} {submission?.employee?.last_name} • {submission?.submitted_at ? format(new Date(submission.submitted_at), "dd.MM.yyyy HH:mm") : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const stepResponses = (submission as any)?.step_responses;
              const responsesArray = Array.isArray(stepResponses)
                ? stepResponses
                : stepResponses ? Object.values(stepResponses) : [];
              const idDoc = responsesArray.find((r: any) => r?.id_document)?.id_document;
              if (!idDoc) return null;
              const label = idDoc === "reisepass" ? "Reisepass" : idDoc === "personalausweis" ? "Deutscher Personalausweis" : idDoc;
              return (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Ausweisdokument
                  </Badge>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              );
            })()}

            {(() => {
              const stepResponses = (submission as any)?.step_responses;
              const responsesArray = Array.isArray(stepResponses)
                ? stepResponses
                : stepResponses ? Object.values(stepResponses) : [];
              const entry = responsesArray.find((r: any) => r?.postal_consent);
              if (!entry?.postal_consent) return null;
              const accepted = entry.postal_consent === "yes";
              const bonus = Number(entry.postal_consent_bonus ?? 0);
              return (
                <div className={`border rounded-lg p-3 flex items-center gap-3 ${accepted ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/50 border-border"}`}>
                  <Badge variant="outline" className={accepted ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400" : ""}>
                    Postalische Zusendung
                  </Badge>
                  <span className="text-sm font-medium">
                    {accepted ? "Akzeptiert" : "Abgelehnt"}
                  </span>
                  {accepted && bonus > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      + {bonus.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Bonus
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <h3 className="font-semibold">E-Mail-Adresse generieren</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Generieren Sie eine E-Mail-Adresse für diesen Mitarbeiter, um Verifizierungscodes zu empfangen.
              </p>
              
              <div className="flex gap-2">
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Domain auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailDomains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        @{domain.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleGenerateEmail} 
                  disabled={!selectedDomain || generatingEmail}
                >
                  {generatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>

              {generatedEmail && (
                <div className="flex items-center gap-2 p-2 bg-background rounded border">
                  <span className="flex-1 font-mono text-sm">{generatedEmail}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleCopyEmail(generatedEmail)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Outlook E-Mail Accounts */}
            {outlookAccounts.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <h3 className="font-semibold">Outlook E-Mail-Konten ({outlookAccounts.length})</h3>
                </div>
                <div className="space-y-2">
                  {outlookAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-2 bg-background rounded border">
                      <span className="text-sm">{account.email_address}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{account.provider || "Outlook"}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyEmail(account.email_address)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Domain E-Mails */}
            {allGeneratedEmails.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <h3 className="font-semibold">Custom Domain E-Mails ({allGeneratedEmails.length})</h3>
                </div>
                <div className="space-y-2">
                  {allGeneratedEmails.map((genEmail) => (
                    <div key={genEmail.id} className="flex items-center justify-between p-2 bg-background rounded border">
                      <span className="text-sm font-mono">{genEmail.full_address}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={genEmail.is_active ? "default" : "secondary"}>
                          {genEmail.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyEmail(genEmail.full_address)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Demo Daten (optional)</h3>
              <p className="text-sm text-muted-foreground">
                Ergänzen Sie Demo-Zugangsdaten und Identifikationsinformationen für den Mitarbeiter.
              </p>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="demo@beispiel.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="username">Benutzername</Label>
                  <Input
                    id="username"
                    placeholder="Benutzername eingeben..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    placeholder="Passwort eingeben..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="passcode">Passcode</Label>
                  <Input
                    id="passcode"
                    placeholder="Passcode eingeben..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                  />
                </div>

                {/* Image Uploads - Multiple */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Upload Bilder / PDF</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addImageSlot}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Weitere Datei
                    </Button>
                  </div>
                  <div className="space-y-3 mt-2">
                    {(imagePreviews.length === 0 ? [""] : imagePreviews).map((preview, index) => (
                      <div key={index} className="relative">
                        <div 
                          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => {
                            if (!fileInputRefs.current[index]) {
                              fileInputRefs.current[index] = document.createElement('input');
                            }
                            fileInputRefs.current[index]?.click();
                          }}
                        >
                          {preview ? (
                            isPdfEntry(preview, imageNames[index]) ? (
                              <div className="flex flex-col items-center gap-1 py-2">
                                <FileText className="h-10 w-10 text-red-500" />
                                <p className="text-xs text-foreground font-medium break-all">
                                  {imageNames[index] || `Dokument ${index + 1}.pdf`}
                                </p>
                                <p className="text-[10px] text-muted-foreground">PDF · klicken zum Ersetzen</p>
                              </div>
                            ) : (
                              <img 
                                src={preview} 
                                alt={`Preview ${index + 1}`} 
                                className="max-h-28 mx-auto rounded"
                              />
                            )
                          ) : (
                            <>
                              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">
                                Bild oder PDF {imagePreviews.length > 1 ? index + 1 : ""} auswählen
                              </p>
                            </>
                          )}
                          <input
                            ref={(el) => { fileInputRefs.current[index] = el; }}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, index)}
                          />
                        </div>
                        {imagePreviews.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 bg-background/80 hover:bg-destructive/20 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeImageSlot(index); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phone Number Selection */}
                <div>
                  <Label>Telefonnummer zuweisen</Label>
                  <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Verfügbare Nummer auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.filter(p => p.status === "available" || p.assigned_to === submission?.employee_id).map((phone) => (
                        <SelectItem key={phone.id} value={phone.phone_number}>
                          {phone.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Ident Code</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIdentCodes([...identCodes, ""])}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Weiteren Code
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {identCodes.map((code, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`Ident-Code ${identCodes.length > 1 ? index + 1 : ""}...`}
                          value={code}
                          onChange={(e) => {
                            const updated = [...identCodes];
                            updated[index] = e.target.value;
                            setIdentCodes(updated);
                          }}
                        />
                        {identCodes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setIdentCodes(identCodes.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="identLink">Ident Link</Label>
                  <Input
                    id="identLink"
                    placeholder="https://..."
                    value={identLink}
                    onChange={(e) => setIdentLink(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="infoText" className="mb-2 block">Info / Fragen und Antworten (optional)</Label>
                  <Textarea
                    id="infoText"
                    placeholder="Zusätzliche Informationen für den Mitarbeiter..."
                    value={infoText}
                    onChange={(e) => setInfoText(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Diese Informationen werden dem Mitarbeiter bei den Demo-Daten angezeigt.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Demo-Daten speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoDataDialog;
