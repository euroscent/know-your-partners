import { useEffect, useRef, useState, memo, useCallback } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MoreVertical, Edit, Copy, Trash2, UserPlus, Clock, ListOrdered, X, ArrowLeft, FileUp, GripVertical, ExternalLink, Image, Upload, Globe, Loader2, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toast-stub";
import { DemoConsoleLivePreview } from "@/components/admin/DemoConsoleLivePreview";
import { SortableStepEditor, TaskStep } from "@/components/admin/SortableStepEditor";
import { format } from "date-fns";
import { fetchExportWithFiles, buildExportZip } from "@/lib/exportWithFiles";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";



interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  tags: string[];
  task_type: string | null;
  compensation_amount: number | null;
  google_play_url: string | null;
  apple_store_url: string | null;
  is_starter_job: boolean;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  estimated_hours: number | null;
  steps: TaskStep[];
  created_at: string;
  updated_at: string;
  client_id: string | null;
  image_url: string | null;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bankdrop: "Bankdrop",
  exchanger: "Exchanger",
  sonstiges: "Sonstiges",
  billo: "Billo Aufträge",
};

const CATEGORY_COLORS: Record<string, string> = {
  bankdrop: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  exchanger: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  sonstiges: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  billo: "bg-secondary text-secondary-foreground",
};


interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

