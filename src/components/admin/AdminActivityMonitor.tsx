import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Activity } from "lucide-react";

interface ActivityLog {
  id: string;
  user_id: string;
  task_id: string | null;
  activity_type: string;
  step_index: number | null;
  step_title: string | null;
  metadata: any;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
  tasks?: {
    title: string;
  };
}

export const AdminActivityMonitor = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    loadActivities();

    const activityChannel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => loadActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
    };
  }, []);

  const loadActivities = async () => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        profiles!activity_logs_user_id_fkey(first_name, last_name),
        tasks!activity_logs_task_id_fkey(title)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading activities:', error);
    }

    if (data) {
      setActivities(data as any);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_start': return '🚀';
      case 'step_view': return '👀';
      case 'step_complete': return '✅';
      case 'file_upload': return '📎';
      case 'submission': return '📤';
      case 'kyc_started': return '🔐';
      case 'kyc_completed': return '✅';
      case 'demo_data_completed': return '📝';
      default: return '📝';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'task_start': return 'Auftrag gestartet';
      case 'step_view': return 'Schritt angesehen';
      case 'step_complete': return 'Schritt abgeschlossen';
      case 'file_upload': return 'Datei hochgeladen';
      case 'submission': return 'Eingereicht';
      case 'kyc_started': return 'KYC gestartet';
      case 'kyc_completed': return 'KYC abgeschlossen';
      case 'demo_data_completed': return 'Demo-Daten ausgefüllt';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Mitarbeiteraktivitäten
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Aktivitäten
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-2xl">{getActivityIcon(activity.activity_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">
                        {activity.profiles?.first_name} {activity.profiles?.last_name}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {getActivityLabel(activity.activity_type)}
                      </Badge>
                    </div>
                    {activity.tasks?.title && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Auftrag: {activity.tasks.title}
                      </p>
                    )}
                    {activity.step_title && (
                      <p className="text-xs text-muted-foreground">
                        Schritt {(activity.step_index || 0) + 1}: {activity.step_title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
