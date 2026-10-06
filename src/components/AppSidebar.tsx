import { Home, Users, CheckSquare, Video, LogOut, Settings, FileText, AlertTriangle, MessageCircle, Euro, ChevronDown, ChevronRight, Building2, Send, QrCode, Trophy, Shield, BookOpen, Smartphone, Database, UserPlus } from "lucide-react";
import { useStandaloneApp } from "@/hooks/useStandaloneApp";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast-stub";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useI18n, LanguageSwitch } from "@/lib/i18n";

// Employee menu items (for non-admin users) - ohne Meine Aufträge
// Note: Freelancer get different payroll item, handled dynamically
const getEmployeeItems = (isFreelancer: boolean) => [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Mein Postfach", url: "/dashboard/documents", icon: FileText },
  { title: "Bibliothek", url: "/dashboard/library", icon: BookOpen },
  isFreelancer 
    ? { title: "Honorarabrechnungen", url: "/dashboard/invoices", icon: Euro }
    : { title: "Lohnabrechnungen", url: "/dashboard/payroll", icon: Euro },
  { title: "Einstellungen", url: "/dashboard/employee-settings", icon: Settings },
];

// Admin menu items
const adminOverviewItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Postfach", url: "/dashboard/admin/chat-inbox", icon: MessageCircle },
  { title: "Mitarbeiter", url: "/dashboard/admin/employees", icon: Users },
  { title: "Konto anlegen", url: "/dashboard/admin/create-user", icon: UserPlus },
];

const requestItems = [
  { title: "Task-Flow", url: "/dashboard/admin/requests", icon: CheckSquare },
];

const managementItems = [
  { title: "Taskvorlagen + erstellen", url: "/dashboard/admin/task-management", icon: CheckSquare },
  { title: "Taskmails", url: "/dashboard/admin/completions", icon: Trophy },
  { title: "Coupon-Verwaltung", url: "/dashboard/admin/coupons", icon: QrCode },
  { title: "Lohnabrechnungen", url: "/dashboard/admin/payroll", icon: Euro },
  { title: "Auszahlungs-Freigaben", url: "/dashboard/admin/payouts", icon: QrCode },
  
  { title: "Security Monitor", url: "/dashboard/admin/security", icon: Shield },

];

