import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  User, FileText, ClipboardList, Mail, Trash2, Loader2, Phone, MapPin, Calendar,
  CreditCard, Shield, Copy, Check, Plus, X, Inbox, Settings2, ExternalLink, Search, RefreshCw, Clock, Send,
} from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { formatDateToGerman } from "@/lib/dateUtils";
import telegramLogo from "@/assets/telegram-logo.png.asset.json";
import closeXLogo from "@/assets/close-x.png.asset.json";

interface Props {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onOpenLegacyDetails?: () => void;
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  alt_street: string | null;
  alt_postal_code: string | null;
  alt_city: string | null;
  tax_id: string | null;
  social_security_number: string | null;
  iban: string | null;
  bic: string | null;
  verified: boolean;
  verification_requested_at: string | null;
  employment_type: string | null;
}

interface Doc {
  id: string;
  document_type: string;
  file_path: string | null;
  uploaded_at: string;
  signedUrl?: string;
  base64_content?: string | null;
  mime_type?: string | null;
}

interface AssignedTask {
  id: string;
  title: string;
  task_type: string | null;
  status: string;
  created_at: string;
}

interface CompletedTask {
  id: string;
  task_id: string | null;
  title: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface TemplateTask {
  id: string;
  title: string;
  task_type: string | null;
}

interface EmailAddress {
  id: string;
  address: string;
  source: "outlook" | "generated";
  status?: string;
}

interface ReceivedEmail {
  id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
}

interface AssignedPhone {
  id: string;
  phone_number: string;
  service_name: string | null;
}

const DOC_LABELS: Record<string, string> = {
  id_front: "Ausweis Vorderseite",
  id_back: "Ausweis Rückseite",
  passport: "Reisepass",
  passport_front: "Reisepass Vorderseite",
  passport_back: "Reisepass Rückseite",
  license_front: "Führerschein Vorderseite",
  license_back: "Führerschein Rückseite",
};

const Copyable = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 font-mono text-sm bg-muted/60 hover:bg-muted px-2 py-0.5 rounded transition"
    >
      <span className="truncate max-w-[280px]">{value}</span>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Ausstehend", cls: "bg-purple-500/15 text-purple-600" },
    in_progress: { label: "Laufend", cls: "bg-blue-500/15 text-blue-600" },
    awaiting_review: { label: "Zur Prüfung", cls: "bg-amber-500/15 text-amber-600" },
    in_review: { label: "Zur Prüfung", cls: "bg-amber-500/15 text-amber-600" },
    kyc_completed: { label: "Zur Prüfung", cls: "bg-amber-500/15 text-amber-600" },
    completed: { label: "Erledigt", cls: "bg-emerald-500/15 text-emerald-600" },
    approved: { label: "Erledigt", cls: "bg-emerald-500/15 text-emerald-600" },
  };
  const info = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>{info.label}</span>;
};

