import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserX,
  Upload,
  Filter,
  Send,
  Mail,
  User,
  Save,
  FileDown,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronDown,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { TipTapEditor } from "@/components/email-sender/TipTapEditor";
import { wrapEmailHtmlForPreview } from "@/lib/emailPreview";

interface Contact {
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  [key: string]: string | undefined;
}

interface SendLog {
  email: string;
  status: "pending" | "sent" | "failed";
  timestamp?: Date;
  error?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  sender_name?: string;
  sender_email?: string;
}

export default function EmailSender() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
  const [availablePlaceholders, setAvailablePlaceholders] = useState<string[]>([
    "name",
    "first_name",
    "last_name",
    "email",
  ]);

  // Email settings
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "html">("visual");

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  // Sending
  const [sending, setSending] = useState(false);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Stats
  const totalContacts = contacts.length;
  const excludedCount = excludedEmails.size;
  const readyToSend = contacts.filter((c) => !excludedEmails.has(c.email)).length;
  const sentCount = sendLogs.filter((l) => l.status === "sent").length;
  const failedCount = sendLogs.filter((l) => l.status === "failed").length;

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
      loadTemplates();
    };

    checkAuth();
  }, [navigate]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTemplates(data as EmailTemplate[]);
    }
  };

  const parseCSV = (text: string): Contact[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const contacts: Contact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;]/).map((v) => v.trim().replace(/"/g, ""));
      const contact: Contact = { email: "" };

      headers.forEach((header, index) => {
        const value = values[index] || "";
        if (header === "email" || header === "e-mail" || header === "mail") {
          contact.email = value;
        } else if (header === "name" || header === "vollständiger name") {
          contact.name = value;
        } else if (header === "first_name" || header === "vorname" || header === "firstname") {
          contact.first_name = value;
        } else if (header === "last_name" || header === "nachname" || header === "lastname") {
          contact.last_name = value;
        } else if (header === "company" || header === "firma" || header === "unternehmen") {
          contact.company = value;
        } else if (header === "phone" || header === "phone_number" || header === "telefon" || header === "telefonnummer") {
          contact.phone = value;
        } else {
          contact[header] = value;
        }
      });

      if (contact.email && contact.email.includes("@")) {
        contacts.push(contact);
      }
    }

    // Update available placeholders
    const allKeys = new Set<string>();
    contacts.forEach((c) => {
      Object.keys(c).forEach((k) => {
        if (c[k]) allKeys.add(k);
      });
    });
    setAvailablePlaceholders(Array.from(allKeys));

    return contacts;
  };

  const parseXLSX = (data: ArrayBuffer): Contact[] => {
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    const contacts: Contact[] = [];
    const allKeys = new Set<string>();

    for (const row of rows) {
      const contact: Contact = { email: "" };

      for (const [key, value] of Object.entries(row)) {
        const lk = key.toLowerCase().trim();
        const val = String(value || "").trim();

        if (lk === "email" || lk === "e-mail" || lk === "mail") {
          contact.email = val;
        } else if (lk === "full_name" || lk === "name" || lk === "vollständiger name") {
          contact.name = val;
          // Try to split into first/last
          const parts = val.split(/\s+/);
          if (parts.length >= 2) {
            contact.first_name = parts[0];
            contact.last_name = parts.slice(1).join(" ");
          } else {
            contact.first_name = val;
          }
        } else if (lk === "first_name" || lk === "vorname" || lk === "firstname") {
          contact.first_name = val;
        } else if (lk === "last_name" || lk === "nachname" || lk === "lastname") {
          contact.last_name = val;
        } else if (lk === "company" || lk === "firma" || lk === "unternehmen") {
          contact.company = val;
        } else if (lk === "phone" || lk === "phone_number" || lk === "telefon" || lk === "telefonnummer") {
          contact.phone = val;
        } else {
          contact[lk] = val;
        }
      }

      if (contact.email && contact.email.includes("@")) {
        contacts.push(contact);
        Object.keys(contact).forEach((k) => { if (contact[k]) allKeys.add(k); });
      }
    }

    setAvailablePlaceholders(Array.from(allKeys));
    return contacts;
  };

  const handleContactsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as ArrayBuffer;
        const parsed = parseXLSX(data);
        setContacts(parsed);
        toast.success(`${parsed.length} Kontakte aus Excel importiert`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setContacts(parsed);
        toast.success(`${parsed.length} Kontakte importiert`);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleExclusionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split("\n");
      const emails = new Set<string>();

      lines.forEach((line) => {
        const email = line.split(/[,;]/)[0].trim().replace(/"/g, "").toLowerCase();
        if (email.includes("@")) {
          emails.add(email);
        }
      });

      setExcludedEmails(emails);
      toast.success(`${emails.size} E-Mails zur Ausschlussliste hinzugefügt`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const insertPlaceholder = (placeholder: string) => {
    const tag = `{{${placeholder}}}`;
    setContent((prev) => prev + tag);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Bitte geben Sie einen Template-Namen ein");
      return;
    }

    const { error } = await supabase.from("email_templates").insert({
      name: templateName,
      subject,
      content,
      sender_name: senderName,
      sender_email: senderEmail,
    });

    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    toast.success("Template gespeichert");
    setSaveDialogOpen(false);
    setTemplateName("");
    loadTemplates();
  };

  const loadTemplate = (template: EmailTemplate) => {
    setSubject(template.subject);
    setContent(template.content);
    if (template.sender_name) setSenderName(template.sender_name);
    if (template.sender_email) setSenderEmail(template.sender_email);
    toast.success(`Template "${template.name}" geladen`);
  };

  const deleteTemplate = async () => {
    if (!templateToDelete) return;

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", templateToDelete.id);

    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }

    toast.success(`Template "${templateToDelete.name}" gelöscht`);
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
    loadTemplates();
  };

  const confirmDeleteTemplate = (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  // Preview helpers
  const recipientsToSend = contacts.filter((c) => !excludedEmails.has(c.email.toLowerCase()));
  const previewContact = recipientsToSend[previewIndex] || null;

  const replacePlaceholders = (text: string, contact: Contact): string => {
    let result = text;
    Object.entries(contact).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, value || '');
    });
    // Handle combined name placeholder if not explicitly provided
    if (!contact.name && (contact.first_name || contact.last_name)) {
      const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
      result = result.replace(/\{\{name\}\}/gi, fullName);
    }
    return result;
  };

  const getPreviewSubject = (): string => {
    if (!previewContact) return subject;
    return replacePlaceholders(subject, previewContact);
  };

  const getPreviewContent = (): string => {
    if (!previewContact) return content;
    return replacePlaceholders(content, previewContact);
  };

  const sendEmails = async () => {
    if (!senderName || !senderEmail || !subject || !content) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    const recipientsToSend = contacts.filter((c) => !excludedEmails.has(c.email.toLowerCase()));
    if (recipientsToSend.length === 0) {
      toast.error("Keine Empfänger zum Senden");
      return;
    }

    setSending(true);
    setSendLogs(recipientsToSend.map((c) => ({ email: c.email, status: "pending" })));

    try {
      const response = await supabase.functions.invoke("send-bulk-email", {
        body: {
          senderName,
          senderEmail,
          subject,
          htmlContent: content,
          recipients: recipientsToSend,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { results } = response.data;
      setSendLogs(
        results.map((r: any) => ({
          email: r.email,
          status: r.status,
          error: r.error,
          timestamp: new Date(),
        }))
      );

      // Create application entries for successfully sent emails (without sending confirmation emails)
      const sentEmails = results.filter((r: any) => r.status === "sent");
      if (sentEmails.length > 0) {
        const applicationEntries = sentEmails.map((r: any) => {
          const contact = recipientsToSend.find((c) => c.email === r.email);
          const firstName = contact?.first_name || contact?.name?.split(/\s+/)[0] || "";
          const lastName = contact?.last_name || contact?.name?.split(/\s+/).slice(1).join(" ") || "";
          return {
            email: r.email,
            first_name: firstName || "Unbekannt",
            last_name: lastName || "",
            phone: contact?.phone || "–",
            status: "contacted",
            message: `Kontaktiert via Email Sender Pro – Betreff: ${subject}`,
          };
        });

        const { error: appError } = await supabase
          .from("applications")
          .insert(applicationEntries);

        if (appError) {
          console.error("Error creating application entries:", appError);
        }
      }

      toast.success(`${response.data.sent} E-Mails gesendet, ${response.data.failed} fehlgeschlagen`);
    } catch (error: any) {
      toast.error(`Fehler: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Sender Pro</h1>
          <p className="text-muted-foreground">Personalisierter E-Mail-Versand</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalContacts}</p>
                <p className="text-sm text-muted-foreground">Gesamt Kontakte</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{excludedCount}</p>
                <p className="text-sm text-muted-foreground">Bereits kontaktiert</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{readyToSend}</p>
                <p className="text-sm text-muted-foreground">Versandbereit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sentCount}</p>
                <p className="text-sm text-muted-foreground">Gesendet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 text-primary mb-3" />
              <p className="font-medium">Kontakte hochladen</p>
              <p className="text-sm text-muted-foreground mb-4">CSV- oder Excel-Datei mit Name und E-Mail</p>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  Datei auswählen
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleContactsUpload}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg">
              <Filter className="h-10 w-10 text-orange-500 mb-3" />
              <p className="font-medium">Ausschlussliste hochladen</p>
              <p className="text-sm text-muted-foreground mb-4">Bereits kontaktierte E-Mails filtern</p>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  Datei auswählen
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleExclusionUpload}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sender Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Absender-Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Absender-Name
              </Label>
              <Input
                placeholder="z.B. Ivana Fink"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Absender-E-Mail (verifizierte Domain)
              </Label>
              <Input
                placeholder="z.B. info@ar-ventures-de.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Verwenden Sie eine E-Mail-Adresse von Ihrer verifizierten Domain bei Resend.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Template Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileDown className="h-5 w-5" />
                  E-Mail-Vorlage
                </CardTitle>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Template laden
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {templates.length === 0 ? (
                        <DropdownMenuItem disabled>Keine Templates</DropdownMenuItem>
                      ) : (
                        <>
                          {templates.map((t) => (
                            <DropdownMenuItem key={t.id} className="flex items-center justify-between group">
                              <span 
                                className="flex-1 cursor-pointer" 
                                onClick={() => loadTemplate(t)}
                              >
                                {t.name}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                onClick={(e) => confirmDeleteTemplate(t, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Template erstellen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Template speichern</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Template-Name</Label>
                          <Input
                            placeholder="z.B. Bewerbungseinladung"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                          />
                        </div>
                        <Button onClick={saveTemplate} className="w-full">
                          <Save className="h-4 w-4 mr-2" />
                          Speichern
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Placeholders */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Verfügbare Platzhalter</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availablePlaceholders.map((p) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => insertPlaceholder(p)}
                    >
                      {`{{${p}}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label>Betreff</Label>
                <Input
                  placeholder="Karriere bei AR Ventures"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Content Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Nachricht</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={viewMode === "visual" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("visual")}
                    >
                      Visuell
                    </Button>
                    <Button
                      variant={viewMode === "html" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("html")}
                    >
                      {"<> HTML"}
                    </Button>
                  </div>
                </div>

                {viewMode === "visual" ? (
                  <TipTapEditor content={content} onChange={setContent} />
                ) : (
                  <div className="space-y-3">
                    <textarea
                      className="w-full h-64 p-3 border rounded-lg font-mono text-sm resize-none"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    <div>
                      <Label className="text-sm text-muted-foreground mb-1 block">Live-Vorschau</Label>
                      <iframe
                        srcDoc={wrapEmailHtmlForPreview(content, "https://payexpert.space/")}
                        className="w-full min-h-[300px] bg-white rounded-lg border"
                        sandbox="allow-same-origin"
                        referrerPolicy="no-referrer"
                        style={{ border: "none" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contacts Preview */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Kontakte
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Keine Kontakte</p>
                  <p className="text-sm text-muted-foreground">
                    Laden Sie eine CSV-Datei hoch, um Kontakte hinzuzufügen.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {contacts.map((contact, i) => {
                      const isExcluded = excludedEmails.has(contact.email.toLowerCase());
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border ${
                            isExcluded ? "bg-muted/50 opacity-60" : ""
                          }`}
                        >
                          <p className="font-medium text-sm truncate">
                            {contact.name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unbekannt"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          {contact.company && (
                            <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                          )}
                          {isExcluded && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Ausgeschlossen
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Logs */}
      {sendLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Versandprotokoll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {sendLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                    <span className="text-sm truncate flex-1">{log.email}</span>
                    <div className="flex items-center gap-2">
                      {log.status === "pending" && (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Wartend
                        </Badge>
                      )}
                      {log.status === "sent" && (
                        <Badge className="bg-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          Gesendet
                        </Badge>
                      )}
                      {log.status === "failed" && (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Fehlgeschlagen
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              disabled={recipientsToSend.length === 0 || !content}
              onClick={() => setPreviewIndex(0)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Vorschau
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                E-Mail-Vorschau
              </DialogTitle>
            </DialogHeader>
            
            {previewContact && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Recipient Selector */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={previewIndex === 0}
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-center">
                    <p className="font-medium">
                      {previewContact.name || 
                        `${previewContact.first_name || ''} ${previewContact.last_name || ''}`.trim() || 
                        previewContact.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Empfänger {previewIndex + 1} von {recipientsToSend.length}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={previewIndex >= recipientsToSend.length - 1}
                    onClick={() => setPreviewIndex((i) => Math.min(recipientsToSend.length - 1, i + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Email Preview */}
                <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                  {/* From */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-16">Von:</span>
                    <span className="font-medium">{senderName} &lt;{senderEmail}&gt;</span>
                  </div>
                  
                  {/* To */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-16">An:</span>
                    <span className="font-medium">{previewContact.email}</span>
                  </div>
                  
                  {/* Subject */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-16">Betreff:</span>
                    <span className="font-medium">{getPreviewSubject()}</span>
                  </div>
                  
                  <div className="border-t pt-3 flex-1 overflow-auto">
                    <iframe
                      srcDoc={wrapEmailHtmlForPreview(getPreviewContent(), "https://payexpert.space/")}
                      className="w-full min-h-[400px] bg-white rounded-lg border"
                      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      style={{ border: "none" }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {!previewContact && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="font-medium">Keine Empfänger</p>
                <p className="text-sm text-muted-foreground">
                  Laden Sie Kontakte hoch, um eine Vorschau zu sehen.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Button
          size="lg"
          className="px-12"
          onClick={sendEmails}
          disabled={sending || readyToSend === 0}
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
              Wird gesendet...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {readyToSend} E-Mails senden
            </>
          )}
        </Button>
      </div>

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Template "{templateToDelete?.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
