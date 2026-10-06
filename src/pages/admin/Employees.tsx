import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminApplications from "@/pages/AdminApplications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Eye, AlertCircle, FileText, Trash2, ClipboardList, Clock, CheckCheck, Search, UserCircle, Hexagon, Settings, Copy, Check, StickyNote, Loader2, UserPlus, Bell, BellOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast-stub";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { formatDateToGerman } from "@/lib/dateUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TasksAmpelSystem } from "@/components/admin/TasksAmpelSystem";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import EmployeeManageDialog from "@/components/admin/EmployeeManageDialog";

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  verified: boolean;
  verification_requested_at: string | null;
  phone: string | null;
  birth_date: string | null;
  nationality: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  tax_id: string | null;
  social_security_number: string | null;
  iban: string | null;
  bic: string | null;
  account_holder: string | null;
  health_insurance: string | null;
  marital_status: string | null;
  employment_type: string | null;
  start_date?: string | null;
  mentor_id?: string | null;
  admin_notes?: string | null;
  place_of_birth?: string | null;
  country_of_birth?: string | null;
  telegram_notifications_enabled?: boolean;
  salutation?: string | null;
  resource_assignment_approved?: boolean;
}

interface VirtualEmployee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
}

interface VerificationDocument {
  id: string;
  document_type: string;
  file_path: string | null;
  uploaded_at: string;
  signedUrl?: string;
  base64_content?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  step_responses: any[];
  tasks: {
    title: string;
    task_type: string | null;
    steps: any[] | null;
  } | null;
}

interface AssignedTask {
  id: string;
  title: string;
  task_type: string | null;
  status: string;
  assigned_to: string;
  created_at: string;
  due_date: string | null;
  steps: any[] | null;
}

interface AssignedEmailAccount {
  id: string;
  email_address: string;
  status: string;
}

interface GeneratedEmail {
  id: string;
  full_address: string;
  is_active: boolean;
  created_at: string;
}

interface AssignedPhoneNumber {
  id: string;
  phone_number: string;
  status: string;
  provider: string | null;
  service_name: string | null;
}

