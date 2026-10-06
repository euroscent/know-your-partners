import { useEffect, useState, useRef } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/toast-stub";
import { Upload, CheckCircle2, FileText, AlertCircle, Clock, Briefcase, FileCheck, Calendar, ArrowRight, Star, UserCircle, MessageCircle, Timer, Building2, Euro } from "lucide-react";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageLoader } from "@/components/PageLoader";
import { motion } from "framer-motion";
import { differenceInDays, differenceInHours, differenceInMinutes, isFuture, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AdminActivityMonitor } from "@/components/admin/AdminActivityMonitor";
import { EmployeeChat, EmployeeChatRef } from "@/components/EmployeeChat";
import { getAvatarById } from "@/assets/avatars";
import { TaskImageRotator } from "@/components/TaskImageRotator";
import { getTaskGlowStyles, getBannerUrls, hasDemoDataInAdminData } from "@/lib/taskUtils";
import { OnboardingModal } from "@/components/OnboardingModal";
import { ResourceAssignmentModal } from "@/components/ResourceAssignmentModal";
import { QuestionnaireDialog } from "@/components/onboarding/QuestionnaireDialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { InstallAppBanner } from "@/components/InstallAppBanner";


interface UploadedDoc {
  type: string;
  file: File | null;
  uploaded: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  task_type: string;
  is_starter_job: boolean;
  estimated_hours: number;
  compensation_amount?: number | null;
  due_date: string;
  created_at?: string;
  updated_at?: string;
  client_id?: string;
  image_url?: string | null;
  logo_url?: string | null;
  images?: Json | null;
  /**
   * Signed or public URL that is safe to display as banner.
   * (Computed client-side; not stored in DB)
   */
  banner_url?: string | null;
  /** All banner candidates (signed/public), in display order */
  banner_urls?: string[];
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  client?: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
  // Submission status for glow styling
  submissionStatus?: string;
  hasDemoData?: boolean;
  isInReview?: boolean;
  isRejected?: boolean;
}

interface DashboardStats {
  completedTasks: number;
  activeTasks: number;
  documents: number;
  totalHours: number;
}

