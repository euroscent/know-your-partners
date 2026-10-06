import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, FileImage, ExternalLink, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBannerUrls } from "@/lib/taskUtils";

interface LibraryTask {
  id: string;
  task_id: string;
  task_title: string;
  task_logo?: string | null;
  submitted_at: string;
  status: string | null;
  uploadedFiles: { name: string; url: string }[];
  bannerUrls: string[];
}

const Library = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<LibraryTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<LibraryTask | null>(null);
  useEffect(() => {
    fetchLibraryTasks();
  }, []);

  const fetchLibraryTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }

    // Nur Einreichungen aus dem aktuellen Monat anzeigen
    // Vergangene Monate werden für den Mitarbeiter ausgeblendet ("Reset" zum Monatswechsel)
    const nowDate = new Date();
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).toISOString();

    // Get submissions from current month only (including those where task was deleted - task_id may be null)
    const { data: submissions } = await supabase
      .from("task_submissions")
      .select("id, task_id, submitted_at, status, step_responses, tasks(title, logo_url, image_url, images)")
      .eq("employee_id", user.id)
      .gte("submitted_at", monthStart)
      .order("submitted_at", { ascending: false });

    if (!submissions) { setLoading(false); return; }

    const libraryItems: LibraryTask[] = [];

    for (const sub of submissions) {
      // Only show approved (admin-confirmed) submissions
      if (sub.status !== "approved") continue;

      const responses = sub.step_responses as any[] | null;
      if (!responses || !Array.isArray(responses)) continue;

      // Find file uploads in step_responses - they are stored as file_urls arrays
      const uploadedFiles: { name: string; url: string }[] = [];
      for (const step of responses) {
        // New format: { step_id, value, file_urls: [{ url, name, uploaded_at }] }
        if (step.file_urls && Array.isArray(step.file_urls)) {
          for (const file of step.file_urls) {
            if (file.url && file.name) {
              // Convert storage:// URLs to actual Supabase storage URLs
              let fileUrl = file.url;
              if (fileUrl.startsWith("storage://")) {
                const path = fileUrl.replace("storage://", "");
                const { data } = supabase.storage.from("task-files").getPublicUrl(path);
                fileUrl = data?.publicUrl || fileUrl;
              }
              uploadedFiles.push({ name: file.name, url: fileUrl });
            }
          }
        }
        // Legacy format: array items with direct url/name
        if (Array.isArray(step)) {
          for (const item of step) {
            if (typeof item === "object" && item !== null && "url" in item && "name" in item) {
              uploadedFiles.push({ name: (item as any).name, url: (item as any).url });
            }
          }
        }
      }

      if (uploadedFiles.length === 0) continue;

      const task = sub.tasks as any;
      const bannerUrls = task ? await getBannerUrls({
        image_url: task?.image_url,
        images: task?.images,
        logo_url: task?.logo_url,
      }) : [];

      libraryItems.push({
        id: sub.id,
        task_id: sub.task_id || "",
        task_title: task?.title || "Abgeschlossener Auftrag",
        task_logo: task?.logo_url || null,
        submitted_at: sub.submitted_at,
        status: sub.status,
        uploadedFiles,
        bannerUrls,
      });
    }

    setTasks(libraryItems);
    setLoading(false);
  };

  if (loading) {
    return <PageLoader text="Lädt Bibliothek..." />;
  }
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meine Bibliothek</h1>
            <p className="text-muted-foreground">
              Alle Aufträge mit hochgeladenen Dokumenten – Ihre digitale Trophäensammlung
            </p>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Noch keine Dokumente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Hier erscheinen Aufträge, bei denen Sie Dokumente hochgeladen haben.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {task.bannerUrls.length > 0 && (
                <div className="h-32 overflow-hidden">
                  <img
                    src={task.bannerUrls[0]}
                    alt={task.task_title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {task.task_logo && (
                      <img src={task.task_logo} alt="" className="h-10 w-10 rounded-lg object-contain flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{task.task_title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Eingereicht am {new Date(task.submitted_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={task.status === "approved" ? "default" : "secondary"}>
                    {task.status === "approved" ? "Abgeschlossen" : task.status === "awaiting_review" ? "In Prüfung" : task.status || "Offen"}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileImage className="h-3.5 w-3.5" />
                    {task.uploadedFiles.length} Dokument{task.uploadedFiles.length !== 1 ? "e" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {task.uploadedFiles.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 rounded-md px-2 py-1 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {task.task_id && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTask(task)}
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Dokumente ansehen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.task_logo && (
                <img src={selectedTask.task_logo} alt="" className="h-6 w-6 rounded object-contain" />
              )}
              {selectedTask?.task_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <p className="text-sm text-muted-foreground">
              {selectedTask?.uploadedFiles.length} hochgeladene{selectedTask?.uploadedFiles.length === 1 ? "s" : ""} Dokument{selectedTask?.uploadedFiles.length !== 1 ? "e" : ""}
            </p>
            <div className="space-y-2">
              {selectedTask?.uploadedFiles.map((file, idx) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name) || file.url.includes("image");
                return (
                  <div key={idx} className="border rounded-lg p-3">
                    {isImage && (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full max-h-48 object-contain rounded mb-2 bg-muted"
                      />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{file.name}</span>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Library;
