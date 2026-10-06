import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Hexagon, Clock, CheckCircle2, Trash2, Check, Plus } from "lucide-react";

interface AssignedTask {
  id: string;
  title: string;
  task_type: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  due_date: string | null;
  steps: any[] | null;
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

type TrafficLightStatus = "active" | "pending" | "completed";

interface TasksAmpelSystemProps {
  assignedTasks: AssignedTask[];
  availableTasks: AssignedTask[];
  employeeTasks: TaskSubmission[];
  onDeleteTask: (taskId: string) => void;
  onBulkDelete?: (taskIds: string[]) => void;
  onBulkAssign?: (taskIds: string[]) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onAssignTask: (taskId: string) => void;
  selectedTaskIds: string[];
  onToggleTaskSelection: (taskId: string) => void;
}

interface TaskItem {
  id: string;
  title: string;
  taskType: string | null;
  createdAt: string;
  dueDate: string | null;
  steps: any[] | null;
  status: TrafficLightStatus;
  originalStatus: string;
  isSubmission: boolean;
  submissionStatus?: string;
  isAvailable?: boolean;
}

const SelectableTaskCard = ({
  task,
  isSelected,
  onToggleSelect,
}: {
  task: TaskItem;
  isSelected: boolean;
  onToggleSelect: (taskId: string) => void;
}) => {
  // Allow selection for: available templates, active tasks, and completed tasks
  const isSelectable = task.isAvailable || task.status === "active" || task.status === "completed";
  
  return (
    <div
      onClick={() => isSelectable && onToggleSelect(task.id)}
      className={`flex items-center gap-3 p-3 bg-card border rounded-lg transition-all ${
        task.isAvailable 
          ? "cursor-pointer hover:bg-muted/50 border-dashed border-yellow-500/50" 
          : task.status === "active" || task.status === "completed"
          ? "cursor-pointer hover:bg-muted/50"
          : ""
      } ${
        isSelected 
          ? "ring-2 ring-primary bg-primary/5 border-primary" 
          : ""
      }`}
    >
      {isSelectable && (
        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          isSelected 
            ? "bg-primary border-primary" 
            : "border-muted-foreground/30"
        }`}>
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate text-sm">{task.title}</p>
          {task.isAvailable && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
              Vorlage
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskZone = ({
  status,
  tasks,
  label,
  icon: Icon,
  selectedTaskIds,
  onToggleTaskSelection,
}: {
  status: TrafficLightStatus;
  tasks: TaskItem[];
  label: string;
  icon: typeof Hexagon;
  selectedTaskIds: string[];
  onToggleTaskSelection: (taskId: string) => void;
}) => {
  const colorStyles = {
    active: {
      border: "border-l-4 border-l-purple-500",
      bg: "bg-card",
      icon: "text-purple-500",
      badge: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    },
    pending: {
      border: "border-l-4 border-l-yellow-500",
      bg: "bg-card",
      icon: "text-yellow-500",
      badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    },
    completed: {
      border: "border-l-4 border-l-green-500",
      bg: "bg-card",
      icon: "text-green-500",
      badge: "bg-green-500/20 text-green-700 dark:text-green-300",
    },
  };

  const styles = colorStyles[status];

  return (
    <Card className={`${styles.border} ${styles.bg}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${styles.icon}`} />
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
          </div>
          <Badge variant="secondary" className={`${styles.badge} text-xs`}>
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-2 min-h-[60px]">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Keine Aufträge
            </p>
          ) : (
            tasks.map((task) => (
              <SelectableTaskCard
                key={task.id}
                task={task}
                isSelected={selectedTaskIds.includes(task.id)}
                onToggleSelect={onToggleTaskSelection}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const TasksAmpelSystem = ({
  assignedTasks,
  availableTasks,
  employeeTasks,
  onDeleteTask,
  onBulkDelete,
  onBulkAssign,
  onStatusChange,
  onAssignTask,
  selectedTaskIds,
  onToggleTaskSelection,
}: TasksAmpelSystemProps) => {
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  
  // Convert tasks to unified format
  const allTasks: TaskItem[] = [
    // Available tasks (unassigned templates) - shown as pending
    ...availableTasks.map((task) => ({
      id: task.id,
      title: task.title,
      taskType: task.task_type,
      createdAt: task.created_at,
      dueDate: task.due_date,
      steps: task.steps,
      status: "pending" as TrafficLightStatus,
      originalStatus: task.status || "pending",
      isSubmission: false,
      isAvailable: true,
    })),
    // Assigned tasks
    ...assignedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      taskType: task.task_type,
      createdAt: task.created_at,
      dueDate: task.due_date,
      steps: task.steps,
      status: getTrafficLightStatus(task.status),
      originalStatus: task.status,
      isSubmission: false,
      isAvailable: false,
    })),
    // Completed submissions
    ...employeeTasks
      .filter((t) => t.status === "approved" || t.status === "completed")
      .map((task) => ({
        id: task.task_id,
        title: task.tasks?.title || "Unbekannter Auftrag",
        taskType: task.tasks?.task_type || null,
        createdAt: task.submitted_at,
        dueDate: null,
        steps: task.tasks?.steps || null,
        status: "completed" as TrafficLightStatus,
        originalStatus: task.status,
        isSubmission: true,
        submissionStatus: task.status,
        isAvailable: false,
      })),
  ];

  // Remove duplicates (prefer submissions for completed tasks)
  const uniqueTasks = allTasks.reduce((acc, task) => {
    const existing = acc.find((t) => t.id === task.id);
    if (existing) {
      // Prefer submission (completed) status
      if (task.isSubmission) {
        return acc.map((t) => (t.id === task.id ? task : t));
      }
      return acc;
    }
    return [...acc, task];
  }, [] as TaskItem[]);

  function getTrafficLightStatus(status: string): TrafficLightStatus {
    const s = status?.toLowerCase();
    if (s === "completed" || s === "done" || s === "approved") return "completed";
    if (s === "active" || s === "in_progress") return "active";
    return "pending";
  }

  const getTasksByStatus = (status: TrafficLightStatus) => {
    return uniqueTasks.filter((task) => task.status === status);
  };

  // Check what types are selected
  const selectedActiveTasks = selectedTaskIds.filter(id => {
    const task = uniqueTasks.find(t => t.id === id);
    return task && task.status === "active" && !task.isAvailable;
  });
  
  const selectedAvailableTasks = selectedTaskIds.filter(id => {
    const task = uniqueTasks.find(t => t.id === id);
    return task && task.isAvailable;
  });

  const selectedCompletedTasks = selectedTaskIds.filter(id => {
    const task = uniqueTasks.find(t => t.id === id);
    return task && task.status === "completed" && !task.isAvailable;
  });

  const hasActiveSelected = selectedActiveTasks.length > 0;
  const hasAvailableSelected = selectedAvailableTasks.length > 0;
  const hasCompletedSelected = selectedCompletedTasks.length > 0;
  
  // Combine active and completed for deletion
  const selectedDeletableTasks = [...selectedActiveTasks, ...selectedCompletedTasks];
  const hasDeletableSelected = selectedDeletableTasks.length > 0;

  return (
    <div className="grid gap-4">
      <TaskZone
        status="active"
        tasks={getTasksByStatus("active")}
        label="Aktiv (Lila) - Zum Löschen antippen"
        icon={Hexagon}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelection={onToggleTaskSelection}
      />

      <TaskZone
        status="pending"
        tasks={getTasksByStatus("pending")}
        label="Verfügbare Vorlagen (Gelb) - Zum Zuweisen antippen"
        icon={Clock}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelection={onToggleTaskSelection}
      />

      <TaskZone
        status="completed"
        tasks={getTasksByStatus("completed")}
        label="Abgeschlossen (Grün) - Zum Löschen antippen"
        icon={CheckCircle2}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelection={onToggleTaskSelection}
      />

      {selectedTaskIds.length > 0 && (
        <div className="sticky bottom-0 bg-card border shadow-lg px-4 py-3 rounded-lg flex items-center justify-center gap-4 z-50 mt-4">
          <span className="text-sm font-medium">
            {selectedTaskIds.length} ausgewählt
          </span>
          
          {hasAvailableSelected && onBulkAssign && (
            <AlertDialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Zuweisen ({selectedAvailableTasks.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vorlagen zuweisen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Möchten Sie {selectedAvailableTasks.length} Vorlage(n) diesem Mitarbeiter zuweisen?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onBulkAssign(selectedAvailableTasks);
                      setShowBulkAssignDialog(false);
                    }}
                  >
                    Ja, zuweisen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {hasDeletableSelected && onBulkDelete && (
            <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" />
                  Löschen ({selectedDeletableTasks.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zuweisungen entfernen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Möchten Sie {selectedDeletableTasks.length} Zuweisung(en) wirklich entfernen? 
                    {hasCompletedSelected && " (inkl. abgeschlossene Aufträge)"}
                    {" "}Diese Aktion kann nicht rückgängig gemacht werden. Die Aufträge können danach erneut zugewiesen werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onBulkDelete(selectedDeletableTasks);
                      setShowBulkDeleteDialog(false);
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
};