const settingsItems = [
  { title: "Einstellungen", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { t } = useI18n();
  const isStandalone = useStandaloneApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const isAdminRoute = location.pathname.startsWith("/dashboard/admin") || location.pathname === "/dashboard/settings";
  const showAdminSidebar = statusLoaded ? isAdmin : isAdminRoute;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || "");

          // Check roles
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          const isAdminUser = roles?.some((r) => r.role === "admin") || false;
          setIsAdmin(isAdminUser);

          // Check verification status and employment type
          const { data: profile } = await supabase
            .from("profiles")
            .select("verified, verification_requested_at, employment_type")
            .eq("id", user.id)
            .maybeSingle();

          if (profile) {
            setIsVerified(profile.verified || false);
            setVerificationRequested(!!profile.verification_requested_at);
            setIsFreelancer(profile.employment_type?.toLowerCase() === "freelancer");
          }

          // Load counts function
          const loadCounts = async () => {
            if (isAdminUser) {
              // Load unread message count (only user messages)
              const { data: unreadMessages } = await supabase
                .from("chat_messages")
                .select("id", { count: "exact" })
                .eq("is_read", false)
                .eq("role", "user");
              setUnreadMessageCount(unreadMessages?.length || 0);

              // Load pending applications count
              const { data: pendingApplications } = await supabase
                .from("applications")
                .select("id", { count: "exact" })
                .eq("status", "pending");
              setPendingApplicationsCount(pendingApplications?.length || 0);

              // Load pending task submissions count
              const { data: pendingTasks } = await supabase
                .from("task_submissions")
                .select("id", { count: "exact" })
                .eq("status", "pending");
              setPendingTasksCount(pendingTasks?.length || 0);

              // Load pending KYC requests count
              const { data: pendingKyc } = await supabase
                .from("profiles")
                .select("id", { count: "exact" })
                .eq("verified", false)
                .not("verification_requested_at", "is", null);
              setPendingKycCount(pendingKyc?.length || 0);
            }

          };

          await loadCounts();

          // Set up realtime subscriptions for admins
          if (isAdminUser) {
            // Subscribe to chat messages changes
            const chatChannel = supabase
              .channel('chat-changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_messages' },
                () => loadCounts()
              )
              .subscribe();

            // Subscribe to applications changes
            const appsChannel = supabase
              .channel('apps-changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'applications' },
                () => loadCounts()
              )
              .subscribe();

            // Subscribe to task submissions changes
            const tasksChannel = supabase
              .channel('tasks-changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_submissions' },
                () => loadCounts()
              )
              .subscribe();

            // Subscribe to profiles changes
            const profilesChannel = supabase
              .channel('profiles-changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                () => loadCounts()
              )
              .subscribe();

            return () => {
              supabase.removeChannel(chatChannel);
              supabase.removeChannel(appsChannel);
              supabase.removeChannel(tasksChannel);
              supabase.removeChannel(profilesChannel);
            };
          }

        }
      } catch (err) {
        console.error("Sidebar init failed:", err);
      } finally {
        setStatusLoaded(true);
      }
    };
    fetchUser();
  }, []);

  // Separate useEffect for loading tasks - ensures it runs after isAdmin state is set
  useEffect(() => {
    const loadTasks = async () => {
      // Only load tasks for non-admin users
      if (isAdmin) {
        setTasks([]);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Query all tasks assigned to this user
        const { data: userTasks, error: tasksError } = await supabase
          .from("tasks")
          .select("id, title, status")
          .eq("assigned_to", user.id)
          .order("created_at", { ascending: false });

        if (tasksError) {
          console.error("Error loading tasks:", tasksError);
          return;
        }

        // Get submissions to filter out approved tasks
        const { data: submissions } = await supabase
          .from("task_submissions")
          .select("task_id, status")
          .eq("employee_id", user.id);

        const approvedTaskIds = submissions
          ?.filter(s => s.status === "approved")
          .map(s => s.task_id) || [];

        const activeTasks = userTasks?.filter(t => !approvedTaskIds.includes(t.id)) || [];
        setTasks(activeTasks);
      } catch (err) {
        console.error("Error loading user tasks:", err);
      }
    };

    if (statusLoaded && !showAdminSidebar) {
      loadTasks();

      const setupSubscriptions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tasksChannel = supabase
          .channel('sidebar-tasks-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${user.id}` },
            () => loadTasks()
          )
          .subscribe();

        const submissionsChannel = supabase
          .channel('sidebar-submissions-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_submissions', filter: `employee_id=eq.${user.id}` },
            () => loadTasks()
          )
          .subscribe();

        return () => {
          supabase.removeChannel(tasksChannel);
          supabase.removeChannel(submissionsChannel);
        };
      };

      setupSubscriptions();
    }
  }, [statusLoaded, showAdminSidebar, isAdmin]);

  const handleLogout = async () => {
    try {
      // Invalidate refresh tokens server-side and clear local session
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error("Logout error:", error);
      }
    } catch (err) {
      console.error("Unexpected logout error:", err);
    }

    // Defensive: clear any leftover auth keys in localStorage
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.toLowerCase().includes('supabase') || k.toLowerCase().includes('auth')) {
          localStorage.removeItem(k);
        }
      });
    } catch {}

    toast.success("Erfolgreich abgemeldet");
    // Force full reload to ensure fresh state
    window.location.replace("/login");
  };

  // Reset badge counts when navigating to specific pages
  useEffect(() => {
    const resetCountsForRoute = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Reset chat count when viewing chat inbox
      if (location.pathname === "/dashboard/admin/chat-inbox" && isAdmin) {
        await supabase
          .from("chat_messages")
          .update({ is_read: true })
          .eq("is_read", false);
        setUnreadMessageCount(0);
      }

      // Reset documents count when viewing documents and mark as read in DB
      if (location.pathname === "/dashboard/documents" && user) {
        await supabase
          .from("employee_documents")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
      }

      // Reset applications count when viewing applications
      if (location.pathname === "/dashboard/admin/applications" && isAdmin) {
        setPendingApplicationsCount(0);
      }

      // Reset task submissions count when viewing task review
      if (location.pathname === "/dashboard/admin/task-review" && isAdmin) {
        setPendingTasksCount(0);
      }

      // Reset KYC count when viewing video chat
      if (location.pathname === "/dashboard/admin/video-chat" && isAdmin) {
        setPendingKycCount(0);
      }
    };

    resetCountsForRoute();
  }, [location.pathname, isAdmin]);

  const getNavCls = (path: string) => {
    return location.pathname === path
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50";
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const handleRequestVerification = () => {
    navigate("/verification");
  };

  const displayItems = showAdminSidebar ? adminOverviewItems : getEmployeeItems(isFreelancer);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider">
            {open && t("NAVIGATION")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {displayItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {open && (
                        <div className="flex items-center justify-between flex-1">
                          <span>{t(item.title)}</span>
                          {item.title === "Postfach" && unreadMessageCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {unreadMessageCount}
                            </span>
                          )}
                          {item.title === "Mitarbeiter" && pendingApplicationsCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {pendingApplicationsCount}
                            </span>
                          )}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Meine Aufträge - nur für Mitarbeiter */}
              {!showAdminSidebar && open && (
                <Collapsible open={tasksExpanded} onOpenChange={setTasksExpanded}>
                  <SidebarMenuItem>
                    <div className="flex items-center w-full">
                      <SidebarMenuButton 
                        onClick={() => navigate("/dashboard/tasks")}
                        className={getNavCls("/dashboard/tasks") + " flex-1"}
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>{t("Meine Aufträge")}</span>
                      </SidebarMenuButton>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {tasksExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {tasks.length === 0 ? (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton>
                              <span className="text-muted-foreground text-sm">
                                {t("Keine offenen Aufträge")}
                              </span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ) : (
                          tasks.map((task) => (
                            <SidebarMenuSubItem key={task.id}>
                              <SidebarMenuSubButton asChild>
                                <NavLink to={`/dashboard/tasks/${task.id}`}>
                                  <span className="truncate">{task.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin-only sections */}
        {showAdminSidebar && (
          <>
            {/* Anfragen */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider">
                {t("Anfragen")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {requestItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {open && (
                            <div className="flex items-center justify-between flex-1">
                              <span>{t(item.title)}</span>
                              {item.title === "Aufgaben-Prüfung" && pendingTasksCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                  {pendingTasksCount}
                                </span>
                              )}
                              {item.title === "KYC Anfragen" && pendingKycCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                  {pendingKycCount}
                                </span>
                              )}
                            </div>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Verwaltung */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider">
                {t("Verwaltung")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {managementItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {open && <span>{t(item.title)}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer mit Verifizierung und Benutzer */}
      <SidebarFooter>
        <SidebarGroup>
          {showAdminSidebar && (
            <>
              <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider">
                {t("Einstellungen")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {open && <span>{t(item.title)}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          )}
          
          <SidebarGroupContent>
              {open && (
              <div className="flex items-center gap-3 px-3 py-3 rounded-md bg-sidebar-accent/50 mt-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(userEmail)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">
                    {userEmail}
                  </span>
                  <span className="text-xs text-sidebar-foreground/60">
                    {isAdmin ? t("Administrator") : t("Mitarbeiter")}
                  </span>
                </div>
                <NotificationBell />
              </div>
            )}
            {open && (
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-xs text-sidebar-foreground/60">{t("Sprache")}</span>
                <LanguageSwitch />
              </div>
            )}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {open && <span>{t("Abmelden")}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