interface Mentor {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  email: string;
  avatar_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<Record<string, UploadedDoc>>({
    id_front: { type: "Personalausweis Vorderseite", file: null, uploaded: false },
    id_back: { type: "Personalausweis Rückseite", file: null, uploaded: false },
    passport: { type: "Reisepass", file: null, uploaded: false },
    license_front: { type: "Führerschein Vorderseite", file: null, uploaded: false },
    license_back: { type: "Führerschein Rückseite", file: null, uploaded: false },
  });
  const [selectedDocType, setSelectedDocType] = useState<"id" | "passport" | "license">("id");
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    completedTasks: 0,
    activeTasks: 0,
    documents: 0,
    totalHours: 0,
  });
  const [userName, setUserName] = useState<string>("");
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState<string | null>(null);
  const [profileLastName, setProfileLastName] = useState<string | null>(null);
  const [showResourceAssignment, setShowResourceAssignment] = useState(false);
  const [needsQuestionnaire, setNeedsQuestionnaire] = useState(false);
  const chatRef = useRef<EmployeeChatRef>(null);

  useEffect(() => {
    const handleOpenChat = () => {
      chatRef.current?.openHRChat();
    };
    window.addEventListener("open-employee-chat", handleOpenChat);
    return () => window.removeEventListener("open-employee-chat", handleOpenChat);
  }, []);

  const openMentorChat = () => {
    if (mentor && chatRef.current) {
      chatRef.current.openWithContact({
        id: mentor.id,
        first_name: mentor.first_name,
        last_name: mentor.last_name,
        job_title: mentor.job_title,
        department: mentor.department,
      });
    }
  };
  
  // Upload constraints
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/octet-stream'
  ] as const;

  useEffect(() => {
    checkAuth();

    // Listen for auth state changes (like logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/register");
      } else if (event === 'SIGNED_IN' && session) {
        checkAuth();
      }
    });

    // Subscribe to task updates for real-time sync
    const channel = supabase
      .channel('dashboard-task-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          // Refetch tasks when any task is updated
          checkAuth();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    setUser(session.user);

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    
    const adminStatus = roles?.some((r) => r.role === "admin") || false;
    setIsAdmin(adminStatus);

    // Check verification status and set display name
    if (!adminStatus) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("verified, first_name, last_name, mentor_id, start_date, employment_type, resource_assignment_approved, street, birth_date, signature_data, questionnaire_completed")
          .eq("id", session.user.id)
          .maybeSingle();

      if (profileError) {
        console.warn("Profile load warning:", profileError);
      }

      const fallbackName = session.user.email?.split('@')[0] || '';
      const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
      setUserName(fullName || fallbackName || 'Mitarbeiter');
      setProfileFirstName(profile?.first_name || null);
      setProfileLastName(profile?.last_name || null);

      // Check onboarding flag from user_metadata (set by create-employee edge function)
      // Check if user was manually created (has metadata flag)
      const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
      const isManuallyCreated = meta.must_complete_onboarding === true;
      
      let mustOnboard = false;

      if (isManuallyCreated) {
        // Only manually created users get the 4-step OnboardingModal (password, personal, address, contract)
        mustOnboard = meta.must_change_password === true || !(profile?.street && profile?.signature_data);
      }

      setNeedsOnboarding(mustOnboard);

      // Questionnaire logic:
      // 1. If manually created: show after onboarding (contract) is done
      // 2. If self-registered: show immediately if not completed
      const questionnaireNeeded = profile?.questionnaire_completed === false && !mustOnboard;
      setNeedsQuestionnaire(questionnaireNeeded);

      // Handled above in questionnaireNeeded logic

      // Set start date if available
      if (profile?.start_date) {
        setStartDate(profile.start_date);
      } else {
        // Fallback: some registration flows only store start_date on the contract document
        const { data: contractDoc } = await supabase
          .from("employee_documents")
          .select("start_date")
          .eq("user_id", session.user.id)
          .eq("document_type", "contract")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contractDoc?.start_date) {
          setStartDate(contractDoc.start_date);
        }
      }

      // Load mentor if assigned
      if (profile?.mentor_id) {
        const { data: mentorData } = await supabase
          .from("virtual_employees")
          .select("id, first_name, last_name, job_title, department, email, avatar_url")
          .eq("id", profile.mentor_id)
          .single();
        
        if (mentorData) {
          setMentor(mentorData);
        }
      }

      if (profile?.verified) {
        setIsVerified(true);
        // Popup zeigen, solange der Admin die Ressourcenzuweisung nicht freigegeben hat.
        // (localStorage-Flag wird ignoriert, damit der Schalter im Admin-Dashboard
        // jederzeit das Popup wieder einblenden kann.)
        if (!mustOnboard && !profile?.resource_assignment_approved) {
          setShowResourceAssignment(true);
        }
      }
      
      if (profile?.employment_type) {
        setEmploymentType(profile.employment_type);
      }
      
      // Load dashboard data regardless of verification status
      await loadDashboardData(session.user.id);

      // Load existing uploads
      const { data: uploads } = await supabase
        .from("verification_uploads")
        .select("document_type")
        .eq("user_id", session.user.id);

      if (uploads) {
        setDocuments(prev => {
          const updated = { ...prev };
          uploads.forEach(upload => {
            if (updated[upload.document_type]) {
              updated[upload.document_type].uploaded = true;
            }
          });
          return updated;
        });
      }
    }

    setLoading(false);
  };

  const loadDashboardData = async (userId: string) => {
    try {
      // Load task submissions for stats
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("status, step_responses, task_id, admin_data, reviewed_at")
        .eq("employee_id", userId);

      const completedCount = submissions?.filter(s => s.status === "approved").length || 0;
      const activeCount = submissions?.filter(s => s.status === "pending").length || 0;

      // Check for newly provided demo data (only show if status is not fully "approved" yet, or recently approved)
      // Only notify about demo data if there are active tasks with demo data
      const tasksWithDemoData = submissions?.filter(s => 
        s.status === "awaiting_review" && 
        s.admin_data && 
        Object.keys(s.admin_data).length > 0
      );
      
      if (tasksWithDemoData && tasksWithDemoData.length > 0) {
        toast({
          title: "Demo-Daten verfügbar!",
          description: "Ihre Demo-Daten wurden bereitgestellt und können jetzt verwendet werden.",
        });
      }

      // Calculate total hours from completed tasks (only current month)
      let totalHours = 0;
      if (submissions) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const currentMonthSubmissions = submissions.filter(s => 
          s.status === "approved" && 
          s.reviewed_at && 
          new Date(s.reviewed_at) >= firstDayOfMonth
        );
        
        for (const submission of currentMonthSubmissions) {
          const { data: task } = await supabase
            .from("tasks")
            .select("estimated_hours")
            .eq("id", submission.task_id)
            .single();
          if (task?.estimated_hours) {
            totalHours += Number(task.estimated_hours);
          }
        }
      }

      // Load documents count
      const { data: docs } = await supabase
        .from("employee_documents")
        .select("id")
        .eq("user_id", userId);

      setStats({
        completedTasks: completedCount,
        activeTasks: activeCount,
        documents: docs?.length || 0,
        totalHours,
      });

      // Load user's assigned tasks with client info
      const { data: userTasks } = await supabase
        .from("tasks")
        .select(`
          *,
          client:clients(id, name, logo_url, primary_color, secondary_color)
        `)
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false });

      // Filter out approved tasks and enrich with submission status
      const approvedTaskIds = submissions
        ?.filter(s => s.status === "approved")
        .map(s => s.task_id) || [];

      // Create a map of task_id -> submission for quick lookup
      const submissionMap = new Map<string, { status: string; admin_data: any }>();
      submissions?.forEach(s => {
        submissionMap.set(s.task_id, { status: s.status || "", admin_data: s.admin_data });
      });

      const activeTasksBase = userTasks
        ?.filter((t) => !approvedTaskIds.includes(t.id))
        .map((t) => {
          const sub = submissionMap.get(t.id);
          const adminData = (sub?.admin_data || {}) as Record<string, unknown>;
          const hasDemoData = hasDemoDataInAdminData(adminData, sub?.status);
          const isInReview = sub?.status === "awaiting_review" || sub?.status === "in_review";
          // Detect rejected tasks only if NOT already resubmitted for review
          // Once resubmitted (awaiting_review), the rejection is resolved
          const isRejected = !isInReview && !!(adminData.restart_from_step || adminData.rejection_reason || adminData.rejection_timestamp);
          const demoProvidedAt = !!(adminData.demo_data_provided_at || adminData.demo_data_requested_at);
          return {
            ...t,
            submissionStatus: sub?.status || "in_progress",
            hasDemoData,
            demoProvidedAt,
            isInReview,
            isRejected,
          } as Task;
        }) || [];

      // Strong cache-busting for banners: prevents employees from seeing stale
      // images if the browser cached old URLs too aggressively.
      const cacheBuster = Date.now().toString();

      const activeTasks = await Promise.all(
        activeTasksBase.map(async (t) => {
          const banner_urls = await getBannerUrls(t, cacheBuster);
          const banner_url = banner_urls[0] ?? null;
          return { ...t, banner_url, banner_urls };
        })
      );

      // Tasks with provided demo data (green glow) always appear first
      activeTasks.sort((a, b) => (b.hasDemoData ? 1 : 0) - (a.hasDemoData ? 1 : 0));

      setAvailableTasks(activeTasks);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const handleFileChange = (docType: string, file: File | null) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Datei zu groß", description: "Maximal 50 MB erlaubt.", variant: "destructive" });
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type as any)) {
        toast({ title: "Ungültiges Dateiformat", description: "Erlaubt: JPG, PNG, GIF, WEBP, HEIC, PDF.", variant: "destructive" });
        return;
      }
    }
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], file }
    }));
  };

  const uploadDocument = async (docType: string, file: File) => {
    if (!user) return false;

    try {
      console.log("Converting file to base64:", { docType, fileName: file.name });

      // Convert file to base64
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log("File converted, saving to database");

      // Save directly to database with base64 content
      const { error: dbError } = await supabase
        .from("verification_uploads")
        .insert({
          user_id: user.id,
          document_type: docType,
          base64_content: base64Content,
          file_size: file.size,
          mime_type: file.type,
          file_path: null, // Not using storage anymore
        });

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(dbError.message);
      }

      console.log("Upload record saved to database");
      return true;
    } catch (error: any) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    const requiredDocs: string[] = [];
    
    if (selectedDocType === "id") {
      requiredDocs.push("id_front", "id_back");
    } else if (selectedDocType === "passport") {
      requiredDocs.push("passport");
    } else if (selectedDocType === "license") {
      requiredDocs.push("license_front", "license_back");
    }

    const missingDocs = requiredDocs.filter(doc => !documents[doc].file && !documents[doc].uploaded);
    
    if (missingDocs.length > 0) {
      toast({
        title: "Fehler",
        description: "Bitte laden Sie alle erforderlichen Dokumente hoch",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      for (const docType of requiredDocs) {
        if (documents[docType].file && !documents[docType].uploaded) {
          const success = await uploadDocument(docType, documents[docType].file!);
          if (!success) {
            throw new Error(`Failed to upload ${docType}`);
          }
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ verification_requested_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Dokumente hochgeladen",
        description: "Ihre Dokumente werden nun überprüft.",
      });

      // Reload to update state
      checkAuth();

    } catch (error: any) {
      toast({
        title: "Fehler",
        description: `Dokumente konnten nicht hochgeladen werden${error?.message ? `: ${error.message}` : ''}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 euroscent-app-bg">
            <PageLoader />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  const isDashboardRoot = location.pathname === "/dashboard";
  const showAdmin = isDashboardRoot && isAdmin;
  const showEmployeeDashboard = isDashboardRoot && !isAdmin;

  return (
    <SidebarProvider defaultOpen={true}>
      {needsOnboarding && user && !isAdmin && (
        <OnboardingModal
          open={needsOnboarding}
          userId={user.id}
          email={user.email || ""}
          employmentType={employmentType}
          initialFirstName={profileFirstName}
          initialLastName={profileLastName}
          onComplete={() => {
            setNeedsOnboarding(false);
            checkAuth();
          }}
        />
      )}
      {needsQuestionnaire && user && !isAdmin && !needsOnboarding && (
        <QuestionnaireDialog
          open={needsQuestionnaire}
          userId={user.id}
          onComplete={() => {
            setNeedsQuestionnaire(false);
            checkAuth();
          }}
        />
      )}
      {showResourceAssignment && user && !isAdmin && !needsOnboarding && !needsQuestionnaire && isDashboardRoot && (
        <ResourceAssignmentModal
          open={showResourceAssignment}
          userId={user.id}
          onComplete={() => setShowResourceAssignment(false)}
        />
      )}
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 pb-16 md:pb-0 euroscent-app-bg">
          <header className="h-14 border-b flex items-center px-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
          </header>
          
          {showAdmin ? (
            <div className="p-8">
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Willkommen zurück!</h1>
                <p className="text-muted-foreground">
                  Verwalten Sie Ihr Team und behalten Sie den Überblick über alle Aktivitäten.
                </p>
              </div>
              <AdminActivityMonitor />
            </div>
          ) : showEmployeeDashboard ? (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">Mitarbeiter Dashboard</h1>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Willkommen zurück, {userName}. Hier ist ein Überblick über Ihre Aktivitäten.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span className="text-xs sm:text-sm">{format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}</span>
                  </div>
                  <Button onClick={() => loadDashboardData(user.id)} variant="outline" size="sm" className="w-full sm:w-auto">
                    <Clock className="h-4 w-4 mr-2" />
                    Aktualisieren
                  </Button>
                </div>
              </div>

              {/* Start Date Countdown */}
              {startDate && isFuture(parseISO(startDate)) && (
                <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                          <Timer className="h-6 w-6 md:h-7 md:w-7 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                            Ihr Arbeitsbeginn
                          </p>
                          <p className="text-xl md:text-2xl font-bold text-amber-800 dark:text-amber-200">
                            {format(parseISO(startDate), "d. MMMM yyyy", { locale: de })}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {(() => {
                              const start = parseISO(startDate);
                              const days = differenceInDays(start, new Date());
                              const hours = differenceInHours(start, new Date()) % 24;
                              
                              if (days > 0) {
                                return (
                                  <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Noch <span className="font-semibold">{days} {days === 1 ? 'Tag' : 'Tage'}</span>
                                    {hours > 0 && <span> und {hours} {hours === 1 ? 'Stunde' : 'Stunden'}</span>}
                                  </p>
                                );
                              } else if (hours > 0) {
                                const minutes = differenceInMinutes(start, new Date()) % 60;
                                return (
                                  <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Noch <span className="font-semibold">{hours} {hours === 1 ? 'Stunde' : 'Stunden'}</span>
                                    {minutes > 0 && <span> und {minutes} Minuten</span>}
                                  </p>
                                );
                              } else {
                                return (
                                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                    Heute ist es soweit! 🎉
                                  </p>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      {/* Mentor Info */}
                      {mentor && (
                        <div className="flex items-center gap-3 md:border-l md:border-amber-500/30 md:pl-4">
                          <Avatar className="h-10 w-10 border-2 border-amber-500/30">
                            <AvatarImage src={getAvatarById(mentor.id) || mentor.avatar_url || undefined} />
                            <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                              {mentor.first_name?.[0]}{mentor.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-amber-600 dark:text-amber-400">Ihr Mentor</p>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                              {mentor.first_name} {mentor.last_name}
                            </p>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                              {mentor.job_title}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs md:text-sm text-muted-foreground">Abgeschlossene Aufträge</p>
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl md:text-3xl font-bold">{stats.completedTasks}</p>
                        <p className="text-xs text-muted-foreground mt-1">Gesamt</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs md:text-sm text-muted-foreground">Aktive Aufträge</p>
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                          <Briefcase className="h-4 w-4 md:h-5 md:w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl md:text-3xl font-bold">{stats.activeTasks}</p>
                        <p className="text-xs text-muted-foreground mt-1">In Bearbeitung</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs md:text-sm text-muted-foreground">Dokumente</p>
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                          <FileCheck className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl md:text-3xl font-bold">{stats.documents}</p>
                        <p className="text-xs text-muted-foreground mt-1">Verträge & Dokumente</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mentor Card */}
              {mentor && (() => {
                // Mentor-Container wird 7 Tage nach Start komplett ausgeblendet
                const baseDateStr = startDate;
                const baseDate = baseDateStr ? new Date(baseDateStr) : null;
                let daysLeft: number | null = null;
                if (baseDate && !isNaN(baseDate.getTime())) {
                  const expires = new Date(baseDate);
                  expires.setDate(expires.getDate() + 7);
                  const ms = expires.getTime() - Date.now();
                  if (ms <= 0) return null; // komplett verschwinden nach Ablauf
                  daysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
                }

                return (
                  <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Ihr Mentor</CardTitle>
                      </div>
                      <CardDescription>
                        Bei Fragen steht Ihnen Ihr persönlicher Mentor zur Seite
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20">
                          <AvatarImage src={mentor.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {mentor.first_name[0]}{mentor.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {mentor.first_name} {mentor.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{mentor.job_title}</p>
                          <p className="text-xs text-muted-foreground">{mentor.department}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="shrink-0"
                          onClick={openMentorChat}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Nachricht
                        </Button>
                      </div>

                      {daysLeft !== null && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                          <Timer className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>
                            Im Rahmen unseres Mentorenprogramms wird jedem neuen Teammitglied für die erste Woche ein zufällig ausgewählter, erfahrener Kollege zur Seite gestellt.
                            {daysLeft && daysLeft > 0 ? (
                              <> Ihr Mentor steht Ihnen noch <strong>{daysLeft} Tag{daysLeft === 1 ? "" : "e"}</strong> zur Verfügung.</>
                            ) : (
                              <> Die Mentoren-Betreuung läuft heute aus.</>
                            )}
                            {" "}Nach sechs Wochen im Team haben Sie zudem die Möglichkeit, sich selbst für das Mentorenprogramm zu qualifizieren und als Mentor tätig zu werden.
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Available Tasks */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-semibold">Meine Aufgaben</h2>
                </div>
                
                {!isVerified ? (
                  <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-600" />
                      <h3 className="font-semibold text-lg mb-2 text-amber-800 dark:text-amber-200">
                        Verifizierung erforderlich
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Um Aufgaben zu erhalten, müssen Sie sich zunächst verifizieren.
                      </p>
                      <Button onClick={() => navigate("/dashboard/verification")} className="bg-amber-600 hover:bg-amber-700">
                        Jetzt verifizieren
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                ) : availableTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Sie haben derzeit keine aktiven Aufgaben. Neue Aufgaben werden Ihnen automatisch zugewiesen.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {availableTasks.map((task, index) => {
                      // Use shared utility for glow styles
                      const glowStyles = getTaskGlowStyles({
                        isRejected: task.isRejected,
                        isInReview: task.isInReview,
                        hasDemoData: task.hasDemoData,
                      });
                      
                      return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        whileHover={task.isInReview ? {} : { scale: 1.02, y: -4 }}
                        className="h-full"
                      >
                        <Card 
                          className={`h-full overflow-hidden group transition-all duration-500 ${glowStyles} ${
                            task.isInReview 
                              ? 'cursor-not-allowed opacity-75' 
                              : 'cursor-pointer'
                          }`}
                          onClick={() => {
                            if (showResourceAssignment) {
                              toast({
                                title: "Bitte abschließen",
                                description: "Bitte schließen Sie zuerst die Ressourcenzuweisung ab, bevor Sie Aufträge öffnen.",
                              });
                              return;
                            }
                            if (task.isInReview) {
                              toast({
                                title: "Aufgabe wird geprüft",
                                description: "Diese Aufgabe wurde zur Prüfung eingereicht und kann nicht mehr bearbeitet werden.",
                              });
                              return;
                            }
                            navigate(`/dashboard/tasks/${task.id}`);
                          }}
                        >
                          {/* Task Image/Banner */}
                          {(() => {
                            const imagesArray = Array.isArray(task.images)
                              ? task.images.filter((img): img is string => typeof img === "string")
                              : [];

                            const urls =
                              task.banner_urls ??
                              [
                                task.banner_url,
                                task.image_url,
                                ...(imagesArray.length > 0 ? [imagesArray[0]] : []),
                                task.logo_url,
                                task.client?.logo_url,
                              ]
                                .filter((u): u is string => typeof u === "string" && u.length > 0)
                                .filter((u) => !u.includes("placeholder"));

                            const hasImage = urls.length > 0;

                            // Use task-level colors first, then client colors
                            const bgColor = task.primary_color || task.client?.primary_color;
                            const bgColorSecondary = task.secondary_color || task.client?.secondary_color;

                            return (
                              <div
                                className="relative h-32 overflow-hidden"
                                style={{
                                  background: bgColor
                                    ? `linear-gradient(135deg, ${bgColor}, ${bgColorSecondary || bgColor}88)`
                                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                                }}
                              >
                                <TaskImageRotator
                                  urls={urls}
                                  alt={task.title}
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />

                                {/* No fallback icon - just gradient background when no image */}

                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />




                                {/* Starter job badge */}
                                {task.is_starter_job && !task.isInReview && (
                                  <div className="absolute top-2 right-2">
                                    <Badge className="bg-yellow-400 text-yellow-900 shadow-lg">
                                      <Star className="h-3 w-3 mr-1" />
                                      Starter-Job
                                    </Badge>
                                  </div>
                                )}

                                {/* In Review badge */}
                                {task.isInReview && (
                                  <div className="absolute top-2 right-2">
                                    <Badge className="bg-blue-500 text-white shadow-lg">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Wird geprüft
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                              {task.title}
                            </CardTitle>
                            {task.description && (
                              <CardDescription className="line-clamp-2 text-sm">
                                {task.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          
                          <CardContent className="space-y-3">
                            {/* Vergütung (nur Freelancer) + Frist */}
                            {(employmentType === "freelancer" && task.compensation_amount != null && Number(task.compensation_amount) > 0) || (task.due_date && (task as any).demoProvidedAt) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {employmentType === "freelancer" && task.compensation_amount != null && Number(task.compensation_amount) > 0 && (
                                  <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    <Euro className="h-3.5 w-3.5" />
                                    <span>
                                      {Number(task.compensation_amount).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                    </span>
                                  </div>
                                )}
                                {task.due_date && (task as any).demoProvidedAt && <DeadlineBadge dueDate={task.due_date} />}
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {task.priority && (
                                  <Badge variant={
                                    task.priority === "high" ? "destructive" :
                                    task.priority === "medium" ? "default" : "secondary"
                                  } className="text-xs">
                                    {task.priority === "high" ? "Hoch" :
                                     task.priority === "medium" ? "Mittel" : "Niedrig"}
                                  </Badge>
                                )}
                                {task.estimated_hours && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{task.estimated_hours}h</span>
                                  </div>
                                )}
                              </div>
                              <motion.div
                                className="flex items-center gap-1 text-primary text-sm font-medium"
                                whileHover={{ x: 4 }}
                              >
                                Details
                                <ArrowRight className="h-4 w-4" />
                              </motion.div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )})}
                  </div>
                )}
              </div>
            </div>
          ) : isDashboardRoot ? (
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Willkommen im Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Wählen Sie einen Menüpunkt aus der Sidebar, um zu beginnen.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}
          
          <Outlet />
        </main>
        <EmployeeChat ref={chatRef} />
        {!isAdmin && <MobileBottomNav />}
        {!isAdmin && <InstallAppBanner />}
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;