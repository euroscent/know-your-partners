import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, Settings, Hexagon, Users, Clock, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
  client_id: string | null;
  image_url: string | null;
  clients?: {
    name: string;
    logo_url: string | null;
  } | null;
}

type TrafficLightStatus = "active" | "pending" | "completed";

interface TaskCardProps {
  task: Task;
  onView: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  isDragging?: boolean;
}

const SortableTaskCard = ({ task, onView, onEdit, isDragging }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      
      {task.image_url || task.clients?.logo_url ? (
        <img
          src={task.image_url || task.clients?.logo_url || ""}
          alt={task.title}
          className="w-10 h-10 rounded-md object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <Hexagon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{task.title}</p>
        {task.clients?.name && (
          <p className="text-xs text-muted-foreground">{task.clients.name}</p>
        )}
      </div>
      
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => onView(task.id)}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(task.id)}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Droppable zone component for traffic light sections
const TrafficLightZone = ({
  status,
  tasks,
  onView,
  onEdit,
  activeId,
  color,
  icon: Icon,
  label,
  onDrop,
}: {
  status: TrafficLightStatus;
  tasks: Task[];
  onView: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  activeId: string | null;
  color: string;
  icon: typeof Hexagon;
  label: string;
  onDrop: (taskId: string, status: TrafficLightStatus) => void;
}) => {
  const {
    setNodeRef,
    isOver,
  } = useSortable({
    id: `zone-${status}`,
    data: { type: "zone", status },
  });

  const colorStyles = {
    active: {
      border: "border-l-4 border-l-purple-500",
      bg: isOver ? "bg-purple-500/10" : "bg-card",
      icon: "text-purple-500",
      badge: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    },
    pending: {
      border: "border-l-4 border-l-yellow-500",
      bg: isOver ? "bg-yellow-500/10" : "bg-card",
      icon: "text-yellow-500",
      badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    },
    completed: {
      border: "border-l-4 border-l-green-500",
      bg: isOver ? "bg-green-500/10" : "bg-card",
      icon: "text-green-500",
      badge: "bg-green-500/20 text-green-700 dark:text-green-300",
    },
  };

  const styles = colorStyles[status];

  return (
    <Card
      ref={setNodeRef}
      className={`${styles.border} ${styles.bg} transition-colors duration-200`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${styles.icon}`} />
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          <Badge variant="secondary" className={styles.badge}>
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-[100px]">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Aufträge
              </p>
            ) : (
              tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onView={onView}
                  onEdit={onEdit}
                  isDragging={activeId === task.id}
                />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};

const Contracts = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients (
            name,
            logo_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Fehler beim Laden der Aufträge");
    } finally {
      setLoading(false);
    }
  };

  const getTrafficLightStatus = (task: Task): TrafficLightStatus => {
    const status = task.status?.toLowerCase();
    if (status === "completed" || status === "done") return "completed";
    if (status === "active" || status === "in_progress") return "active";
    return "pending";
  };

  const getTasksByStatus = (status: TrafficLightStatus) => {
    return tasks.filter((task) => getTrafficLightStatus(task) === status);
  };

  const handleStatusChange = async (taskId: string, newStatus: TrafficLightStatus) => {
    const statusMap: Record<TrafficLightStatus, string> = {
      active: "active",
      pending: "pending",
      completed: "completed",
    };

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: statusMap[newStatus] })
        .eq("id", taskId);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: statusMap[newStatus] } : task
        )
      );

      const statusLabels: Record<TrafficLightStatus, string> = {
        active: "Aktiv",
        pending: "Wartend",
        completed: "Abgeschlossen",
      };
      toast.success(`Auftrag auf "${statusLabels[newStatus]}" gesetzt`);
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error("Fehler beim Aktualisieren des Status");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a zone
    const overId = over.id as string;
    if (overId.startsWith("zone-")) {
      const newStatus = overId.replace("zone-", "") as TrafficLightStatus;
      const currentStatus = getTrafficLightStatus(activeTask);
      
      if (newStatus !== currentStatus) {
        handleStatusChange(activeTask.id, newStatus);
      }
      return;
    }

    // Check if dropped on another task - determine which zone it belongs to
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      const newStatus = getTrafficLightStatus(overTask);
      const currentStatus = getTrafficLightStatus(activeTask);
      
      if (newStatus !== currentStatus) {
        handleStatusChange(activeTask.id, newStatus);
      }
    }
  };

  const handleView = (taskId: string) => {
    navigate(`/dashboard/admin/tasks?view=${taskId}`);
  };

  const handleEdit = (taskId: string) => {
    navigate(`/dashboard/admin/tasks?edit=${taskId}`);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aufträge</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Aufträge per Drag & Drop im Ampel-System
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Aktiv</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Wartend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Abgeschlossen</span>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6">
          <TrafficLightZone
            status="active"
            tasks={getTasksByStatus("active")}
            onView={handleView}
            onEdit={handleEdit}
            activeId={activeId}
            color="purple"
            icon={Hexagon}
            label="Aktiv (Lila)"
            onDrop={handleStatusChange}
          />
          
          <TrafficLightZone
            status="pending"
            tasks={getTasksByStatus("pending")}
            onView={handleView}
            onEdit={handleEdit}
            activeId={activeId}
            color="yellow"
            icon={Clock}
            label="Wartend (Gelb)"
            onDrop={handleStatusChange}
          />
          
          <TrafficLightZone
            status="completed"
            tasks={getTasksByStatus("completed")}
            onView={handleView}
            onEdit={handleEdit}
            activeId={activeId}
            color="green"
            icon={CheckCircle2}
            label="Abgeschlossen (Grün)"
            onDrop={handleStatusChange}
          />
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="flex items-center gap-3 p-3 bg-card border rounded-lg shadow-lg">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              {activeTask.image_url || activeTask.clients?.logo_url ? (
                <img
                  src={activeTask.image_url || activeTask.clients?.logo_url || ""}
                  alt={activeTask.title}
                  className="w-10 h-10 rounded-md object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <Hexagon className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <p className="font-medium">{activeTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Contracts;