const EmployeeManageDialog = ({ employeeId, open, onOpenChange, onChanged, onOpenLegacyDetails }: Props) => {
  const [loading, setLoading] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [templates, setTemplates] = useState<TemplateTask[]>([]);
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [phones, setPhones] = useState<AssignedPhone[]>([]);
  const [inbox, setInbox] = useState<ReceivedEmail[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [openMail, setOpenMail] = useState<ReceivedEmail | null>(null);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [pendingDemoTaskIds, setPendingDemoTaskIds] = useState<Set<string>>(new Set());
  const [activeSubmissionStatus, setActiveSubmissionStatus] = useState<Map<string, string>>(new Map());
  const [tplSearch, setTplSearch] = useState("");
  const [selectedTplIds, setSelectedTplIds] = useState<string[]>([]);
  const [selectedActiveIds, setSelectedActiveIds] = useState<string[]>([]);
  const [selectedDoneIds, setSelectedDoneIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<string>("overview");

  useEffect(() => {
    if (!open || !employeeId) return;
    void loadAll(employeeId);
  }, [open, employeeId]);

  const loadAll = async (uid: string, silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const [pRes, dRes, tRes, tplRes, eRes, gRes, phRes, csRes, pendRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("verification_uploads").select("*").eq("user_id", uid).order("uploaded_at", { ascending: false }),
        supabase.from("tasks").select("id,title,task_type,status,created_at").eq("assigned_to", uid).order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,task_type").is("assigned_to", null).is("template_id", null).order("title"),
        supabase.from("email_accounts").select("id,email_address,status").eq("assigned_to", uid),
        supabase.from("generated_emails").select("id,full_address,is_active").eq("user_id", uid).eq("is_active", true),
        supabase.from("phone_numbers").select("id,phone_number,service_name").eq("assigned_to", uid),
        supabase
          .from("task_submissions")
          .select("id,task_id,status,submitted_at,reviewed_at,tasks(title)")
          .eq("employee_id", uid)
          .in("status", ["approved", "completed", "kyc_completed"])
          .order("reviewed_at", { ascending: false })
          .limit(200),
        supabase
          .from("task_submissions")
          .select("task_id,status,submitted_at")
          .eq("employee_id", uid)
          .in("status", ["pending", "in_progress", "awaiting_review", "in_review", "kyc_completed"])
          .order("submitted_at", { ascending: false }),
      ]);

      const pendRows = (pendRes.data as any[]) || [];
      setPendingDemoTaskIds(new Set(pendRows.filter((s) => s.status === "pending").map((s) => s.task_id).filter(Boolean)));
      const subMap = new Map<string, string>();
      const priority: Record<string, number> = { awaiting_review: 4, in_review: 4, kyc_completed: 3, in_progress: 2, pending: 1 };
      for (const r of pendRows) {
        if (!r.task_id) continue;
        const cur = subMap.get(r.task_id);
        if (!cur || (priority[r.status] || 0) > (priority[cur] || 0)) subMap.set(r.task_id, r.status);
      }
      setActiveSubmissionStatus(subMap);


      if (pRes.data) setProfile(pRes.data as Profile);

      // Resolve doc URLs
      const withUrls = await Promise.all((dRes.data || []).map(async (doc: any) => {
        let url = "";
        if (doc.file_path) {
          const r1 = await supabase.storage.from("kyc-uploads").createSignedUrl(doc.file_path, 3600);
          if (r1.data?.signedUrl) url = r1.data.signedUrl;
          else {
            const r2 = await supabase.storage.from("verification-documents").createSignedUrl(doc.file_path, 3600);
            if (r2.data?.signedUrl) url = r2.data.signedUrl;
          }
        }
        if (!url && doc.base64_content) {
          url = String(doc.base64_content).startsWith("data:")
            ? String(doc.base64_content)
            : `data:${doc.mime_type || "image/jpeg"};base64,${doc.base64_content}`;
        }
        return { ...doc, signedUrl: url } as Doc;
      }));
      setDocs(withUrls);

      setAssignedTasks((tRes.data as AssignedTask[]) || []);
      const assignedTitles = new Set(((tRes.data as any[]) || []).map((t) => t.title));
      setTemplates(((tplRes.data as TemplateTask[]) || []).filter((t) => !assignedTitles.has(t.title)));

      setCompletedTasks(
        ((csRes.data as any[]) || []).map((s) => ({
          id: s.id,
          task_id: s.task_id,
          title: s.tasks?.title || "Aufgabe",
          status: s.status,
          submitted_at: s.submitted_at,
          reviewed_at: s.reviewed_at,
        }))
      );

      const combined: EmailAddress[] = [
        ...((eRes.data as any[]) || []).map((e) => ({ id: e.id, address: e.email_address, source: "outlook" as const, status: e.status })),
        ...((gRes.data as any[]) || []).map((e) => ({ id: e.id, address: e.full_address, source: "generated" as const })),
      ];
      setEmails(combined);
      setPhones(((phRes.data as any[]) || []).map((p) => ({ id: p.id, phone_number: p.phone_number, service_name: p.service_name })));

      // Load inbox for these addresses
      if (combined.length > 0) {
        setInboxLoading(true);
        const addrs = combined.map((c) => c.address.toLowerCase());
        const { data: rec } = await supabase
          .from("received_emails")
          .select("id,from_address,to_address,subject,body_text,body_html,received_at,is_read")
          .in("to_address", addrs)
          .order("received_at", { ascending: false })
          .limit(50);
        setInbox((rec as ReceivedEmail[]) || []);
        setInboxLoading(false);
      } else {
        setInbox([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Laden der Mitarbeiterdaten");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshInbox = async () => {
    if (emails.length === 0) {
      toast.info("Keine Email-Adressen zugewiesen");
      return;
    }
    setInboxLoading(true);
    try {
      // Trigger Outlook sync for assigned outlook accounts (best-effort)
      const outlookAddrs = emails.filter((e) => e.source === "outlook").map((e) => e.address);
      if (outlookAddrs.length > 0) {
        await Promise.all(
          outlookAddrs.map((addr) =>
            supabase.functions.invoke("sync-outlook-emails", { body: { email_address: addr } }).catch(() => null)
          )
        );
      }
      const addrs = emails.map((c) => c.address.toLowerCase());
      const { data: rec } = await supabase
        .from("received_emails")
        .select("id,from_address,to_address,subject,body_text,body_html,received_at,is_read")
        .in("to_address", addrs)
        .order("received_at", { ascending: false })
        .limit(50);
      setInbox((rec as ReceivedEmail[]) || []);
      toast.success("Postfach aktualisiert");
    } catch (e) {
      console.error(e);
      toast.error("Aktualisierung fehlgeschlagen");
    } finally {
      setInboxLoading(false);
    }
  };

  const reload = async () => {
    if (employeeId) await loadAll(employeeId, true);
    onChanged?.();
  };

  const handleAssign = async (templateId: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const { data: tpl, error: tplErr } = await supabase.from("tasks").select("*").eq("id", templateId).single();
      if (tplErr || !tpl) throw tplErr || new Error("Template nicht gefunden");
      const { id, created_at, updated_at, ...rest } = tpl as any;
      const { error } = await supabase.from("tasks").insert({
        ...rest,
        assigned_to: profile.id,
        template_id: templateId,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Auftrag zugewiesen");
      await reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Zuweisung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleAssignMany = async (templateIds: string[]) => {
    if (!profile || templateIds.length === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      const { data: tpls, error: tplErr } = await supabase.from("tasks").select("*").in("id", templateIds);
      if (tplErr || !tpls) throw tplErr || new Error("Vorlagen nicht gefunden");
      const rows = tpls.map((tpl: any) => {
        const { id, created_at, updated_at, ...rest } = tpl;
        return { ...rest, assigned_to: profile.id, template_id: id, status: "pending" };
      });
      for (const row of rows) {
        const { error } = await supabase.from("tasks").insert(row);
        if (error) fail++; else ok++;
      }
      if (ok > 0) toast.success(`${ok} Auftrag${ok === 1 ? "" : "äge"} zugewiesen${fail ? ` (${fail} Fehler)` : ""}`);
      if (ok === 0 && fail > 0) toast.error("Zuweisung fehlgeschlagen");
      setSelectedTplIds([]);
      await reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Zuweisung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      await supabase.from("task_submissions").delete().eq("task_id", taskId).eq("employee_id", profile.id);
      const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("assigned_to", profile.id);
      if (error) {
        // fallback unassign
        await supabase.from("tasks").update({ assigned_to: null, status: "pending" }).eq("id", taskId);
      }
      toast.success("Auftrag entfernt");
      setSelectedActiveIds((prev) => prev.filter((id) => id !== taskId));
      await reload();
    } catch (err) {
      console.error(err);
      toast.error("Entfernen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMany = async (taskIds: string[]) => {
    if (!profile || taskIds.length === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const taskId of taskIds) {
        await supabase.from("task_submissions").delete().eq("task_id", taskId).eq("employee_id", profile.id);
        const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("assigned_to", profile.id);
        if (error) {
          const { error: e2 } = await supabase.from("tasks").update({ assigned_to: null, status: "pending" }).eq("id", taskId);
          if (e2) fail++; else ok++;
        } else {
          ok++;
        }
      }
      if (ok > 0) toast.success(`${ok} Auftrag${ok === 1 ? "" : "äge"} entfernt${fail ? ` (${fail} Fehler)` : ""}`);
      if (ok === 0 && fail > 0) toast.error("Entfernen fehlgeschlagen");
      setSelectedActiveIds([]);
      await reload();
    } catch (err) {
      console.error(err);
      toast.error("Entfernen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveCompleted = async (items: { taskId: string | null; submissionId: string | null }[]) => {
    if (!profile || items.length === 0) return;
    setBusy(true);
    let ok = 0, fail = 0;
    try {
      for (const it of items) {
        try {
          // Lösche Honorar/Rechnungen explizit (auch falls submission_id null ist)
          if (it.taskId) {
            await supabase.from("freelancer_invoices").delete().eq("task_id", it.taskId).eq("user_id", profile.id);
            await supabase.from("task_file_uploads").delete().eq("task_id", it.taskId).eq("user_id", profile.id);
            await supabase.from("task_submissions").delete().eq("task_id", it.taskId).eq("employee_id", profile.id);
            const { error } = await supabase.from("tasks").delete().eq("id", it.taskId).eq("assigned_to", profile.id);
            if (error) {
              // Fallback: nur Zuweisung entfernen
              await supabase.from("tasks").update({ assigned_to: null }).eq("id", it.taskId);
            }
          } else if (it.submissionId) {
            await supabase.from("task_submissions").delete().eq("id", it.submissionId).eq("employee_id", profile.id);
          }
          ok++;
        } catch (e) {
          console.error(e);
          fail++;
        }
      }
      if (ok > 0) toast.success(`${ok} Auftrag${ok === 1 ? "" : "äge"} samt Verlauf entfernt${fail ? ` (${fail} Fehler)` : ""}`);
      if (ok === 0 && fail > 0) toast.error("Entfernen fehlgeschlagen");
      setSelectedDoneIds([]);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleAssignOutlook = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const { data: free, error: fErr } = await supabase
        .from("email_accounts")
        .select("id, email_address")
        .eq("status", "available")
        .ilike("provider", "%outlook%")
        .is("assigned_to", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fErr) throw fErr;
      if (!free?.id) {
        toast.error("Keine freie Outlook-E-Mail verfügbar");
        return;
      }
      const { error } = await supabase
        .from("email_accounts")
        .update({ assigned_to: profile.id, status: "assigned" })
        .eq("id", free.id);
      if (error) throw error;
      toast.success(`Outlook zugewiesen: ${free.email_address}`);
      await reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Outlook-Zuweisung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseOutlook = async (accountId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("email_accounts")
        .update({ assigned_to: null, status: "available" })
        .eq("id", accountId);
      if (error) throw error;
      toast.success("Outlook freigegeben");
      await reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Freigabe fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!employeeId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-employee", { body: { employeeId } });
      if (error) throw error;
      toast.success("Mitarbeiter gelöscht");
      onOpenChange(false);
      onChanged?.();
    } catch (err: any) {
      console.error(err);
      toast.error(`Fehler beim Löschen: ${err?.message || "Unbekannt"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleVerify = async (approve: boolean) => {
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ verified: approve }).eq("id", profile.id);
      if (error) throw error;
      toast.success(approve ? "Verifiziert" : "Abgelehnt");
      await reload();
    } catch (err) {
      console.error(err);
      toast.error("Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const saveProfileField = async (field: keyof Profile, value: string | null) => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value } as any)
      .eq("id", profile.id);
    if (error) {
      toast.error(`Fehler beim Speichern (${field})`);
      return;
    }
    setProfile({ ...profile, [field]: value } as Profile);
    toast.success("Gespeichert");
  };

  const handleSendToTelegram = async () => {
    if (!profile) return;
    setSendingTelegram(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-notify", {
        body: {
          user_id: profile.id,
          employee: {
            first_name: profile.first_name,
            last_name: profile.last_name,
            birth_date: formatDateToGerman(profile.birth_date),
            city: profile.city,
            street: profile.street,
            postal_code: profile.postal_code,
            email: profile.email,
            phone: profile.phone,
            alt_street: profile.alt_street,
            alt_postal_code: profile.alt_postal_code,
            alt_city: profile.alt_city,
          },
        },
      });
      if (error) throw error;
      toast.success("Daten an Telegram gesendet");
    } catch (err) {
      console.error("Telegram notification failed:", err);
      toast.error("Telegram-Weiterleitung fehlgeschlagen");
    } finally {
      setSendingTelegram(false);
    }
  };



  const filteredTpl = useMemo(
    () => templates.filter((t) => t.title.toLowerCase().includes(tplSearch.toLowerCase())),
    [templates, tplSearch]
  );

  const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col [&>button.absolute:not([data-custom-close])]:hidden">
        <button
          type="button"
          data-custom-close
          onClick={() => onOpenChange(false)}
          aria-label="Schließen"
          className="absolute right-4 top-4 z-50 rounded-md p-1 hover:bg-muted transition"
        >
          <img src={closeXLogo.url} alt="" className="h-9 w-9" />
        </button>
        <SheetHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5" />
                {fullName || "Mitarbeiter"}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span>{profile?.email}</span>
                {profile?.verified ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Verifiziert</Badge>
                ) : profile?.verification_requested_at ? (
                  <Badge variant="secondary">KYC ausstehend</Badge>
                ) : (
                  <Badge variant="outline">Nicht angefordert</Badge>
                )}
              </SheetDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendToTelegram}
              disabled={sendingTelegram || !profile}
              className="gap-1.5 mr-12"
            >
              {sendingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : <img src={telegramLogo.url} alt="" className="h-4 w-4" />}
              Telegram weiterleiten
            </Button>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-3 grid grid-cols-4 shrink-0">
              <TabsTrigger value="overview"><FileText className="h-4 w-4 mr-1.5" />Stammdaten</TabsTrigger>
              <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-1.5" />Aufträge<span className="ml-1.5 text-xs text-muted-foreground">({assignedTasks.length})</span></TabsTrigger>
              <TabsTrigger value="emails"><Mail className="h-4 w-4 mr-1.5" />Ressourcen<span className="ml-1.5 text-xs text-muted-foreground">({inbox.length})</span></TabsTrigger>
              <TabsTrigger value="danger"><Trash2 className="h-4 w-4 mr-1.5" />Löschen</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4 space-y-5">
                  <section className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EditableField label="Vorname" value={profile?.first_name || ""} onSave={(v) => saveProfileField("first_name", v)} />
                      <EditableField label="Nachname" value={profile?.last_name || ""} onSave={(v) => saveProfileField("last_name", v)} />
                      <EditableField icon={<Calendar className="h-4 w-4" />} label="Geburtsdatum" type="date" value={profile?.birth_date || ""} onSave={(v) => saveProfileField("birth_date", v)} />
                      <EditableField label="Geburtsort" value={profile?.place_of_birth || ""} onSave={(v) => saveProfileField("place_of_birth", v)} />
                      <EditableField label="Nationalität" value={profile?.nationality || ""} onSave={(v) => saveProfileField("nationality", v)} />
                      <EditableField icon={<Phone className="h-4 w-4" />} label="Telefon" value={profile?.phone || ""} onSave={(v) => saveProfileField("phone", v)} />
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Hauptadresse
                      </div>
                      <div className="grid grid-cols-6 gap-3">
                        <EditableField label="Straße & Nr." value={profile?.street || ""} onSave={(v) => saveProfileField("street", v)} className="col-span-3" />
                        <EditableField label="PLZ" value={profile?.postal_code || ""} onSave={(v) => saveProfileField("postal_code", v)} className="col-span-1" />
                        <EditableField label="Ort" value={profile?.city || ""} onSave={(v) => saveProfileField("city", v)} className="col-span-2" />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Abweichende Adresse
                      </div>
                      <div className="grid grid-cols-6 gap-3">
                        <EditableField label="Straße & Nr." value={profile?.alt_street || ""} onSave={(v) => saveProfileField("alt_street", v)} className="col-span-3" />
                        <EditableField label="PLZ" value={profile?.alt_postal_code || ""} onSave={(v) => saveProfileField("alt_postal_code", v)} className="col-span-1" />
                        <EditableField label="Ort" value={profile?.alt_city || ""} onSave={(v) => saveProfileField("alt_city", v)} className="col-span-2" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <EditableField icon={<CreditCard className="h-4 w-4" />} label="Steuer-ID" value={profile?.tax_id || ""} onSave={(v) => saveProfileField("tax_id", v)} />
                      <EditableField icon={<Shield className="h-4 w-4" />} label="SV-Nr." value={profile?.social_security_number || ""} onSave={(v) => saveProfileField("social_security_number", v)} />
                      <EditableField label="IBAN" value={profile?.iban || ""} onSave={(v) => saveProfileField("iban", v)} />
                      <EditableField label="BIC" value={profile?.bic || ""} onSave={(v) => saveProfileField("bic", v)} />
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4" /> Ausweisdokumente
                        <Badge variant="outline" className="ml-1">{docs.length}</Badge>
                      </h3>
                      {profile?.verification_requested_at && !profile?.verified && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleVerify(false)} disabled={busy}>Ablehnen</Button>
                          <Button size="sm" onClick={() => handleVerify(true)} disabled={busy}>Verifizieren</Button>
                        </div>
                      )}
                    </div>
                    {docs.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                        Keine Dokumente vorhanden
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {docs.map((d) => (
                          <div key={d.id} className="border rounded-lg p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{DOC_LABELS[d.document_type] || d.document_type}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(d.uploaded_at).toLocaleDateString("de-DE")}</span>
                            </div>
                            {d.signedUrl ? (
                              <a href={d.signedUrl} target="_blank" rel="noreferrer" className="block">
                                <img src={d.signedUrl} alt={d.document_type} className="w-full h-32 object-cover rounded border hover:opacity-90 transition" />
                              </a>
                            ) : (
                              <div className="h-32 flex items-center justify-center bg-muted rounded text-xs text-muted-foreground">Nicht verfügbar</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TASKS */}
            <TabsContent value="tasks" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4 space-y-5">
                  {(() => {
                    const isDone = (s: string) => ["approved", "completed", "kyc_completed"].includes(s);
                    const completedTaskIds = new Set(completedTasks.map((c) => c.task_id).filter(Boolean) as string[]);
                    const active = assignedTasks.filter((t) => !isDone(t.status) && !completedTaskIds.has(t.id));
                    const doneFromTasks = assignedTasks.filter((t) => isDone(t.status) || completedTaskIds.has(t.id));
                    const doneCombined: { id: string; taskId: string | null; submissionId: string | null; title: string; status: string; when: string }[] = [
                      ...doneFromTasks.map((t) => ({ id: t.id, taskId: t.id, submissionId: null, title: t.title, status: t.status, when: t.created_at })),
                      ...completedTasks.map((c) => ({ id: c.id, taskId: c.task_id || null, submissionId: c.id, title: c.title, status: c.status, when: c.reviewed_at || c.submitted_at || "" })),
                    ];
                    const seen = new Set<string>();
                    const doneUnique = doneCombined.filter((d) => {
                      const k = d.title.toLowerCase();
                      if (seen.has(k)) return false;
                      seen.add(k);
                      return true;
                    });
                    return (
                      <>
                        <section>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" /> Aktive Aufträge
                            <Badge variant="outline">{active.length}</Badge>
                          </h3>
                          {active.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">Keine aktiven Aufträge</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={selectedActiveIds.length > 0 && active.every((t) => selectedActiveIds.includes(t.id))}
                                    onCheckedChange={(c) => {
                                      if (c) setSelectedActiveIds(active.map((t) => t.id));
                                      else setSelectedActiveIds([]);
                                    }}
                                  />
                                  Alle auswählen
                                </label>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy || selectedActiveIds.length === 0}
                                  onClick={() => handleRemoveMany(selectedActiveIds)}
                                >
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  {selectedActiveIds.length > 0 ? `${selectedActiveIds.length} entfernen` : "Entfernen"}
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {active.map((t) => {
                                  const checked = selectedActiveIds.includes(t.id);
                                  return (
                                    <div key={t.id} className="flex items-center gap-3 border rounded-lg px-3 py-2 hover:bg-muted/40 transition">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(c) =>
                                          setSelectedActiveIds((prev) => c ? [...prev, t.id] : prev.filter((id) => id !== t.id))
                                        }
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">{t.title}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {pendingDemoTaskIds.has(t.id) ? (
                                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 inline-flex items-center gap-1">
                                              <Clock className="h-3 w-3" /> Wartet auf Demo-Daten
                                            </span>
                                          ) : (
                                            <StatusBadge status={activeSubmissionStatus.get(t.id) || t.status} />
                                          )}
                                          {t.task_type && <span className="text-[11px] text-muted-foreground">{t.task_type}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </section>

                        <Separator />

                        <section>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" /> Abgeschlossene Aufträge
                            <Badge variant="outline">{doneUnique.length}</Badge>
                          </h3>
                          {doneUnique.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">Noch keine abgeschlossenen Aufträge</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={selectedDoneIds.length > 0 && doneUnique.every((t) => selectedDoneIds.includes(t.id))}
                                    onCheckedChange={(c) => {
                                      if (c) setSelectedDoneIds(doneUnique.map((t) => t.id));
                                      else setSelectedDoneIds([]);
                                    }}
                                  />
                                  Alle auswählen
                                </label>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={busy || selectedDoneIds.length === 0}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                                      {selectedDoneIds.length > 0 ? `${selectedDoneIds.length} entfernen` : "Entfernen"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Aufträge endgültig entfernen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Sämtlicher Verlauf (Einreichungen, hochgeladene Nachweise sowie zugehörige Honorar-Rechnungen) wird unwiderruflich gelöscht.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          const items = doneUnique
                                            .filter((d) => selectedDoneIds.includes(d.id))
                                            .map((d) => ({ taskId: d.taskId, submissionId: d.submissionId }));
                                          handleRemoveCompleted(items);
                                        }}
                                      >
                                        Endgültig löschen
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                              <div className="space-y-2">
                                {doneUnique.map((t) => {
                                  const checked = selectedDoneIds.includes(t.id);
                                  return (
                                    <div key={t.id} className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-emerald-500/5">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(c) =>
                                          setSelectedDoneIds((prev) => c ? [...prev, t.id] : prev.filter((id) => id !== t.id))
                                        }
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">{t.title}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <StatusBadge status={t.status} />
                                          {t.when && <span className="text-[11px] text-muted-foreground">{new Date(t.when).toLocaleDateString("de-DE")}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </section>
                      </>
                    );
                  })()}

                  <Separator />

                  <section>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Plus className="h-4 w-4" /> Vorlagen zuweisen
                      <Badge variant="outline">{filteredTpl.length}</Badge>
                    </h3>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Vorlage suchen…" className="pl-8" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} />
                    </div>
                    {filteredTpl.length > 0 && (
                      <div className="flex items-center justify-between gap-3 mb-2 px-1">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={selectedTplIds.length > 0 && filteredTpl.every((t) => selectedTplIds.includes(t.id))}
                            onCheckedChange={(c) => {
                              if (c) setSelectedTplIds(Array.from(new Set([...selectedTplIds, ...filteredTpl.map((t) => t.id)])));
                              else setSelectedTplIds(selectedTplIds.filter((id) => !filteredTpl.some((t) => t.id === id)));
                            }}
                          />
                          Alle auswählen
                        </label>
                        <Button
                          size="sm"
                          disabled={busy || selectedTplIds.length === 0}
                          onClick={() => handleAssignMany(selectedTplIds)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> {selectedTplIds.length > 0 ? `${selectedTplIds.length} zuweisen` : "Zuweisen"}
                        </Button>
                      </div>
                    )}
                    {filteredTpl.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">Keine passenden Vorlagen</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-auto pr-1">
                        {filteredTpl.map((t) => {
                          const checked = selectedTplIds.includes(t.id);
                          return (
                            <div key={t.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  setSelectedTplIds((prev) => c ? [...prev, t.id] : prev.filter((id) => id !== t.id));
                                }}
                              />
                               <div className="min-w-0 flex-1">
                                 <div className="text-sm truncate">{t.title}</div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* EMAILS */}
            <TabsContent value="emails" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4 space-y-5">
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" /> Zugewiesene Emails & Telefonnummern
                      </h3>
                      <Button size="sm" variant="outline" disabled={busy} onClick={handleAssignOutlook}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Outlook zuweisen
                      </Button>
                    </div>
                    {emails.length === 0 && phones.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">Keine zugewiesenen Ressourcen</p>
                    ) : (
                      <div className="space-y-1.5">
                        {emails.map((e) => (
                          <div key={`${e.source}-${e.id}`} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Copyable value={e.address} />
                            </div>
                            <Badge variant="outline" className="text-[10px]">{e.source === "outlook" ? "Outlook" : "Generated"}</Badge>
                            {e.source === "outlook" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => handleReleaseOutlook(e.id)} title="Freigeben">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {phones.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <Copyable value={p.phone_number} />
                            {p.service_name && <span className="text-xs text-muted-foreground">({p.service_name})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <Separator />

                  <section className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <Label htmlFor="nect_link_input" className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Link2 className="h-4 w-4" /> NECT-Legitimationslink
                        <span className="text-xs text-muted-foreground font-normal">
                          (persönlicher Link für die NECT-Identitätsprüfung)
                        </span>
                      </Label>
                      <Input
                        id="nect_link_input"
                        type="url"
                        placeholder="https://nect.com/legitimation/..."
                        defaultValue={(profile as any)?.nect_link || ""}
                        disabled={busy}
                        onBlur={async (e) => {
                          if (!profile) return;
                          const newVal = e.target.value.trim() || null;
                          const currentVal = (profile as any)?.nect_link || null;
                          if (newVal === currentVal) return;
                          const { error } = await supabase
                            .from("profiles")
                            .update({ nect_link: newVal } as any)
                            .eq("id", profile.id);
                          if (error) {
                            toast.error("Fehler beim Speichern des NECT-Links");
                          } else {
                            toast.success("NECT-Link gespeichert");
                            setProfile({ ...profile, nect_link: newVal } as any);
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Wird dem Mitarbeiter im Rufnummern-Zuweisungs-Popup angezeigt. Verlässt das Feld zum Speichern.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-background p-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Ressourcen-Popup freigeben</p>
                        <p className="text-xs text-muted-foreground">
                          Erst nach dieser Freigabe verschwindet das blockierende Popup beim Mitarbeiter.
                        </p>
                      </div>
                      <Switch
                        checked={(profile as any)?.resource_assignment_approved === true}
                        disabled={busy || !profile}
                        onCheckedChange={async (checked) => {
                          if (!profile) return;
                          const { error } = await supabase
                            .from("profiles")
                            .update({ resource_assignment_approved: checked } as any)
                            .eq("id", profile.id);
                          if (error) {
                            toast.error("Freigabe konnte nicht gespeichert werden");
                            return;
                          }
                          toast.success(checked ? "Popup freigegeben" : "Freigabe zurückgenommen");
                          setProfile({ ...profile, resource_assignment_approved: checked } as any);
                        }}
                      />
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Inbox className="h-4 w-4" /> Posteingang
                        <Badge variant="outline">{inbox.length}</Badge>
                      </h3>
                      <div className="flex items-center gap-2">
                        {inboxLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <Button size="sm" variant="outline" onClick={refreshInbox} disabled={inboxLoading}>
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${inboxLoading ? "animate-spin" : ""}`} /> Aktualisieren
                        </Button>
                      </div>
                    </div>
                    {inbox.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">Keine Emails empfangen</p>
                    ) : (
                      <div className="space-y-1 max-h-[420px] overflow-auto pr-1">
                        {inbox.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setOpenMail(m)}
                            className={`w-full text-left border rounded-lg px-3 py-2 hover:bg-muted/50 transition ${!m.is_read ? "bg-primary/5 border-primary/30" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{m.from_address}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(m.received_at).toLocaleString("de-DE")}</span>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{m.subject || "(kein Betreff)"}</div>
                            <div className="text-[11px] text-muted-foreground/70 truncate">→ {m.to_address}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* DANGER */}
            <TabsContent value="danger" className="flex-1 min-h-0 mt-0">
              <div className="px-6 py-6 space-y-4">
                <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-destructive">Mitarbeiter unwiderruflich löschen</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Profil, Aufträge, Submissions, Dokumente, Honorare und Zuweisungen werden entfernt.
                        Email- und Telefonressourcen werden freigegeben.
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={deleting}>
                        {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        {fullName} endgültig löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {fullName} und alle zugehörigen Daten werden dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                          Endgültig löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Email viewer */}
        <Dialog open={!!openMail} onOpenChange={(o) => !o && setOpenMail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">{openMail?.subject || "(kein Betreff)"}</DialogTitle>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Von: <span className="font-mono">{openMail?.from_address}</span></div>
                <div>An: <span className="font-mono">{openMail?.to_address}</span></div>
                <div>{openMail && new Date(openMail.received_at).toLocaleString("de-DE")}</div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              {openMail?.body_html ? (
                <iframe
                  title="email"
                  sandbox="allow-same-origin"
                  srcDoc={`<base target="_blank">${openMail.body_html}`}
                  className="w-full h-[60vh]"
                />
              ) : (
                <pre className="p-4 text-sm whitespace-pre-wrap font-sans">{openMail?.body_text || ""}</pre>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};

const Field = ({ icon, label, value, className = "" }: { icon?: React.ReactNode; label: string; value: string; className?: string }) => (
  <div className={className}>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
      {icon}{label}
    </div>
    <div className="mt-0.5">
      {value ? <Copyable value={value} /> : <span className="text-sm text-muted-foreground">—</span>}
    </div>
  </div>
);

interface EditableFieldProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  className?: string;
  type?: string;
  placeholder?: string;
  onSave: (newValue: string | null) => Promise<void>;
}

const EditableField = ({ icon, label, value, className = "", type = "text", placeholder, onSave }: EditableFieldProps) => {
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
        {icon}{label}
      </div>
      <Input
        type={type}
        value={val}
        placeholder={placeholder || "—"}
        onChange={(e) => setVal(e.target.value)}
        onBlur={async () => {
          const trimmed = val.trim();
          const newVal = trimmed === "" ? null : trimmed;
          const current = (value || "").trim() || null;
          if (newVal === current) return;
          await onSave(newVal);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
};

export default EmployeeManageDialog;