const TaskManagement = () => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [currentTab, setCurrentTab] = useState("grundinfo");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [templateTab, setTemplateTab] = useState<"auftraege" | "billo">("auftraege");
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    compensation_amount: "",
    estimated_hours: "",
    google_play_url: "",
    apple_store_url: "",
    is_starter_job: false,
    tags: "",
    due_date: "",
    deadline_days: "3",
    client_id: "",
    image_url: "",
    branding_url: "",
    primary_color: "",
    secondary_color: "",
    accent_color: "",
    logo_url: "",
    category: "sonstiges",
    default_info_text: "",
  });
  const [taskImages, setTaskImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractingBranding, setExtractingBranding] = useState(false);
  const [brandingPreview, setBrandingPreview] = useState<{
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    logo?: string;
  } | null>(null);

  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [newStep, setNewStep] = useState({
    title: "",
    description: "",
    type: "text" as TaskStep["type"],
    required: true,
  });


  // Steps bearbeiten + Drag & Drop
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 16,
      },
    })
  );


  const toggleExpanded = (id: string) => {
    setExpandedSteps((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleStepChange = useCallback((stepId: string, field: keyof TaskStep, value: any) => {
    setTaskSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)));
  }, []);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = taskSteps.findIndex((s) => s.id === active.id);
      const newIndex = taskSteps.findIndex((s) => s.id === over.id);
      setTaskSteps(arrayMove(taskSteps, oldIndex, newIndex));
    }
  };

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const adminStatus = roles?.some((r) => r.role === "admin") || false;
    if (!adminStatus) {
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    await Promise.all([fetchTasks(), fetchEmployees(), fetchClients()]);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, logo_url, primary_color, secondary_color, accent_color")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
      return;
    }
    setClients(data || []);
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Fehler beim Laden der Aufträge");
      return;
    }

    setTasks((data as any) || []);
  };

  const fetchEmployees = async () => {
    // First get all employee role users (exclude admins)
    const { data: employeeRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "employee");

    if (rolesError) {
      console.error("Error fetching employee roles:", rolesError);
      return;
    }

    const employeeIds = employeeRoles?.map(r => r.user_id) || [];

    // Then load only employee profiles
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", employeeIds)
      .order("email");

    if (error) {
      console.error("Error fetching employees:", error);
      return;
    }

    setEmployees(profiles || []);
  };

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        compensation_amount: task.compensation_amount?.toString() || "",
        estimated_hours: task.estimated_hours?.toString() || "",
        google_play_url: task.google_play_url || "",
        apple_store_url: task.apple_store_url || "",
        is_starter_job: task.is_starter_job || false,
        tags: task.tags.join(", "),
        due_date: task.due_date ? task.due_date.split("T")[0] : "",
        deadline_days: ((task as any).deadline_days ?? 3).toString(),
        client_id: task.client_id || "",
        image_url: task.image_url || "",
        branding_url: (task as any).branding_url || "",
        primary_color: (task as any).primary_color || "",
        secondary_color: (task as any).secondary_color || "",
        accent_color: (task as any).accent_color || "",
        logo_url: (task as any).logo_url || "",
        category: task.category || "sonstiges",
        default_info_text: (task as any).default_info_text || "",
      });
      // Load multiple images
      const images = (task as any).images;
      setTaskImages(Array.isArray(images) ? images : []);
      // Show branding preview if task has colors
      if ((task as any).primary_color) {
        setBrandingPreview({
          primary_color: (task as any).primary_color,
          secondary_color: (task as any).secondary_color || "",
          accent_color: (task as any).accent_color || "",
          logo: (task as any).logo_url || undefined,
        });
      }
      setTaskSteps(task.steps || []);
    } else {
      setEditingTask(null);
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        compensation_amount: "",
        estimated_hours: "",
        google_play_url: "",
        apple_store_url: "",
        is_starter_job: false,
        tags: "",
        due_date: "",
        deadline_days: "3",
        client_id: "",
        image_url: "",
        branding_url: "",
        primary_color: "",
        secondary_color: "",
        accent_color: "",
        logo_url: "",
        category: templateTab === "billo" ? "billo" : "sonstiges",
        ...(templateTab === "billo" ? { estimated_hours: "1" } : {}),
        default_info_text: "",
      });
      setTaskImages([]);
      setBrandingPreview(null);
      setTaskSteps([]);
    }
    setCurrentTab("grundinfo");
    setDialogOpen(true);
  };

  const handleAddStep = () => {
    if (!newStep.title.trim()) {
      toast.error("Bitte geben Sie einen Titel für den Schritt ein");
      return;
    }

    const step: TaskStep = {
      id: crypto.randomUUID(),
      ...newStep,
      ...(newStep.type === "product_test" ? { product_test: {
        title: newStep.title,
        description: newStep.description,
        duration: 24,
        duration_unit: "hours" as const,
        require_confirmation: false,
        confirmation_text: "",
        tasks: [],
        questions: [],
      } } : {}),
    };

    setTaskSteps([...taskSteps, step]);
    setNewStep({
      title: "",
      description: "",
      type: "text",
      required: true,
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setTaskSteps(taskSteps.filter(s => s.id !== stepId));
  };


  const handleSaveTask = async () => {
    if (!formData.title.trim()) {
      toast.error("Bitte geben Sie einen Titel ein");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const taskData = {
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      compensation_amount: formData.compensation_amount ? parseFloat(formData.compensation_amount) : null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      google_play_url: formData.google_play_url || null,
      apple_store_url: formData.apple_store_url || null,
      is_starter_job: formData.is_starter_job,
      tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(t => t) : [],
      due_date: formData.due_date || null,
      deadline_days: formData.deadline_days ? Math.max(1, parseInt(formData.deadline_days, 10) || 3) : 3,
      steps: taskSteps,
      client_id: formData.client_id || null,
      image_url: formData.image_url || null,
      images: taskImages.length > 0 ? taskImages : [],
      branding_url: formData.branding_url || null,
      primary_color: brandingPreview?.primary_color || formData.primary_color || null,
      secondary_color: brandingPreview?.secondary_color || formData.secondary_color || null,
      accent_color: brandingPreview?.accent_color || formData.accent_color || null,
      logo_url: brandingPreview?.logo || formData.logo_url || null,
      category: formData.category,
      default_info_text: formData.default_info_text || null,
    };

    if (editingTask) {
      const { error } = await supabase
        .from("tasks")
        .update(taskData as any)
        .eq("id", editingTask.id);

      if (error) {
        console.error("Error updating task:", error);
        toast.error("Fehler beim Aktualisieren des Auftrags");
        return;
      }
      toast.success("Auftrag aktualisiert");
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert({
          ...taskData,
          created_by: session.user.id,
        } as any);

      if (error) {
        console.error("Error creating task:", error);
        toast.error("Fehler beim Erstellen des Auftrags");
        return;
      }
      toast.success("Auftrag erstellt");
    }

    setDialogOpen(false);
    fetchTasks();
  };

  const handleDuplicateTask = async (task: Task) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Find a unique title to avoid collision with the unique template index
    const baseTitle = task.title.replace(/\s*\(Kopie(?:\s+\d+)?\)\s*$/, "");
    let candidateTitle = `${baseTitle} (Kopie)`;
    let counter = 2;
    // Check existing template titles (assigned_to IS NULL)
    while (true) {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("title", candidateTitle)
        .is("assigned_to", null)
        .maybeSingle();
      if (!existing) break;
      candidateTitle = `${baseTitle} (Kopie ${counter})`;
      counter++;
    }

    const { error } = await supabase
      .from("tasks")
      .insert({
        title: candidateTitle,
        description: task.description,
        task_type: task.task_type,
        priority: task.priority,
        compensation_amount: task.compensation_amount,
        google_play_url: task.google_play_url,
        apple_store_url: task.apple_store_url,
        is_starter_job: false,
        tags: task.tags,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        steps: task.steps || [],
        created_by: session.user.id,
      } as any);

    if (error) {
      console.error("Error duplicating task:", error);
      toast.error("Fehler beim Duplizieren des Auftrags");
      return;
    }

    toast.success("Auftrag dupliziert");
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Möchten Sie diesen Auftrag wirklich löschen?")) {
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Error deleting task:", error);
      toast.error("Fehler beim Löschen des Auftrags");
      return;
    }

    toast.success("Auftrag gelöscht");
    fetchTasks();
  };

  const handleOpenAssignDialog = (task: Task) => {
    console.log("Opening assign dialog for task:", task);
    setAssigningTask(task);
    setAssignDialogOpen(true);
  };

  const handleAssignTask = async (employeeId: string | null) => {
    if (!assigningTask) {
      console.error("No task selected for assignment");
      toast.error("Kein Auftrag ausgewählt");
      return;
    }

    if (!employeeId) {
      toast.error("Bitte wählen Sie einen Mitarbeiter aus");
      return;
    }

    console.log("Creating copy of template", assigningTask.id, "for employee", employeeId);

    // Get current user for created_by
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Keine Session gefunden");
      return;
    }

    // First, fetch the complete template with all branding fields
    const { data: fullTemplate, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", assigningTask.id)
      .single();

    if (fetchError || !fullTemplate) {
      console.error("Error fetching full template:", fetchError);
      toast.error("Fehler beim Laden der Vorlage");
      return;
    }

    // CREATE A COPY of the template instead of modifying the original
    // This keeps the template intact for future assignments
    // Deep-copy ALL branding fields from the template
    const { data: createdTask, error: createError } = await supabase
      .from("tasks")
      .insert({
        title: fullTemplate.title,
        description: fullTemplate.description,
        priority: fullTemplate.priority,
        tags: fullTemplate.tags,
        task_type: fullTemplate.task_type,
        steps: fullTemplate.steps,
        client_id: fullTemplate.client_id,
        estimated_hours: fullTemplate.estimated_hours,
        compensation_amount: fullTemplate.compensation_amount,
        google_play_url: fullTemplate.google_play_url,
        apple_store_url: fullTemplate.apple_store_url,
        // Branding fields - deep copy from template
        image_url: fullTemplate.image_url,
        images: fullTemplate.images || [],
        logo_url: fullTemplate.logo_url,
        primary_color: fullTemplate.primary_color,
        secondary_color: fullTemplate.secondary_color,
        accent_color: fullTemplate.accent_color,
        branding_url: fullTemplate.branding_url,
        // Assignment fields
        assigned_to: employeeId,
        status: "active",
        created_by: session.user.id,
      } as any)
      .select("id")
      .single();

    if (createError || !createdTask) {
      console.error("Error creating task copy:", createError);
      toast.error("Fehler beim Erstellen der Aufgabenkopie: " + (createError?.message || "Unbekannt"));
      return;
    }

    // Create a submission for the new task copy
    const { data: createdSubmission } = await supabase
      .from("task_submissions")
      .insert({ 
        task_id: createdTask.id, 
        employee_id: employeeId, 
        status: "in_progress", 
        step_responses: [] 
      })
      .select("id")
      .single();

    // Send compliance email to the employee (first task assignment)
    if (createdSubmission?.id) {
      try {
        await supabase.functions.invoke("send-compliance-email", {
          body: { userId: employeeId, submissionId: createdSubmission.id }
        });
      } catch (e) {
        console.log("Compliance email check:", e);
      }
    }

    console.log("Task copy created and assigned successfully:", createdTask.id);
    toast.success("Aufgabe zugewiesen (Kopie erstellt)");
    setAssignDialogOpen(false);
    setAssigningTask(null);
    await fetchTasks();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Hoch";
      case "medium":
        return "Mittel";
      case "low":
        return "Niedrig";
      default:
        return priority;
    }
  };

  const getEmployeeName = (employeeId: string | null) => {
    if (!employeeId) return "Nicht zugewiesen";
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return "Unbekannt";
    return employee.first_name && employee.last_name
      ? `${employee.first_name} ${employee.last_name}`
      : employee.email;
  };

  // Templates sind Tasks ohne assigned_to (diese sind die echten Vorlagen)
  // Zugewiesene Kopien haben assigned_to gesetzt
  const templateTasks = tasks.filter(task => !task.assigned_to);
  const assignedTasks = tasks.filter(task => task.assigned_to);
  
  const baseFilteredTasks = (() => {
    if (filterEmployee === "all") return templateTasks; // Standard: Nur Vorlagen zeigen
    if (filterEmployee === "unassigned") return templateTasks;
    if (filterEmployee === "assigned") return assignedTasks; // Alle zugewiesenen Kopien
    return tasks.filter(task => task.assigned_to === filterEmployee);
  })();
  const filteredTasks = baseFilteredTasks.filter(t =>
    templateTab === "billo" ? t.category === "billo" : t.category !== "billo"
  );
  const billoTemplateCount = templateTasks.filter(t => t.category === "billo").length;

  if (loading) {
    return <PageLoader />;
  }

  const handleExportTemplates = async () => {
    setExporting(true);
    try {
      const { payload, embedded, failed } = await fetchExportWithFiles();
      const blob = await buildExportZip(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aufgabenvorlagen-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        failed.length > 0
          ? `Export erstellt — ${embedded} Bilder/Dateien enthalten, ${failed.length} konnten nicht geladen werden`
          : `Export erstellt — ${embedded} Bilder/Dateien enthalten`,
      );
    } catch (err: any) {
      toast.error("Export fehlgeschlagen: " + (err?.message || "Unbekannter Fehler"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Aufgabenvorlagen
            </h1>
            <p className="text-muted-foreground">
              Erstellen und verwalten Sie Vorlagen für wiederkehrende Aufgabentypen
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Ansicht:</span>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger id="employee-filter" className="w-56">
                <SelectValue placeholder="Vorlagen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vorlagen ({templateTasks.length})</SelectItem>
                <SelectItem value="assigned">Zugewiesene Kopien ({assignedTasks.length})</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.first_name && employee.last_name
                      ? `${employee.first_name} ${employee.last_name}`
                      : employee.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportTemplates} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Export läuft…" : "Vorlagen exportieren"}
            </Button>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Neue Vorlage
            </Button>
          </div>
        </div>


        <Tabs value={templateTab} onValueChange={(v) => setTemplateTab(v as "auftraege" | "billo")} className="mb-6">
          <TabsList>
            <TabsTrigger value="auftraege">Aufträge ({templateTasks.length - billoTemplateCount})</TabsTrigger>
            <TabsTrigger value="billo">Billo Aufträge ({billoTemplateCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        {templateTab === "billo" && (
          <Card className="mb-6">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Jeder Mitarbeiter erhält <strong className="text-foreground">20 Billo Aufträge pro Woche</strong> – das entspricht einer Teilzeitstelle mit 20 Stunden pro Woche (ca. 1 Stunde je Auftrag).
              {billoTemplateCount < 20 && ` Aktuell sind ${billoTemplateCount} von 20 Vorlagen angelegt.`}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  {templateTasks.length === 0 && filterEmployee === "all" 
                    ? "Keine Vorlagen vorhanden" 
                    : filterEmployee === "assigned" 
                      ? "Keine zugewiesenen Aufgaben"
                      : "Keine Ergebnisse"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {templateTasks.length === 0 && filterEmployee === "all"
                    ? "Erstellen Sie Ihre erste Aufgabenvorlage" 
                    : filterEmployee === "assigned"
                      ? "Es wurden noch keine Aufgaben an Mitarbeiter zugewiesen"
                      : "Keine Aufgaben für diesen Filter gefunden"}
                </p>
                {templateTasks.length === 0 && filterEmployee === "all" && (
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Vorlage erstellen
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            ["bankdrop", "exchanger", "sonstiges", "billo"].map((cat) => {
              const catTasks = filteredTasks.filter(t => (t.category || "sonstiges") === cat);
              if (catTasks.length === 0) return null;
              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{CATEGORY_LABELS[cat] || cat}</h2>
                    <Badge className={CATEGORY_COLORS[cat]}>{catTasks.length}</Badge>
                  </div>
                  {catTasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{task.title}</h3>
                              <Badge variant={getPriorityColor(task.priority)}>
                                {getPriorityLabel(task.priority)}
                              </Badge>
                              {task.tags.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                              {task.steps && task.steps.length > 0 && (
                                <Badge variant="secondary">
                                  <ListOrdered className="h-3 w-3 mr-1" />
                                  {task.steps.length} Steps
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-4">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {task.estimated_hours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {task.estimated_hours} Stunden
                                </div>
                              )}
                              <div>
                                Aktualisiert: {format(new Date(task.updated_at), "dd.MM.yyyy")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenAssignDialog(task)}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Zuweisen
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenDialog(task)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicateTask(task)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplizieren
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingTask ? "Aufgabenvorlage bearbeiten" : "Neue Aufgabenvorlage erstellen"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Bearbeiten Sie die Aufgabenvorlage. Beschreibungen und Abstände werden wie eingegeben übernommen.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="grundinfo" className="text-sm">
                  1. Grundinformationen
                </TabsTrigger>
                <TabsTrigger value="steps" className="text-sm">
                  2. Arbeitsschritte definieren
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto py-4">
                {/* Tab 1: Grundinformationen */}
                <TabsContent value="grundinfo" className="space-y-4 m-0">
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Titel <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Titel der Aufgabenvorlage"
                    />
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="priority">
                      Priorität <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Kategorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bankdrop">Bankdrop</SelectItem>
                        <SelectItem value="exchanger">Exchanger</SelectItem>
                        <SelectItem value="sonstiges">Sonstiges</SelectItem>
                        <SelectItem value="billo">Billo Auftrag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="default_info_text">
                      Fragen und Antworten (Standardtext)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Wird beim Befüllen der Demodaten automatisch in das Feld „Info / Fragen und Antworten" eingetragen und kann dort weiter angepasst werden.
                    </p>
                    <Textarea
                      id="default_info_text"
                      value={formData.default_info_text}
                      onChange={(e) => setFormData({ ...formData, default_info_text: e.target.value })}
                      placeholder="z.B. Frage: ...&#10;Antwort: ..."
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Auftragsbilder
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Fügen Sie mehrere Bilder hinzu - sie wechseln sich automatisch alle 5-8 Sekunden in der Demo-Console
                    </p>
                    
                    {/* Image Gallery */}
                    <div className="flex flex-wrap gap-2">
                      {taskImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-muted-foreground/30 group"
                        >
                          <img 
                            src={img} 
                            alt={`Bild ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setTaskImages(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold bg-black/60 text-white px-1 rounded">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                      
                      {/* Add Image Placeholder */}
                      <label
                        htmlFor="multi_image_upload"
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      >
                        {uploadingImage ? (
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                          <>
                            <Plus className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground mt-0.5">Hinzufügen</span>
                          </>
                        )}
                      </label>
                      <input
                        id="multi_image_upload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          
                          // Filter files by size
                          const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
                          if (validFiles.length < files.length) {
                            toast.error(`${files.length - validFiles.length} Bild(er) übersprungen (>5MB)`);
                          }
                          if (validFiles.length === 0) return;
                          
                          setUploadingImage(true);
                          const uploaded: string[] = [];
                          
                          for (const file of validFiles) {
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${crypto.randomUUID()}.${fileExt}`;
                              const filePath = `task-images/${fileName}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from("task-files")
                                .upload(filePath, file, { upsert: true });
                              
                              if (uploadError) throw uploadError;
                              
                              const { data: { publicUrl } } = supabase.storage
                                .from("task-files")
                                .getPublicUrl(filePath);
                              
                              uploaded.push(publicUrl);
                            } catch (error: any) {
                              console.error("Upload error:", error);
                            }
                          }
                          
                          if (uploaded.length > 0) {
                            setTaskImages(prev => [...prev, ...uploaded]);
                            toast.success(`${uploaded.length} Bild(er) hochgeladen`);
                          }
                          setUploadingImage(false);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    
                    {/* URL Input for manual entry */}
                    <div className="flex gap-2">
                      <Input
                        id="image_url_manual"
                        type="url"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="URL einfügen und Enter drücken"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && formData.image_url.trim()) {
                            e.preventDefault();
                            setTaskImages(prev => [...prev, formData.image_url.trim()]);
                            setFormData(prev => ({ ...prev, image_url: "" }));
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!formData.image_url.trim()}
                        onClick={() => {
                          if (formData.image_url.trim()) {
                            setTaskImages(prev => [...prev, formData.image_url.trim()]);
                            setFormData(prev => ({ ...prev, image_url: "" }));
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Max. 5MB pro Bild. {taskImages.length > 0 && <span className="font-medium">{taskImages.length} Bild(er) hinzugefügt</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="compensation_amount">Vergütungsbetrag (€)</Label>
                      <Input
                        id="compensation_amount"
                        type="number"
                        step="0.01"
                        value={formData.compensation_amount}
                        onChange={(e) => setFormData({ ...formData, compensation_amount: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Standard-Vergütung für diese Aufgabe. Kann bei der Zuweisung überschrieben werden.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimated_hours">Geschätzte Stunden</Label>
                      <Input
                        id="estimated_hours"
                        type="number"
                        step="0.5"
                        value={formData.estimated_hours}
                        onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                        placeholder="Geschätzte Arbeitsstunden"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deadline_days">Bearbeitungsfrist (Tage)</Label>
                      <Input
                        id="deadline_days"
                        type="number"
                        min="1"
                        max="30"
                        step="1"
                        value={formData.deadline_days}
                        onChange={(e) => setFormData({ ...formData, deadline_days: e.target.value })}
                        placeholder="3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Standard 1–3 Tage. Der Timer startet automatisch, sobald die Demo-Daten freigegeben wurden.
                      </p>
                    </div>
                  </div>

                  {/* Branding URL for Theme Extraction */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Theme-Branding URL
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      URL einer Website, von der automatisch Farben für die Demo-Sequenz extrahiert werden
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        id="branding_url"
                        type="url"
                        value={formData.branding_url}
                        onChange={(e) => {
                          setFormData({ ...formData, branding_url: e.target.value });
                          setBrandingPreview(null); // Clear preview when URL changes
                        }}
                        placeholder="https://www.example.com"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!formData.branding_url || extractingBranding}
                        onClick={async () => {
                          if (!formData.branding_url) return;
                          setExtractingBranding(true);
                          setBrandingPreview(null);
                          try {
                            const { data, error } = await supabase.functions.invoke("extract-branding", {
                              body: { url: formData.branding_url },
                            });

                            if (error) throw error;
                            if (data?.success && data?.branding) {
                              const next = {
                                primary_color: data.branding.primary_color,
                                secondary_color: data.branding.secondary_color,
                                accent_color: data.branding.accent_color,
                                logo: data.branding.logo,
                              } as const;

                              // 1) Update preview immediately
                              setBrandingPreview(next);

                              // 2) Also write values into the form state so they get saved even if user doesn't re-extract
                              setFormData((prev) => ({
                                ...prev,
                                primary_color: next.primary_color || "",
                                secondary_color: next.secondary_color || "",
                                accent_color: next.accent_color || "",
                                logo_url: next.logo || "",
                              }));

                              // 3) If we're editing an existing task, persist branding right away
                              if (editingTask?.id) {
                                const { error: persistError } = await supabase
                                  .from("tasks")
                                  .update({
                                    branding_url: formData.branding_url || null,
                                    primary_color: next.primary_color || null,
                                    secondary_color: next.secondary_color || null,
                                    accent_color: next.accent_color || null,
                                    logo_url: next.logo || null,
                                  } as any)
                                  .eq("id", editingTask.id);

                                if (persistError) {
                                  console.error("Branding persist error:", persistError);
                                  toast.error("Branding extrahiert, aber Speichern fehlgeschlagen");
                                } else {
                                  // Keep list in sync
                                  fetchTasks();
                                  toast.success("Branding übernommen");
                                }
                              } else {
                                toast.success("Branding extrahiert! Beim Speichern wird es übernommen.");
                              }
                            } else {
                              toast.error("Konnte Branding nicht extrahieren");
                            }
                          } catch (err: any) {
                            console.error("Branding extraction error:", err);
                            toast.error("Fehler: " + (err.message || "Unbekannt"));
                          } finally {
                            setExtractingBranding(false);
                          }
                        }}
                      >
                        {extractingBranding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Extrahieren"
                        )}
                      </Button>
                    </div>

                    {/* Live Branding Preview */}
                    {brandingPreview && (
                      <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Farb-Vorschau</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setBrandingPreview(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Color Swatches */}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="w-12 h-12 rounded-lg border shadow-sm"
                              style={{ backgroundColor: brandingPreview.primary_color }}
                            />
                            <span className="text-[10px] text-muted-foreground">Primary</span>
                            <span className="text-[10px] font-mono">{brandingPreview.primary_color}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="w-12 h-12 rounded-lg border shadow-sm"
                              style={{ backgroundColor: brandingPreview.secondary_color }}
                            />
                            <span className="text-[10px] text-muted-foreground">Secondary</span>
                            <span className="text-[10px] font-mono">{brandingPreview.secondary_color}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="w-12 h-12 rounded-lg border shadow-sm"
                              style={{ backgroundColor: brandingPreview.accent_color }}
                            />
                            <span className="text-[10px] text-muted-foreground">Accent</span>
                            <span className="text-[10px] font-mono">{brandingPreview.accent_color}</span>
                          </div>
                          {brandingPreview.logo && (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-12 h-12 rounded-lg border shadow-sm bg-white flex items-center justify-center overflow-hidden">
                                <img 
                                  src={brandingPreview.logo} 
                                  alt="Logo" 
                                  className="max-w-full max-h-full object-contain"
                                  onError={(e) => {
                                    // Fallback: versuche über unser Backend zu laden
                                    const target = e.target as HTMLImageElement;
                                    if (!target.dataset.fallbackAttempted) {
                                      target.dataset.fallbackAttempted = 'true';
                                      // Zeige Platzhalter bei Fehler
                                      target.src = '/placeholder.svg';
                                      target.alt = 'Logo konnte nicht geladen werden';
                                    }
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">Logo</span>
                              <a 
                                href={brandingPreview.logo} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[9px] text-primary hover:underline truncate max-w-[60px]"
                                title={brandingPreview.logo}
                              >
                                URL öffnen
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Logo-Quelle Auswahl */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-muted-foreground font-medium">Logo-Quelle:</span>
                          
                          {/* Option: Auftragsbild als Logo */}
                          {formData.image_url && (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <Checkbox
                                id="use_image_as_logo"
                                checked={formData.logo_url === formData.image_url}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setBrandingPreview(prev => prev ? { ...prev, logo: formData.image_url } : null);
                                    setFormData(prev => ({ ...prev, logo_url: formData.image_url }));
                                  } else {
                                    setBrandingPreview(prev => prev ? { ...prev, logo: undefined } : null);
                                    setFormData(prev => ({ ...prev, logo_url: '' }));
                                  }
                                }}
                              />
                              <Label htmlFor="use_image_as_logo" className="text-xs cursor-pointer flex items-center gap-2">
                                <Image className="h-3 w-3" />
                                Auftragsbild als Logo
                              </Label>
                              <img 
                                src={formData.image_url} 
                                alt="Auftragsbild" 
                                className="w-6 h-6 rounded border object-contain bg-white ml-auto"
                              />
                            </div>
                          )}

                          {/* Option: Eigenes Logo hochladen */}
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                            <Upload className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">Eigenes Logo:</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="logo-upload"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                try {
                                  const fileExt = file.name.split('.').pop();
                                  const fileName = `logo-${Date.now()}.${fileExt}`;
                                  const filePath = `task-logos/${fileName}`;
                                  
                                  const { error: uploadError } = await supabase.storage
                                    .from('task-files')
                                    .upload(filePath, file);
                                  
                                  if (uploadError) throw uploadError;
                                  
                                  const { data: { publicUrl } } = supabase.storage
                                    .from('task-files')
                                    .getPublicUrl(filePath);
                                  
                                  setFormData(prev => ({ ...prev, logo_url: publicUrl }));
                                  setBrandingPreview(prev => prev ? { ...prev, logo: publicUrl } : null);
                                  toast.success("Logo hochgeladen");
                                } catch (error: any) {
                                  console.error("Logo upload error:", error);
                                  toast.error("Fehler beim Hochladen: " + error.message);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                            >
                              Hochladen
                            </Button>
                            {formData.logo_url && formData.logo_url !== formData.image_url && (
                              <div className="flex items-center gap-2 ml-auto">
                                <img 
                                  src={formData.logo_url} 
                                  alt="Logo" 
                                  className="w-6 h-6 rounded border object-contain bg-white"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, logo_url: '' }));
                                    setBrandingPreview(prev => prev ? { ...prev, logo: undefined } : null);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Option: Logo-URL manuell eingeben */}
                          <div className="flex items-center gap-2">
                            <Input
                              type="url"
                              placeholder="Oder Logo-URL eingeben..."
                              className="h-7 text-xs"
                              value={formData.logo_url !== formData.image_url ? formData.logo_url : ''}
                              onChange={(e) => {
                                setFormData(prev => ({ ...prev, logo_url: e.target.value }));
                                if (e.target.value) {
                                  setBrandingPreview(prev => prev ? { ...prev, logo: e.target.value } : null);
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* Live Console Preview */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-muted-foreground">Demo-Console Vorschau:</span>
                          <DemoConsoleLivePreview
                            brandColors={{
                              primary: brandingPreview.primary_color,
                              secondary: brandingPreview.secondary_color,
                              accent: brandingPreview.accent_color,
                            }}
                            logoUrl={formData.logo_url || brandingPreview.logo}
                            taskTitle={formData.title || "Demo Auftrag"}
                          />
                        </div>

                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          ✓ Die Farben werden automatisch beim Speichern übernommen
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Die Farben werden automatisch für die Demo-Console des Auftrags verwendet
                    </p>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">App Store URLs</Label>
                    <p className="text-sm text-muted-foreground">
                      Fügen Sie App Store URLs hinzu, die automatisch bei Task-Zuweisungen verfügbar sind
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="google_play_url">Google Play Store URL</Label>
                      <Input
                        id="google_play_url"
                        type="url"
                        value={formData.google_play_url}
                        onChange={(e) => setFormData({ ...formData, google_play_url: e.target.value })}
                        placeholder="https://play.google.com/store/apps/..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="apple_store_url">Apple App Store URL</Label>
                      <Input
                        id="apple_store_url"
                        type="url"
                        value={formData.apple_store_url}
                        onChange={(e) => setFormData({ ...formData, apple_store_url: e.target.value })}
                        placeholder="https://apps.apple.com/app/..."
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <input
                      type="checkbox"
                      id="is_starter_job"
                      checked={formData.is_starter_job}
                      onChange={(e) => setFormData({ ...formData, is_starter_job: e.target.checked })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="is_starter_job" className="cursor-pointer font-medium">
                        Als Starter-Job für neue Mitarbeiter festlegen
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Diese Aufgabe wird automatisch jedem neuen Mitarbeiter direkt nach der Registrierung zugewiesen.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Arbeitsschritte */}
                <TabsContent value="steps" className="space-y-4 m-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Aufgaben-Schritte</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Definieren Sie die Schritte, die Mitarbeiter durchlaufen müssen
                      </p>
                    </div>
                    <Badge variant="secondary">{taskSteps.length} Steps</Badge>
                  </div>
                  
                  {/* Existing Steps */}
                  {taskSteps.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={taskSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                          {taskSteps.map((step, index) => (
                            <SortableStepEditor
                              key={step.id}
                              step={step}
                              index={index}
                              expanded={expandedSteps.includes(step.id)}
                              onToggle={() => toggleExpanded(step.id)}
                              onRemove={handleRemoveStep}
                              onChange={handleStepChange}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* Add New Step */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <Label className="text-sm font-medium">Neuen Schritt hinzufügen</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="step_title" className="text-xs">Titel *</Label>
                        <Input
                          id="step_title"
                          placeholder="z.B. Video-Identifikation"
                          value={newStep.title}
                          onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="step_type" className="text-xs">Typ</Label>
                        <Select
                          value={newStep.type}
                          onValueChange={(value: TaskStep["type"]) => setNewStep({ ...newStep, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Einleitung</SelectItem>
                            <SelectItem value="checkbox">Zustimmung</SelectItem>
                            <SelectItem value="file">Datei</SelectItem>
                            <SelectItem value="product_test">Produkttest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="step_description" className="text-xs">Beschreibung</Label>
                      <Textarea
                        id="step_description"
                        placeholder="Anweisungen für den Mitarbeiter... (Sie können formatierte Texte mit Emojis, Aufzählungen etc. eingeben)"
                        value={newStep.description}
                        onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        rows={12}
                        className="font-mono text-sm whitespace-pre-wrap"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tipp: Verwenden Sie Emojis (🔹, 🟢, 🔘) und Strukturierung für bessere Lesbarkeit
                      </p>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button type="button" onClick={handleAddStep} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Schritt hinzufügen
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (currentTab === "steps") {
                      setCurrentTab("grundinfo");
                    } else {
                      setDialogOpen(false);
                    }
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {currentTab === "grundinfo" ? "Abbrechen" : "Zurück"}
                </Button>
                <Button onClick={handleSaveTask}>
                  {editingTask ? "Aktualisieren" : "Erstellen"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Auftrag zuweisen</DialogTitle>
              <DialogDescription>
                Wählen Sie einen Mitarbeiter für: {assigningTask?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Input 
                placeholder="Mitarbeiter suchen..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAssignTask(null)}
              >
                Nicht zugewiesen
              </Button>
              {employees
                .filter((employee) => {
                  if (!assignSearch.trim()) return true;
                  const term = assignSearch.toLowerCase();
                  const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.toLowerCase();
                  return (
                    fullName.includes(term) || employee.email.toLowerCase().includes(term)
                  );
                })
                .map((employee) => {
                  const isAlreadyAssigned = assigningTask?.assigned_to === employee.id;
                  return (
                    <Button
                      key={employee.id}
                      variant={isAlreadyAssigned ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => handleAssignTask(employee.id)}
                      disabled={isAlreadyAssigned}
                    >
                      {employee.first_name && employee.last_name
                        ? `${employee.first_name} ${employee.last_name} (${employee.email})`
                        : employee.email}
                      {isAlreadyAssigned && " (Bereits zugewiesen)"}
                    </Button>
                  );
                })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TaskManagement;
