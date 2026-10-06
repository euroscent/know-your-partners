import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, MapPin, Calendar, CreditCard, Shield, Mail, Phone, Briefcase, Copy, Check } from "lucide-react";

interface EmployeeDetailDialogProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  first_name: string | null;
  last_name: string | null;
  email: string;
  birth_date: string | null;
  place_of_birth: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  alt_street: string | null;
  alt_postal_code: string | null;
  alt_city: string | null;
  tax_id: string | null;
  social_security_number: string | null;
  phone: string | null;
  nationality: string | null;
  iban: string | null;
  bic: string | null;
}

interface TaskInfo {
  title: string;
  status: string;
  email?: string;
  notes?: string;
}

const EmployeeDetailDialog = ({ employeeId, open, onOpenChange }: EmployeeDetailDialogProps) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  const [assignedPhones, setAssignedPhones] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (open && employeeId) {
      fetchDetails(employeeId);
    }
  }, [open, employeeId]);

  const fetchDetails = async (uid: string) => {
    setLoading(true);

    const [profileRes, emailRes, genEmailRes, phoneRes, submissionsRes] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name, email, birth_date, place_of_birth, street, postal_code, city, alt_street, alt_postal_code, alt_city, tax_id, social_security_number, phone, nationality, iban, bic").eq("id", uid).single(),
      supabase.from("email_accounts").select("email_address").eq("assigned_to", uid),
      supabase.from("generated_emails").select("full_address, submission_id").eq("user_id", uid).eq("is_active", true),
      supabase.from("phone_numbers").select("phone_number, service_name").eq("assigned_to", uid),
      supabase.from("task_submissions").select("id, status, notes, admin_data, tasks(title)").eq("employee_id", uid),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    const emails = [
      ...(emailRes.data?.map(e => e.email_address) || []),
      ...(genEmailRes.data?.map(e => e.full_address) || []),
    ];
    setAssignedEmails(emails);

    setAssignedPhones(phoneRes.data?.map(p => p.service_name ? `${p.phone_number} (${p.service_name})` : p.phone_number) || []);

    const genEmailMap = new Map(genEmailRes.data?.map(e => [e.submission_id, e.full_address]) || []);

    const taskList: TaskInfo[] = (submissionsRes.data || []).map((s: any) => ({
      title: s.tasks?.title || "Unbekannt",
      status: s.status || "unknown",
      email: genEmailMap.get(s.id) || (s.admin_data as any)?.email || undefined,
      notes: s.notes || undefined,
    }));
    setTasks(taskList);

    setLoading(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const CopyableValue = ({ value, field }: { value: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(value, field)}
      className="inline-flex items-center gap-1 font-mono text-sm bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors cursor-pointer"
    >
      {value}
      {copiedField === field ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      pending: { label: "🟣 Ausstehend", variant: "secondary" },
      in_progress: { label: "🔄 Laufend", variant: "outline" },
      awaiting_review: { label: "⏳ Zur Prüfung", variant: "outline" },
      in_review: { label: "⏳ Zur Prüfung", variant: "outline" },
      completed: { label: "✅ Erledigt", variant: "default" },
      approved: { label: "✅ Erledigt", variant: "default" },
      kyc_completed: { label: "⏳ Zur Prüfung", variant: "outline" },
    };
    const info = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";
  const birthDate = profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString("de-DE") : null;
  const birthInfo = [birthDate, profile?.place_of_birth].filter(Boolean).join(", ");
  const address = profile ? `${profile.street || "-"}, ${profile.postal_code || ""} ${profile.city || ""}` : "";
  const altAddress = profile?.alt_street ? `${profile.alt_street}, ${profile.alt_postal_code || ""} ${profile.alt_city || ""}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Mitarbeiter-Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <h3 className="text-lg font-semibold">👤 {fullName}</h3>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>

            <Separator />

            {/* Personal Info */}
            <div className="space-y-2">
              {birthInfo && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <CopyableValue value={birthInfo} field="birth" />
                </div>
              )}
              {profile.nationality && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">🌍</span>
                  <span>{profile.nationality}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <CopyableValue value={address} field="address" />
              </div>
              {altAddress && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground mr-1">Abw.:</span>
                  <CopyableValue value={altAddress} field="altAddress" />
                </div>
              )}
            </div>

            {/* IDs */}
            {(profile.tax_id || profile.social_security_number) && (
              <>
                <Separator />
                <div className="space-y-2">
                  {profile.tax_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Steuer-ID:</span>
                      <CopyableValue value={profile.tax_id} field="tax" />
                    </div>
                  )}
                  {profile.social_security_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">SV-Nr.:</span>
                      <CopyableValue value={profile.social_security_number} field="svnr" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Bank */}
            {profile.iban && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">🏦 IBAN:</span>
                    <CopyableValue value={profile.iban} field="iban" />
                  </div>
                  {profile.bic && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground ml-5">BIC:</span>
                      <CopyableValue value={profile.bic} field="bic" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Emails & Phones */}
            {(assignedEmails.length > 0 || assignedPhones.length > 0 || profile.phone) && (
              <>
                <Separator />
                <div className="space-y-2">
                  {profile.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <CopyableValue value={profile.phone} field="phone" />
                    </div>
                  )}
                  {assignedEmails.map((email, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <CopyableValue value={email} field={`email-${i}`} />
                    </div>
                  ))}
                  {assignedPhones.map((phone, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <CopyableValue value={phone} field={`aphone-${i}`} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Briefcase className="h-4 w-4" />
                    Aufträge ({tasks.length})
                  </div>
                  {tasks.map((task, i) => (
                    <div key={i} className="text-sm pl-6 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{task.title}</span>
                        {getStatusBadge(task.status)}
                      </div>
                      {task.email && (
                        <div className="text-xs text-muted-foreground">📧 {task.email}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Profil nicht gefunden</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDetailDialog;