// Copyable Field Component
const CopyableField = ({ 
  label, 
  value, 
  className = "", 
  mono = false 
}: { 
  label: string; 
  value: string | null | undefined; 
  className?: string; 
  mono?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const displayValue = value || "-";
  const hasCopyableValue = !!value && value !== "-";

  const handleCopy = async () => {
    if (!hasCopyableValue) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} kopiert`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`font-medium ${mono ? "font-mono" : ""}`}>{displayValue}</p>
        {hasCopyableValue && (
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-muted transition-colors"
            title={`${label} kopieren`}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsEmployee, setDetailsEmployee] = useState<Employee | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [kycUploads, setKycUploads] = useState<VerificationDocument[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<TaskSubmission[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [availableTasks, setAvailableTasks] = useState<AssignedTask[]>([]);
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [selectedEmployeeForTasks, setSelectedEmployeeForTasks] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [virtualEmployees, setVirtualEmployees] = useState<VirtualEmployee[]>([]);
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [employeeDocCounts, setEmployeeDocCounts] = useState<Record<string, number>>({});
  const [loadingDocCounts, setLoadingDocCounts] = useState(false);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [docsDialogEmployee, setDocsDialogEmployee] = useState<Employee | null>(null);
  const [docsForDialog, setDocsForDialog] = useState<VerificationDocument[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAssignConfirmDialog, setShowAssignConfirmDialog] = useState(false);
  const [assignedEmails, setAssignedEmails] = useState<AssignedEmailAccount[]>([]);
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [assignedPhones, setAssignedPhones] = useState<AssignedPhoneNumber[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesChanged, setNotesChanged] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  
  // Create employee dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeFirstName, setNewEmployeeFirstName] = useState("");
  const [newEmployeeLastName, setNewEmployeeLastName] = useState("");
  const [newEmployeeType, setNewEmployeeType] = useState("vollzeit");
  const [newEmployeePassword, setNewEmployeePassword] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createdEmployeeInfo, setCreatedEmployeeInfo] = useState<{ email: string; password: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [newEmployeeVerified, setNewEmployeeVerified] = useState(false);
  const [manageEmployeeId, setManageEmployeeId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    checkAdminAndFetchEmployees();
    fetchVirtualEmployees();
  }, []);

  // Fetch document counts for all employees
  useEffect(() => {
    const fetchDocCounts = async () => {
      setLoadingDocCounts(true);
      const { data, error } = await supabase
        .from("verification_uploads")
        .select("user_id");

      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach((doc) => {
          counts[doc.user_id] = (counts[doc.user_id] || 0) + 1;
        });
        setEmployeeDocCounts(counts);
      }
      setLoadingDocCounts(false);
    };

    // only run once employees list is loaded
    if (!loading) fetchDocCounts();
  }, [loading, employees]);

  const fetchAssignedTasks = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, task_type, status, assigned_to, created_at, due_date, steps")
      .eq("assigned_to", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assigned tasks:", error);
    } else {
      setAssignedTasks((data as any) || []);
    }
  };

  const fetchAvailableTasks = async (employeeId?: string) => {
    // Nur echte Vorlagen laden (Tasks ohne Zuweisung = assigned_to IS NULL)
    // Zugewiesene Tasks sind KEINE Vorlagen mehr!
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, task_type, status, assigned_to, created_at, due_date, steps, description, client_id, attachments, tags, email_required, email_account_id, image_url, estimated_hours, compensation_amount, google_play_url, apple_store_url")
      .is("assigned_to", null)
      .is("template_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching available tasks:", error);
      return;
    }

    // Hole die zugewiesenen Tasks des Mitarbeiters um Duplikate zu vermeiden
    let assignedTaskTitles: string[] = [];
    if (employeeId) {
      const { data: assignedData } = await supabase
        .from("tasks")
        .select("title")
        .eq("assigned_to", employeeId);
      assignedTaskTitles = (assignedData || []).map((t: any) => t.title);
    }

    // Filter: Verstecke Vorlagen deren Titel bereits diesem Mitarbeiter zugewiesen ist
    const templates = (data || []).filter((t: any) => {
      return !assignedTaskTitles.includes(t.title);
    });
    
    setAvailableTasks(templates as any);
  };

  const fetchVirtualEmployees = async () => {
    const { data, error } = await supabase
      .from("virtual_employees")
      .select("*")
      .eq("is_active", true)
      .order("first_name");
    
    if (error) {
      console.error("Error fetching virtual employees:", error);
    } else {
      setVirtualEmployees(data || []);
    }
  };

  const handleAssignMentor = async (employeeId: string, mentorId: string | null) => {
    setAssigningMentor(true);
    const { error } = await supabase
      .from("profiles")
      .update({ mentor_id: mentorId })
      .eq("id", employeeId);
    
    if (error) {
      toast.error("Mentor konnte nicht zugewiesen werden");
    } else {
      toast.success(mentorId ? "Mentor wurde zugewiesen" : "Mentor wurde entfernt");
      // Update local state
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, mentor_id: mentorId } : e));
      if (detailsEmployee?.id === employeeId) {
        setDetailsEmployee(prev => prev ? { ...prev, mentor_id: mentorId } : null);
      }
    }
    setAssigningMentor(false);
  };

  const checkAdminAndFetchEmployees = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    if (!roles?.some((r) => r.role === "admin")) {
      navigate("/dashboard");
      return;
    }

    await fetchEmployees();
  };

  const fetchEmployees = async () => {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching employees:", profilesError);
      setLoading(false);
      return;
    }

    // Fetch all admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
    }

    // Fetch start dates from employee_documents (contracts)
    const { data: contracts } = await supabase
      .from("employee_documents")
      .select("user_id, start_date")
      .eq("document_type", "contract")
      .order("created_at", { ascending: false });

    // Create a map of user_id to start_date (use the most recent contract)
    const startDateMap = new Map<string, string>();
    (contracts || []).forEach((contract) => {
      if (contract.start_date && !startDateMap.has(contract.user_id)) {
        startDateMap.set(contract.user_id, contract.start_date);
      }
    });

    // Filter out admins from the employee list and add start_date
    const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const nonAdminEmployees = (profiles || []).filter(p => !adminIds.has(p.id)).map(p => ({
      ...p,
      start_date: startDateMap.get(p.id) || p.start_date || null,
    }));
    
    setEmployees(nonAdminEmployees);
    setLoading(false);
  };

  const fetchVerificationDocuments = async (userId: string) => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("verification_uploads")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching verification documents:", error);
      toast.error("Fehler beim Laden der Dokumente");
      setLoadingDocs(false);
      return;
    }

    const docsWithUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        let signedUrl = "";

        if (doc.file_path) {
          // Try kyc-uploads first
          const { data: urlData, error: urlErr1 } = await supabase.storage
            .from("kyc-uploads")
            .createSignedUrl(doc.file_path, 60 * 60);
          if (!urlErr1 && urlData?.signedUrl) {
            signedUrl = urlData.signedUrl;
          } else {
            // Fallback: verification-documents bucket
            const { data: urlData2, error: urlErr2 } = await supabase.storage
              .from("verification-documents")
              .createSignedUrl(doc.file_path, 60 * 60);
            if (!urlErr2 && urlData2?.signedUrl) {
              signedUrl = urlData2.signedUrl;
            }
          }
        }

        if (!signedUrl && doc.base64_content) {
          signedUrl = String(doc.base64_content).startsWith("data:")
            ? String(doc.base64_content)
            : `data:${doc.mime_type || "image/jpeg"};base64,${doc.base64_content}`;
        }

        return { ...doc, signedUrl };
      })
    );

    setVerificationDocs(docsWithUrls as any);
    setLoadingDocs(false);
  };

  const fetchKycUploads = async (userId: string) => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("verification_uploads")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching KYC uploads:", error);
      setLoadingDocs(false);
      return;
    }

    const docsWithUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        let signedUrl = "";

        if (doc.file_path) {
          const { data: urlData, error: urlErr1 } = await supabase.storage
            .from("kyc-uploads")
            .createSignedUrl(doc.file_path, 60 * 60);
          if (!urlErr1 && urlData?.signedUrl) {
            signedUrl = urlData.signedUrl;
          } else {
            const { data: urlData2, error: urlErr2 } = await supabase.storage
              .from("verification-documents")
              .createSignedUrl(doc.file_path, 60 * 60);
            if (!urlErr2 && urlData2?.signedUrl) {
              signedUrl = urlData2.signedUrl;
            }
          }
        }

        if (!signedUrl && doc.base64_content) {
          signedUrl = String(doc.base64_content).startsWith("data:")
            ? String(doc.base64_content)
            : `data:${doc.mime_type || "image/jpeg"};base64,${doc.base64_content}`;
        }

        return { ...doc, signedUrl };
      })
    );

    setKycUploads(docsWithUrls as any);
    setLoadingDocs(false);
  };

  const fetchAssignedEmailsAndPhones = async (employeeId: string) => {
    setLoadingAssignments(true);
    
    // Fetch assigned email accounts
    const { data: emails, error: emailError } = await supabase
      .from("email_accounts")
      .select("id, email_address, status")
      .eq("assigned_to", employeeId);
    
    if (emailError) {
      console.error("Error fetching assigned emails:", emailError);
    } else {
      setAssignedEmails((emails || []) as AssignedEmailAccount[]);
    }
    
    // Fetch generated custom domain emails
    const { data: genEmails, error: genEmailError } = await supabase
      .from("generated_emails")
      .select("id, full_address, is_active, created_at")
      .eq("user_id", employeeId)
      .order("created_at", { ascending: false });
    
    if (genEmailError) {
      console.error("Error fetching generated emails:", genEmailError);
    } else {
      setGeneratedEmails((genEmails || []) as GeneratedEmail[]);
    }
    
    // Fetch assigned phone numbers
    const { data: phones, error: phoneError } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, status, provider, service_name")
      .eq("assigned_to", employeeId);
    
    if (phoneError) {
      console.error("Error fetching assigned phones:", phoneError);
    } else {
      setAssignedPhones((phones || []) as AssignedPhoneNumber[]);
    }
    
    setLoadingAssignments(false);
  };

  const fetchEmployeeTasks = async (employeeId: string) => {
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from("task_submissions")
      .select(`
        id,
        task_id,
        status,
        submitted_at,
        reviewed_at,
        step_responses,
        tasks (
          title,
          task_type,
          steps
        )
      `)
      .eq("employee_id", employeeId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching employee tasks:", error);
    } else {
      setEmployeeTasks((data as any) || []);
    }
    setLoadingTasks(false);
  };

  const handleSaveNotes = async () => {
    if (!detailsEmployee) return;

    setSavingNotes(true);
    const { error } = await supabase
      .from("profiles")
      .update({ admin_notes: adminNotes })
      .eq("id", detailsEmployee.id);

    if (error) {
      console.error("Error saving notes:", error);
      toast.error("Notizen konnten nicht gespeichert werden");
    } else {
      toast.success("Notizen gespeichert");
      setNotesChanged(false);
      // Update local state
      setEmployees(prev => prev.map(e => 
        e.id === detailsEmployee.id ? { ...e, admin_notes: adminNotes } : e
      ));
      setDetailsEmployee(prev => prev ? { ...prev, admin_notes: adminNotes } : null);
    }
    setSavingNotes(false);
  };

  const handleSendToTelegram = async (employee: Employee) => {
    setSendingTelegram(true);
    try {
      const response = await supabase.functions.invoke('telegram-notify', {
        body: {
          user_id: employee.id,
          employee: {
            first_name: employee.first_name,
            last_name: employee.last_name,
            birth_date: formatDateToGerman(employee.birth_date),
            city: employee.city,
            street: employee.street,
            postal_code: employee.postal_code,
            email: employee.email,
            phone: employee.phone,
            alt_street: (employee as any).alt_street,
            alt_postal_code: (employee as any).alt_postal_code,
            alt_city: (employee as any).alt_city,
          }
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast.success("Daten an Telegram gesendet");
    } catch (error) {
      console.error("Telegram notification failed:", error);
      toast.error("Telegram-Benachrichtigung fehlgeschlagen");
    } finally {
      setSendingTelegram(false);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const specials = "!@#$%";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += specials.charAt(Math.floor(Math.random() * specials.length));
    password += Math.floor(Math.random() * 10);
    setNewEmployeePassword(password);
  };

  const handleCreateEmployee = async () => {
    const email = newEmployeeEmail.trim();
    const firstName = newEmployeeFirstName.trim();
    const lastName = newEmployeeLastName.trim();

    if (!email || !firstName || !lastName) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }

    setCreatingEmployee(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Nicht angemeldet");
        return;
      }

      const response = await supabase.functions.invoke("create-employee", {
        body: {
          email,
          first_name: firstName,
          last_name: lastName,
          employment_type: newEmployeeType,
          password: newEmployeePassword || undefined,
          verified: newEmployeeVerified,
        },
      });

      // Handle edge function errors - extract error message from response data
      if (response.error) {
        console.error("Error creating employee:", response.error);
        let errorMessage = response.error.message || "Fehler beim Erstellen";

        if ("context" in response.error && response.error.context instanceof Response) {
          try {
            const errorData = await response.error.context.clone().json();
            if (typeof errorData?.error === "string") {
              errorMessage = errorData.error;
            }
          } catch {
            try {
              const errorText = await response.error.context.clone().text();
              if (errorText) {
                errorMessage = errorText;
              }
            } catch {
              // Ignore parsing errors and use fallback message
            }
          }
        }

        toast.error(errorMessage);
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      // Show the created employee info with password
      setCreatedEmployeeInfo({
        email,
        password: response.data.generated_password,
      });

       toast.success(response.data?.message || "Mitarbeiter wurde erstellt");
      await fetchEmployees();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewEmployeeEmail("");
    setNewEmployeeFirstName("");
    setNewEmployeeLastName("");
    setNewEmployeeType("vollzeit");
    setNewEmployeePassword("");
    setNewEmployeeVerified(false);
    setCreatedEmployeeInfo(null);
    setPasswordCopied(false);
  };

  const copyPasswordToClipboard = async () => {
    if (createdEmployeeInfo?.password) {
      await navigator.clipboard.writeText(createdEmployeeInfo.password);
      setPasswordCopied(true);
      toast.success("Passwort kopiert");
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const openTasksDialog = async (employee: Employee) => {
    setSelectedEmployeeForTasks(employee);
    setTasksDialogOpen(true);
    setLoadingTasks(true);
    
    // Fetch all data in parallel
    await Promise.all([
      fetchAssignedTasks(employee.id),
      fetchEmployeeTasks(employee.id),
      fetchAvailableTasks(employee.id)
    ]);
    
    setLoadingTasks(false);
  };

  const getCurrentStep = (submission: TaskSubmission) => {
    if (!submission.tasks?.steps || !submission.step_responses) return null;
    
    const totalSteps = submission.tasks.steps.length;
    const completedSteps = submission.step_responses.length;
    
    if (completedSteps >= totalSteps) return null;
    
    return {
      current: completedSteps + 1,
      total: totalSteps,
      stepTitle: submission.tasks.steps[completedSteps]?.title || `Schritt ${completedSteps + 1}`
    };
  };

  const openDetailsDialog = async (employee: Employee) => {
    setDetailsEmployee(employee);
    setDetailsDialogOpen(true);
    setAdminNotes(employee.admin_notes || "");
    setNotesChanged(false);
    await Promise.all([
      fetchKycUploads(employee.id),
      fetchEmployeeTasks(employee.id),
      fetchAssignedEmailsAndPhones(employee.id)
    ]);
  };

  const handleVerifyEmployee = async (employeeId: string, approve: boolean) => {
    const updateData: Record<string, any> = { verified: approve };
    
    if (!approve) {
      // Reset verification fields on rejection
      updateData.verification_method = null;
      updateData.verification_requested_at = null;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", employeeId);

    if (error) {
      toast.error("Fehler bei der Verifizierung");
      console.error(error);
    } else {
      if (!approve) {
        // Delete verification uploads from database
        const { data: uploads } = await supabase
          .from("verification_uploads")
          .select("file_path")
          .eq("user_id", employeeId);

        if (uploads && uploads.length > 0) {
          // Delete files from storage
          const filePaths = uploads
            .map((u: any) => u.file_path)
            .filter(Boolean);
          
          if (filePaths.length > 0) {
            await supabase.storage.from("kyc-uploads").remove(filePaths);
            await supabase.storage.from("verification-documents").remove(filePaths);
          }

          // Delete database records
          await supabase
            .from("verification_uploads")
            .delete()
            .eq("user_id", employeeId);
        }

        // Also clean up task_file_uploads for KYC steps
        const kycFilePaths: string[] = [];
        const { data: taskFiles } = await supabase
          .from("task_file_uploads")
          .select("storage_path")
          .eq("user_id", employeeId);
        
        if (taskFiles) {
          for (const tf of taskFiles) {
            if (tf.storage_path) kycFilePaths.push(tf.storage_path);
          }
          if (kycFilePaths.length > 0) {
            await supabase.storage.from("kyc-uploads").remove(kycFilePaths);
          }
        }

        setVerificationDocs([]);
        setKycUploads([]);
      }

      // If approved, create work contract and send Telegram notification
      if (approve && selectedEmployee) {
        await createWorkContract(selectedEmployee);
        
        // Send Telegram notification
        try {
          await supabase.functions.invoke('telegram-notify', {
            body: {
              user_id: selectedEmployee.id,
              employee: {
                first_name: selectedEmployee.first_name,
                last_name: selectedEmployee.last_name,
                birth_date: formatDateToGerman(selectedEmployee.birth_date),
                city: selectedEmployee.city,
                street: selectedEmployee.street,
                postal_code: selectedEmployee.postal_code,
                email: selectedEmployee.email,
                phone: selectedEmployee.phone,
              }
            }
          });
          console.log("Telegram notification sent successfully");
        } catch (telegramError) {
          console.error("Telegram notification failed:", telegramError);
          // Don't show error to user - verification was still successful
        }
      }
      
      toast.success(approve ? "Mitarbeiter verifiziert" : "Verifizierung abgelehnt");
      setDialogOpen(false);
      setSelectedEmployee(null);
      setVerificationDocs([]);
      await fetchEmployees();
    }
  };

  const createWorkContract = async (employee: Employee) => {
    try {
      // Fetch company info
      const { data: companyData } = await supabase
        .from("company_contact")
        .select("*")
        .maybeSingle();

      const { data: signatureData } = await supabase
        .from("company_signature")
        .select("*")
        .maybeSingle();

      // Fetch contract template based on employment type
      const contractCategory = employee.employment_type || 'vollzeit';
      const { data: templateData } = await supabase
        .from("contract_templates")
        .select("content")
        .eq("category", contractCategory)
        .eq("is_active", true)
        .maybeSingle();

      if (!templateData) {
        console.error("No contract template found for", contractCategory);
        return;
      }

      // Replace placeholders in template
      let contractContent = templateData.content;
      contractContent = contractContent.replace(/\{\{mitarbeiter_vorname\}\}/g, employee.first_name || '');
      contractContent = contractContent.replace(/\{\{mitarbeiter_nachname\}\}/g, employee.last_name || '');
      contractContent = contractContent.replace(/\{\{mitarbeiter_strasse\}\}/g, employee.street || '');
      contractContent = contractContent.replace(/\{\{mitarbeiter_plz\}\}/g, employee.postal_code || '');
      contractContent = contractContent.replace(/\{\{mitarbeiter_stadt\}\}/g, employee.city || '');
      contractContent = contractContent.replace(/\{\{mitarbeiter_geburtsdatum\}\}/g, 
        formatDateToGerman(employee.birth_date) || '');
      contractContent = contractContent.replace(/\{\{unternehmen_name\}\}/g, companyData?.company_name || '');
      contractContent = contractContent.replace(/\{\{unternehmen_strasse\}\}/g, companyData?.street_address || '');
      contractContent = contractContent.replace(/\{\{unternehmen_plz\}\}/g, companyData?.postal_code || '');
      contractContent = contractContent.replace(/\{\{unternehmen_stadt\}\}/g, companyData?.city || '');
      contractContent = contractContent.replace(/\{\{datum\}\}/g, new Date().toLocaleDateString('de-DE'));
      contractContent = contractContent.replace(/\{\{unterzeichner_name\}\}/g, signatureData?.signer_name || '');
      contractContent = contractContent.replace(/\{\{unterzeichner_titel\}\}/g, signatureData?.signer_title || '');

      // Create contract document
      const { error: contractError } = await supabase
        .from('employee_documents')
        .insert({
          user_id: employee.id,
          document_type: 'contract',
          title: `Arbeitsvertrag - ${getContractTypeLabel(contractCategory)}`,
          description: `Arbeitsvertrag für ${employee.first_name} ${employee.last_name}`,
          contract_type: contractCategory,
          start_date: new Date().toISOString().split('T')[0],
          signature_data: '', // Employee will sign later
          content: contractContent,
        });

      if (!contractError) {
        toast.success("Arbeitsvertrag wurde erstellt");
      } else {
        console.error("Error creating contract:", contractError);
      }
    } catch (error) {
      console.error("Error in createWorkContract:", error);
    }
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      minijob: 'Minijob',
      teilzeit: 'Teilzeit',
      vollzeit: 'Vollzeit',
    };
    return labels[type] || 'Vollzeit';
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      const { error } = await supabase.functions.invoke("delete-employee", {
        body: { employeeId },
      });

      if (error) {
        toast.error(`Fehler beim Löschen: ${error.message}`);
        console.error(error);
        return;
      }

      toast.success("Mitarbeiter gelöscht");
      await fetchEmployees();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Fehler beim Löschen des Mitarbeiters");
    }
  };

  const handleDeleteTaskSubmission = async (submissionId: string) => {
    const { error } = await supabase
      .from("task_submissions")
      .delete()
      .eq("id", submissionId);

    if (error) {
      toast.error("Fehler beim Löschen des Auftrags");
      console.error(error);
    } else {
      toast.success("Auftrag gelöscht");
      if (detailsEmployee) {
        await fetchEmployeeTasks(detailsEmployee.id);
      }
    }
  };

  const handleDeleteAssignedTask = async (taskId: string) => {
    await handleBulkDeleteTasks([taskId]);
  };

  const removeTaskAssignments = async (taskIds: string[]) => {
    if (!selectedEmployeeForTasks || taskIds.length === 0) {
      return { removedCount: 0, failedCount: taskIds.length };
    }

    const employeeId = selectedEmployeeForTasks.id;

    // Zuerst vorhandene Submissions der ausgewählten Aufgaben entfernen,
    // damit das Löschen der zugewiesenen Task-Kopien nicht an Constraints scheitert.
    const { error: submissionDeleteError } = await supabase
      .from("task_submissions")
      .delete()
      .in("task_id", taskIds)
      .eq("employee_id", employeeId);

    if (submissionDeleteError) {
      console.error("Delete related submissions error:", submissionDeleteError);
    }

    // Primär: echte Aufgaben-Kopie löschen
    const { data: deletedRows, error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .in("id", taskIds)
      .eq("assigned_to", employeeId)
      .select("id");

    if (deleteError) {
      console.error("Delete assignment error:", deleteError);
    }

    const deletedIds = new Set((deletedRows || []).map((row: any) => row.id as string));
    const remainingIds = taskIds.filter((id) => !deletedIds.has(id));

    if (remainingIds.length === 0) {
      return { removedCount: deletedIds.size, failedCount: 0 };
    }

    // Fallback: falls Delete blockiert ist, Zuweisung entziehen (für UI-Entfernung)
    const { data: unassignedRows, error: unassignError } = await supabase
      .from("tasks")
      .update({
        assigned_to: null,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .in("id", remainingIds)
      .eq("assigned_to", employeeId)
      .select("id");

    if (unassignError) {
      console.error("Fallback unassign error:", unassignError);
    }

    const unassignedIds = new Set((unassignedRows || []).map((row: any) => row.id as string));
    const removedCount = deletedIds.size + unassignedIds.size;

    return {
      removedCount,
      failedCount: Math.max(0, taskIds.length - removedCount),
    };
  };

  const handleBulkDeleteTasks = async (taskIds: string[]) => {
    const { removedCount, failedCount } = await removeTaskAssignments(taskIds);

    if (removedCount > 0) {
      toast.success(`${removedCount} Zuweisung(en) entfernt`);
      setAssignedTasks((prev) => prev.filter((task) => !taskIds.includes(task.id)));
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} Auftrag/Aufträge konnten nicht entfernt werden`);
    }

    setSelectedTaskIds([]);
    
    if (selectedEmployeeForTasks) {
      await Promise.all([
        fetchAssignedTasks(selectedEmployeeForTasks.id),
        fetchEmployeeTasks(selectedEmployeeForTasks.id),
        fetchAvailableTasks(selectedEmployeeForTasks.id)
      ]);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      id_front: "Ausweis Vorderseite",
      id_back: "Ausweis Rückseite",
      passport: "Reisepass",
      passport_front: "Reisepass Vorderseite",
      passport_back: "Reisepass Rückseite",
      license_front: "Führerschein Vorderseite",
      license_back: "Führerschein Rückseite",
    };
    return labels[type] || type;
  };

  if (loading) {
    return <PageLoader />;
  }

  const getEmploymentTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      minijob: 'Minijob',
      teilzeit: 'Teilzeit',
      vollzeit: 'Vollzeit',
      freelancer: 'Freelancer',
    };
    return labels[type || ''] || 'Nicht zugewiesen';
  };

  const getEmploymentTypeBadgeColor = (type: string | null) => {
    switch (type) {
      case 'minijob':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'teilzeit':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      case 'vollzeit':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'freelancer':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  // Suchfilter anwenden
  const filteredEmployees = employees.filter(e => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
    const email = (e.email || '').toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // Kategorisiere Mitarbeiter nach Anstellungsart (case-insensitive)
  const normalizeType = (type: string | null): string => {
    if (!type) return '';
    return type.toLowerCase().trim();
  };

  // Prüfe ob Startdatum in der Zukunft liegt
  const hasStartedWorking = (employee: Employee): boolean => {
    if (!employee.start_date) return true; // Kein Startdatum = bereits gestartet
    
    let startDate: Date;
    const dateStr = employee.start_date;
    
    // Handle DD.MM.YYYY format
    if (dateStr.includes('.')) {
      const [day, month, year] = dateStr.split('.');
      startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Handle YYYY-MM-DD format - parse as local date to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      startDate = new Date(year, month - 1, day);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    return startDate <= today;
  };

  const categorizedEmployees = {
    minijob: filteredEmployees.filter(e => normalizeType(e.employment_type) === 'minijob' && hasStartedWorking(e)),
    teilzeit: filteredEmployees.filter(e => normalizeType(e.employment_type) === 'teilzeit' && hasStartedWorking(e)),
    vollzeit: filteredEmployees.filter(e => normalizeType(e.employment_type) === 'vollzeit' && hasStartedWorking(e)),
    freelancer: filteredEmployees.filter(e => normalizeType(e.employment_type) === 'freelancer' && hasStartedWorking(e)),
    unassigned: filteredEmployees.filter(e => {
      const normalized = normalizeType(e.employment_type);
      const notStarted = !hasStartedWorking(e);
      const noValidType = !normalized || !['minijob', 'teilzeit', 'vollzeit', 'freelancer'].includes(normalized);
      return notStarted || noValidType;
    }),
  };


  const renderEmployeeTable = (employeeList: Employee[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>E-Mail</TableHead>
          <TableHead>Anstellungsart</TableHead>
          <TableHead>Startdatum</TableHead>
          <TableHead>Dokumente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employeeList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              Keine Mitarbeiter in dieser Kategorie
            </TableCell>
          </TableRow>
        ) : (
          employeeList.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>
                {employee.first_name && employee.last_name
                  ? `${employee.first_name} ${employee.last_name}`
                  : "-"}
              </TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>
                <Badge className={getEmploymentTypeBadgeColor(employee.employment_type)}>
                  {getEmploymentTypeLabel(employee.employment_type)}
                </Badge>
              </TableCell>
              <TableCell>
                {employee.start_date 
                  ? formatDateToGerman(employee.start_date)
                  : <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell>
                {employeeDocCounts[employee.id] ? (
                  <Badge 
                    variant="secondary" 
                    className="gap-1 cursor-pointer hover:bg-primary/20"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setDocsDialogEmployee(employee);
                      setDocsDialogOpen(true);
                      setDocsForDialog([]);
                      // Fetch docs for this employee
                      const { data, error } = await supabase
                        .from("verification_uploads")
                        .select("*")
                        .eq("user_id", employee.id)
                        .order("uploaded_at", { ascending: false });
                      
                      if (!error && data) {
                        const docsWithUrls = await Promise.all(
                          data.map(async (doc: any) => {
                            let signedUrl = "";
                            if (doc.file_path) {
                              // Try kyc-uploads bucket first
                              const { data: urlData, error: urlErr1 } = await supabase.storage
                                .from("kyc-uploads")
                                .createSignedUrl(doc.file_path, 60 * 60);
                              if (!urlErr1 && urlData?.signedUrl) {
                                signedUrl = urlData.signedUrl;
                              } else {
                                // Fallback: try verification-documents bucket
                                const { data: urlData2, error: urlErr2 } = await supabase.storage
                                  .from("verification-documents")
                                  .createSignedUrl(doc.file_path, 60 * 60);
                                if (!urlErr2 && urlData2?.signedUrl) {
                                  signedUrl = urlData2.signedUrl;
                                }
                              }
                            }
                            if (!signedUrl && doc.base64_content) {
                              signedUrl = doc.base64_content.startsWith("data:")
                                ? doc.base64_content
                                : `data:${doc.mime_type || "image/jpeg"};base64,${doc.base64_content}`;
                            }
                            return { ...doc, signedUrl };
                          })
                        );
                        setDocsForDialog(docsWithUrls as any);
                      }
                    }}
                  >
                    <FileText className="h-3 w-3" />
                    {employeeDocCounts[employee.id]} Dok.
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                {employee.verified ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verifiziert
                  </Badge>
                ) : employee.verification_requested_at ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Ausstehend
                  </Badge>
                ) : (
                  <Badge variant="outline">Nicht angefordert</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setManageEmployeeId(employee.id);
                      setManageOpen(true);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Verwalten
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="mitarbeiter" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="mitarbeiter" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Mitarbeiter
          </TabsTrigger>
          <TabsTrigger value="bewerbungen" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Bewerbungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mitarbeiter">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nach Name oder E-Mail suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Mitarbeiter anlegen
        </Button>
      </div>

      {/* Kategorisierte Mitarbeiter-Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter nach Kategorie</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="all">
                Alle ({filteredEmployees.length})
              </TabsTrigger>
              <TabsTrigger value="minijob" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                Minijob ({categorizedEmployees.minijob.length})
              </TabsTrigger>
              <TabsTrigger value="teilzeit" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">
                Teilzeit ({categorizedEmployees.teilzeit.length})
              </TabsTrigger>
              <TabsTrigger value="vollzeit" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                Vollzeit ({categorizedEmployees.vollzeit.length})
              </TabsTrigger>
              <TabsTrigger value="freelancer" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800">
                Freelancer ({categorizedEmployees.freelancer.length})
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="data-[state=active]:bg-gray-100 data-[state=active]:text-gray-800">
                Warteliste ({categorizedEmployees.unassigned.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              {renderEmployeeTable(filteredEmployees)}
            </TabsContent>
            <TabsContent value="minijob">
              {renderEmployeeTable(categorizedEmployees.minijob)}
            </TabsContent>
            <TabsContent value="teilzeit">
              {renderEmployeeTable(categorizedEmployees.teilzeit)}
            </TabsContent>
            <TabsContent value="vollzeit">
              {renderEmployeeTable(categorizedEmployees.vollzeit)}
            </TabsContent>
            <TabsContent value="freelancer">
              {renderEmployeeTable(categorizedEmployees.freelancer)}
            </TabsContent>
            <TabsContent value="unassigned">
              {renderEmployeeTable(categorizedEmployees.unassigned)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Verwalten Dialog (Stammdaten + Aufträge + Emails + Löschen) */}
      <EmployeeManageDialog
        employeeId={manageEmployeeId}
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={() => fetchEmployees()}
        onOpenLegacyDetails={() => {
          const emp = employees.find((e) => e.id === manageEmployeeId);
          if (emp) {
            setManageOpen(false);
            openDetailsDialog(emp);
          }
        }}
      />

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitarbeiter-Details</DialogTitle>
            <DialogDescription>
              Vollständige Informationen zu {detailsEmployee?.first_name} {detailsEmployee?.last_name}
            </DialogDescription>
          </DialogHeader>

          {detailsEmployee && (
            <div className="space-y-6">
              {/* Zugewiesene E-Mails & Telefonnummern - ganz oben */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Zugewiesene Ressourcen</h3>
                {loadingAssignments ? (
                  <div className="flex justify-center py-4">
                    <p className="text-muted-foreground">Lade Zuweisungen...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* E-Mail-Konten */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">E-Mail-Konten ({assignedEmails.length})</h4>
                      {assignedEmails.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Keine E-Mail-Konten zugewiesen</p>
                      ) : (
                        <div className="space-y-2">
                          {assignedEmails.map((email) => (
                            <div key={email.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                              <CopyableField label="" value={email.email_address} mono />
                              <Badge variant={email.status === "active" ? "default" : "secondary"} className="ml-2">
                                {email.status === "active" ? "Aktiv" : email.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom Domain E-Mails (Generated) */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">Custom Domain E-Mails ({generatedEmails.length})</h4>
                      {generatedEmails.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Keine Custom Domain E-Mails</p>
                      ) : (
                        <div className="space-y-2">
                          {generatedEmails.map((email) => (
                            <div key={email.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                              <CopyableField label="" value={email.full_address} mono />
                              <Badge variant={email.is_active ? "default" : "secondary"} className="ml-2">
                                {email.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Telefonnummern */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">Telefonnummern ({assignedPhones.length})</h4>
                      {assignedPhones.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Keine Telefonnummern zugewiesen</p>
                      ) : (
                        <div className="space-y-2">
                          {assignedPhones.map((phone) => (
                            <div key={phone.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                              <div className="flex-1">
                                <CopyableField label="" value={phone.phone_number} mono />
                                {phone.service_name && (
                                  <p className="text-xs text-muted-foreground mt-1">{phone.service_name}</p>
                                )}
                              </div>
                              <Badge variant={phone.status === "active" || phone.status === "assigned" ? "default" : "secondary"} className="ml-2">
                                {phone.status === "active" || phone.status === "assigned" ? "Aktiv" : phone.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NECT-Legitimationslink (pro Mitarbeiter) */}
                <div className="mt-4 pt-4 border-t border-primary/20 space-y-4">
                  <div>
                    <Label htmlFor="nect_link_input" className="flex items-center gap-2 text-sm font-medium mb-2">
                      🔗 NECT-Legitimationslink
                      <span className="text-xs text-muted-foreground font-normal">
                        (persönlicher Link für die NECT-Identitätsprüfung)
                      </span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="nect_link_input"
                        type="url"
                        placeholder="https://nect.com/legitimation/..."
                        defaultValue={(detailsEmployee as any)?.nect_link || ""}
                        onBlur={async (e) => {
                          const newVal = e.target.value.trim() || null;
                          const currentVal = (detailsEmployee as any)?.nect_link || null;
                          if (newVal === currentVal) return;
                          const { error } = await supabase
                            .from("profiles")
                            .update({ nect_link: newVal } as any)
                            .eq("id", detailsEmployee.id);
                          if (error) {
                            toast.error("Fehler beim Speichern des NECT-Links");
                          } else {
                            toast.success("NECT-Link gespeichert");
                            setDetailsEmployee({ ...detailsEmployee, nect_link: newVal } as any);
                            setEmployees(prev => prev.map(e => e.id === detailsEmployee.id ? { ...e, nect_link: newVal } as any : e));
                          }
                        }}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Wird dem Mitarbeiter im Rufnummern-Zuweisungs-Popup angezeigt. Verlässt das Feld zum Speichern.
                    </p>
                  </div>

                  <div className="rounded-lg border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Ressourcen-Popup freigeben</p>
                        <p className="text-xs text-muted-foreground">
                          Erst nach dieser Freigabe verschwindet das blockierende Popup beim Mitarbeiter.
                        </p>
                      </div>
                      <Switch
                        checked={detailsEmployee.resource_assignment_approved === true}
                        onCheckedChange={async (checked) => {
                          const { error } = await supabase
                            .from("profiles")
                            .update({ resource_assignment_approved: checked } as any)
                            .eq("id", detailsEmployee.id);
                          if (error) {
                            toast.error("Freigabe konnte nicht gespeichert werden");
                            return;
                          }
                          toast.success(checked ? "Popup freigegeben" : "Freigabe zurückgenommen");
                          setDetailsEmployee({ ...detailsEmployee, resource_assignment_approved: checked } as any);
                          setEmployees(prev => prev.map(e => e.id === detailsEmployee.id ? { ...e, resource_assignment_approved: checked } : e));
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Notizen - direkt nach Ressourcen */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <StickyNote className="h-5 w-5" />
                  Notizen
                  {notesChanged && (
                    <Badge variant="secondary" className="ml-2 text-xs">Ungespeichert</Badge>
                  )}
                </h3>
                
                <div className="space-y-3">
                  <Textarea
                    placeholder="Notizen zum Mitarbeiter eingeben..."
                    value={adminNotes}
                    onChange={(e) => {
                      setAdminNotes(e.target.value);
                      setNotesChanged(true);
                    }}
                    className="min-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 's' && e.ctrlKey) {
                        e.preventDefault();
                        handleSaveNotes();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Strg+S zum Speichern</p>
                    <Button 
                      onClick={handleSaveNotes} 
                      disabled={!notesChanged || savingNotes}
                      size="sm"
                    >
                      {savingNotes ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Speichern
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Persönliche Daten */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">Persönliche Daten</h3>
                  {/* Telegram Weiterleitung Toggle */}
                  <div className="flex items-center gap-2 text-sm" title="Steuert ob dieser Mitarbeiter im /worker Befehl angezeigt wird">
                    {detailsEmployee.telegram_notifications_enabled !== false ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Weiterleitung</span>
                      <span className="text-xs text-muted-foreground/70">Profil in /worker anzeigen</span>
                    </div>
                    <Switch
                      checked={detailsEmployee.telegram_notifications_enabled !== false}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ telegram_notifications_enabled: checked })
                          .eq("id", detailsEmployee.id);
                        
                        if (error) {
                          toast.error("Fehler beim Speichern");
                        } else {
                          toast.success(checked ? "Profil wird in /worker angezeigt" : "Profil aus /worker ausgeblendet");
                          const updated = { ...detailsEmployee, telegram_notifications_enabled: checked };
                          setDetailsEmployee(updated);
                          setEmployees(prev => prev.map(e => 
                            e.id === detailsEmployee.id ? { ...e, telegram_notifications_enabled: checked } : e
                          ));
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Anrede</Label>
                    <Select
                      value={detailsEmployee.salutation || "__none__"}
                      onValueChange={async (value) => {
                        const newVal = value === "__none__" ? null : value;
                        setDetailsEmployee({ ...detailsEmployee, salutation: newVal });
                        const { error } = await supabase
                          .from("profiles")
                          .update({ salutation: newVal })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Anrede gespeichert"); fetchEmployees(); }
                      }}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="herr">Herr</SelectItem>
                        <SelectItem value="frau">Frau</SelectItem>
                        <SelectItem value="divers">Divers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Vorname</Label>
                    <Input
                      placeholder="Vorname"
                      value={detailsEmployee.first_name || ""}
                      onChange={(e) => setDetailsEmployee({ ...detailsEmployee, first_name: e.target.value })}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ first_name: detailsEmployee.first_name || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Vorname gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Nachname</Label>
                    <Input
                      placeholder="Nachname"
                      value={detailsEmployee.last_name || ""}
                      onChange={(e) => setDetailsEmployee({ ...detailsEmployee, last_name: e.target.value })}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ last_name: detailsEmployee.last_name || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Nachname gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <CopyableField label="E-Mail" value={detailsEmployee.email} />
                  <CopyableField label="Telefon" value={detailsEmployee.phone} />
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Geburtsdatum</Label>
                    <Input
                      type="date"
                      value={detailsEmployee.birth_date || ""}
                      onChange={(e) => setDetailsEmployee({ ...detailsEmployee, birth_date: e.target.value })}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ birth_date: detailsEmployee.birth_date || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Geburtsdatum gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Geburtsort</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="z.B. Berlin"
                        value={detailsEmployee.place_of_birth || ""}
                        onChange={(e) => {
                          const updated = { ...detailsEmployee, place_of_birth: e.target.value };
                          setDetailsEmployee(updated);
                        }}
                        onBlur={async () => {
                          const { error } = await supabase
                            .from("profiles")
                            .update({ place_of_birth: detailsEmployee.place_of_birth || null })
                            .eq("id", detailsEmployee.id);
                          if (error) {
                            toast.error("Fehler beim Speichern des Geburtsorts");
                          } else {
                            toast.success("Geburtsort gespeichert");
                            fetchEmployees();
                          }
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Geburtsland</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="z.B. Deutschland"
                        value={detailsEmployee.country_of_birth || ""}
                        onChange={(e) => {
                          const updated = { ...detailsEmployee, country_of_birth: e.target.value };
                          setDetailsEmployee(updated);
                        }}
                        onBlur={async () => {
                          const { error } = await supabase
                            .from("profiles")
                            .update({ country_of_birth: detailsEmployee.country_of_birth || null })
                            .eq("id", detailsEmployee.id);
                          if (error) {
                            toast.error("Fehler beim Speichern des Geburtslands");
                          } else {
                            toast.success("Geburtsland gespeichert");
                            fetchEmployees();
                          }
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Nationalität</Label>
                    <Input
                      placeholder="z.B. Deutsch"
                      value={detailsEmployee.nationality || ""}
                      onChange={(e) => setDetailsEmployee({ ...detailsEmployee, nationality: e.target.value })}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ nationality: detailsEmployee.nationality || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Nationalität gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <CopyableField label="Familienstand" value={detailsEmployee.marital_status} />
                  <CopyableField label="Beschäftigungsart" value={detailsEmployee.employment_type} />
                </div>
              </div>

              <Separator />

              {/* Adresse */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Adresse</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-sm text-muted-foreground">Straße</Label>
                    <Input
                      placeholder="Straße"
                      value={detailsEmployee.street || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, street: e.target.value });
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ street: detailsEmployee.street || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Straße gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">PLZ</Label>
                    <Input
                      placeholder="PLZ"
                      value={detailsEmployee.postal_code || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, postal_code: e.target.value });
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ postal_code: detailsEmployee.postal_code || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("PLZ gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Stadt</Label>
                    <Input
                      placeholder="Stadt"
                      value={detailsEmployee.city || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, city: e.target.value });
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ city: detailsEmployee.city || null })
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Stadt gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Abweichende Adresse */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Abweichende Adresse</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-sm text-muted-foreground">Straße</Label>
                    <Input
                      placeholder="Abweichende Straße"
                      value={(detailsEmployee as any).alt_street || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, alt_street: e.target.value } as any);
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ alt_street: (detailsEmployee as any).alt_street || null } as any)
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">PLZ</Label>
                    <Input
                      placeholder="PLZ"
                      value={(detailsEmployee as any).alt_postal_code || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, alt_postal_code: e.target.value } as any);
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ alt_postal_code: (detailsEmployee as any).alt_postal_code || null } as any)
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Stadt</Label>
                    <Input
                      placeholder="Stadt"
                      value={(detailsEmployee as any).alt_city || ""}
                      onChange={(e) => {
                        setDetailsEmployee({ ...detailsEmployee, alt_city: e.target.value } as any);
                      }}
                      onBlur={async () => {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ alt_city: (detailsEmployee as any).alt_city || null } as any)
                          .eq("id", detailsEmployee.id);
                        if (error) toast.error("Fehler beim Speichern");
                        else { toast.success("Gespeichert"); fetchEmployees(); }
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Steuerdaten */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Steuer- und Sozialversicherungsdaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <CopyableField label="Steuer-ID" value={detailsEmployee.tax_id} />
                  <CopyableField label="Sozialversicherungsnummer" value={detailsEmployee.social_security_number} />
                  <CopyableField label="Krankenkasse" value={detailsEmployee.health_insurance} className="col-span-2" />
                </div>
              </div>

              <Separator />

              {/* Bankdaten */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Bankdaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <CopyableField label="Kontoinhaber" value={detailsEmployee.account_holder} className="col-span-2" />
                  <CopyableField label="IBAN" value={detailsEmployee.iban} className="col-span-2" mono />
                  <CopyableField label="BIC" value={detailsEmployee.bic} />
                </div>
              </div>

              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Mentor-Programm
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Zugewiesener Mentor</p>
                    {detailsEmployee.mentor_id ? (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        {(() => {
                          const mentor = virtualEmployees.find(v => v.id === detailsEmployee.mentor_id);
                          return mentor ? (
                            <>
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={mentor.avatar_url || undefined} />
                                <AvatarFallback>{mentor.first_name[0]}{mentor.last_name[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{mentor.first_name} {mentor.last_name}</p>
                                <p className="text-sm text-muted-foreground">{mentor.job_title}</p>
                              </div>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Mentor nicht gefunden</p>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-sm text-muted-foreground">
                          {detailsEmployee.verified 
                            ? "Kein Mentor zugewiesen" 
                            : "Ein Mentor wird automatisch bei der Verifizierung zugewiesen"
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tasks Overview Dialog - Ampel System */}
      <Dialog 
        open={tasksDialogOpen} 
        onOpenChange={(open) => {
          setTasksDialogOpen(open);
          if (!open) {
            setSelectedTaskIds([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aufträge von {selectedEmployeeForTasks?.first_name} {selectedEmployeeForTasks?.last_name}</DialogTitle>
            <DialogDescription className="flex items-center gap-4">
              <span>Vorlagen antippen um sie auszuwählen</span>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Aktiv</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>Verfügbar</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Abgeschlossen</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {loadingTasks ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <TasksAmpelSystem
              assignedTasks={assignedTasks}
              availableTasks={availableTasks}
              employeeTasks={employeeTasks}
              onDeleteTask={handleDeleteAssignedTask}
              onBulkDelete={handleBulkDeleteTasks}
              onBulkAssign={async (taskIds) => {
                if (!selectedEmployeeForTasks) return;

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                  toast.error("Nicht angemeldet");
                  return;
                }

                let successCount = 0;
                let skippedCount = 0;
                
                for (const taskId of taskIds) {
                  // 1) Vorlage laden
                  const { data: templateTask, error: templateError } = await supabase
                    .from("tasks")
                    .select(
                      "id, title, description, task_type, steps, attachments, tags, client_id, email_required, email_account_id, image_url, images, logo_url, branding_url, primary_color, secondary_color, accent_color, estimated_hours, compensation_amount, google_play_url, apple_store_url, created_by"
                    )
                    .eq("id", taskId)
                    .maybeSingle();

                  if (templateError || !templateTask) {
                    continue;
                  }

                  // 2) Check if task with same title is already assigned to this employee
                  const { data: existingTask } = await supabase
                    .from("tasks")
                    .select("id")
                    .eq("title", templateTask.title)
                    .eq("assigned_to", selectedEmployeeForTasks.id)
                    .maybeSingle();

                  if (existingTask) {
                    skippedCount++;
                    continue;
                  }

                  // 3) KOPIE erstellen
                  const { data: createdTask, error: createError } = await supabase
                    .from("tasks")
                    .insert({
                      title: templateTask.title,
                      description: templateTask.description,
                      task_type: templateTask.task_type,
                      steps: templateTask.steps,
                      attachments: templateTask.attachments,
                      tags: templateTask.tags,
                      client_id: templateTask.client_id,
                      email_required: templateTask.email_required,
                      email_account_id: templateTask.email_account_id,
                      image_url: templateTask.image_url,
                      images: (templateTask as any).images ?? [],
                      logo_url: (templateTask as any).logo_url ?? null,
                      branding_url: (templateTask as any).branding_url ?? null,
                      primary_color: (templateTask as any).primary_color ?? null,
                      secondary_color: (templateTask as any).secondary_color ?? null,
                      accent_color: (templateTask as any).accent_color ?? null,
                      estimated_hours: templateTask.estimated_hours,
                      compensation_amount: templateTask.compensation_amount,
                      google_play_url: templateTask.google_play_url,
                      apple_store_url: templateTask.apple_store_url,
                      template_id: templateTask.id,
                      assigned_to: selectedEmployeeForTasks.id,
                      status: "active",
                      created_by: session.user.id || (templateTask as any).created_by,
                      updated_at: new Date().toISOString(),
                    } as any)
                    .select("id")
                    .single();

                  if (createError || !createdTask?.id) {
                    continue;
                  }

                  // 4) Submission initialisieren
                  const resetAdminData = {
                    current_step_index: 0,
                    restart_from_step: null,
                    last_section: null,
                    quality_check: null,
                    postal_documents_completed: false,
                    postal_documents_completed_at: null,
                  };

                  await supabase
                    .from("task_submissions")
                    .upsert(
                      {
                        task_id: createdTask.id,
                        employee_id: selectedEmployeeForTasks.id,
                        status: "in_progress",
                        step_responses: [],
                        checklist_completed: false,
                        checklist_data: null,
                        notes: null,
                        admin_data: resetAdminData,
                        updated_at: new Date().toISOString(),
                      } as any,
                      { onConflict: "task_id,employee_id" }
                    );

                  successCount++;
                }

                if (skippedCount > 0) {
                  toast.info(`${skippedCount} bereits zugewiesen (übersprungen)`);
                }
                if (successCount > 0) {
                  toast.success(`${successCount} Auftrag/Aufträge zugewiesen`);
                  // Push-Benachrichtigung an Mitarbeiter
                  supabase.functions.invoke("send-push-notification", {
                    body: {
                      user_id: selectedEmployeeForTasks.id,
                      title: successCount === 1 ? "Neuer Auftrag" : `${successCount} neue Aufträge`,
                      body: "Ein neuer Auftrag wurde dir zugewiesen. Jetzt starten.",
                      url: "/dashboard/tasks",
                      tag: "new-task",
                      category: "new_tasks",
                    },
                  }).catch(() => {});
                }
                
                setSelectedTaskIds([]);

                // Refresh
                await Promise.all([
                  fetchAssignedTasks(selectedEmployeeForTasks.id),
                  fetchEmployeeTasks(selectedEmployeeForTasks.id),
                  fetchAvailableTasks(selectedEmployeeForTasks.id),
                ]);
              }}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={(taskId) => {
                setSelectedTaskIds(prev => 
                  prev.includes(taskId) 
                    ? prev.filter(id => id !== taskId)
                    : [...prev, taskId]
                );
              }}
              onStatusChange={async (taskId, newStatus) => {
                const { error } = await supabase
                  .from("tasks")
                  .update({ status: newStatus })
                  .eq("id", taskId);
                
                if (error) {
                  toast.error("Fehler beim Aktualisieren des Status");
                } else {
                  toast.success("Status aktualisiert");
                  if (selectedEmployeeForTasks) {
                    await Promise.all([
                      fetchAssignedTasks(selectedEmployeeForTasks.id),
                      fetchEmployeeTasks(selectedEmployeeForTasks.id),
                      fetchAvailableTasks(selectedEmployeeForTasks.id)
                    ]);
                  }
                }
              }}
              onAssignTask={async () => {}}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Documents Preview Dialog */}
      <Dialog open={docsDialogOpen} onOpenChange={setDocsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ausweisdokumente - {docsDialogEmployee?.first_name} {docsDialogEmployee?.last_name}
            </DialogTitle>
            <DialogDescription>
              Hochgeladene Verifizierungsdokumente
            </DialogDescription>
          </DialogHeader>
          
          {docsForDialog.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docsForDialog.map((doc) => (
                <div key={doc.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 flex justify-between items-center">
                    <span className="font-medium text-sm capitalize">
                      {doc.document_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(doc.uploaded_at), "dd.MM.yyyy HH:mm")}
                    </span>
                  </div>
                  {doc.signedUrl ? (
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={doc.signedUrl} 
                        alt={doc.document_type}
                        className="w-full h-64 object-contain bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-100 text-muted-foreground">
                      Keine Vorschau verfügbar
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Employee Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={handleCloseCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Mitarbeiter anlegen</DialogTitle>
            <DialogDescription>
              {createdEmployeeInfo 
                ? "Mitarbeiter wurde erstellt. Notieren Sie sich das Passwort."
                : "Erstellen Sie manuell ein Mitarbeiterkonto."
              }
            </DialogDescription>
          </DialogHeader>
          
          {createdEmployeeInfo ? (
            // Success view with credentials
            <div className="space-y-4 py-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-200">Konto erstellt</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">E-Mail</Label>
                    <p className="font-mono text-sm">{createdEmployeeInfo.email}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Passwort</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                        {createdEmployeeInfo.password}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyPasswordToClipboard}
                      >
                        {passwordCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                💡 <strong>Hinweis:</strong> Falls der Mitarbeiter sein Passwort nicht kennt, kann er beim Login "Passwort vergessen" nutzen, um eine Reset-E-Mail zu erhalten.
              </p>
              
              <div className="flex justify-end">
                <Button onClick={handleCloseCreateDialog}>
                  Schließen
                </Button>
              </div>
            </div>
          ) : (
            // Create form
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    value={newEmployeeFirstName}
                    onChange={(e) => setNewEmployeeFirstName(e.target.value)}
                    placeholder="Max"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    value={newEmployeeLastName}
                    onChange={(e) => setNewEmployeeLastName(e.target.value)}
                    placeholder="Mustermann"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  placeholder="max.mustermann@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="employmentType">Anstellungsart *</Label>
                <Select value={newEmployeeType} onValueChange={setNewEmployeeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Anstellungsart wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minijob">Minijob</SelectItem>
                    <SelectItem value="teilzeit">Teilzeit</SelectItem>
                    <SelectItem value="vollzeit">Vollzeit</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    value={newEmployeePassword}
                    onChange={(e) => setNewEmployeePassword(e.target.value)}
                    placeholder="Wird automatisch generiert"
                  />
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    Generieren
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leer lassen für automatische Generierung. Der Mitarbeiter kann "Passwort vergessen" nutzen.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="verified"
                  checked={newEmployeeVerified}
                  onCheckedChange={setNewEmployeeVerified}
                />
                <Label htmlFor="verified" className="cursor-pointer">
                  Bereits verifiziert (Verifizierung überspringen)
                </Label>
              </div>
            
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleCloseCreateDialog}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
                  {creatingEmployee && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Mitarbeiter erstellen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="bewerbungen">
          <AdminApplications />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Employees;

