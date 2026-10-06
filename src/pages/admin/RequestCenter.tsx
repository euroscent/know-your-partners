import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckSquare, List, Trophy } from "lucide-react";

// Import the existing components as tabs
import DemoDataTab from "./request-center/DemoDataTab";
import ReviewTab from "./request-center/ReviewTab";
import AllTasksTab from "./request-center/AllTasksTab";
import CompletionsTab from "./request-center/CompletionsTab";

const RequestCenter = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingDemoCount, setPendingDemoCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [allTasksCount, setAllTasksCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    checkAdminAndFetchCounts();

    // Real-time subscription for counts
    const channel = supabase
      .channel('request-center-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_submissions' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdminAndFetchCounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const isAdmin = roles?.some((r) => r.role === "admin") || false;
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    await fetchCounts();
    setLoading(false);
  };

  const fetchCounts = async () => {
    // Get admin IDs to exclude
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminIds = adminRoles?.map(r => r.user_id) || [];

    // Count pending demo data (status = 'pending')
    const { count: demoCount } = await supabase
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .not("employee_id", "in", `(${adminIds.join(",")})`);
    
    setPendingDemoCount(demoCount || 0);

    // Count awaiting review (status = 'awaiting_review', 'in_review' or 'kyc_completed')
    const { count: reviewCount } = await supabase
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .in("status", ["awaiting_review", "in_review", "kyc_completed"])
      .not("employee_id", "in", `(${adminIds.join(",")})`);
    
    setPendingReviewCount(reviewCount || 0);

    // Count all active tasks (not approved)
    const { count: allCount } = await supabase
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .neq("status", "approved")
      .not("employee_id", "in", `(${adminIds.join(",")})`);
    
    setAllTasksCount(allCount || 0);

    // Count completed tasks (approved)
    const { count: completedCountResult } = await supabase
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .not("employee_id", "in", `(${adminIds.join(",")})`);
    
    setCompletedCount(completedCountResult || 0);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Lädt Anfragen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Task-Force</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Demo-Daten, Prüfungen und laufende Aufträge
        </p>
      </div>

      <Tabs defaultValue="demo-data" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="demo-data" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Demo-Daten</span>
            {pendingDemoCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingDemoCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Prüfung</span>
            {pendingReviewCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingReviewCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-tasks" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Alle Aufträge</span>
            <Badge variant="outline" className="ml-1">
              {allTasksCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completions" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Abschlüsse</span>
            <Badge variant="outline" className="ml-1">
              {completedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demo-data">
          <DemoDataTab onUpdate={fetchCounts} />
        </TabsContent>

        <TabsContent value="review">
          <ReviewTab onUpdate={fetchCounts} />
        </TabsContent>

        <TabsContent value="all-tasks">
          <AllTasksTab onUpdate={fetchCounts} />
        </TabsContent>

        <TabsContent value="completions">
          <CompletionsTab onUpdate={fetchCounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestCenter;
