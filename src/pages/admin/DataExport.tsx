import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, CheckCircle, AlertCircle, Loader2, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchExportWithFiles, buildExportZip, readExportFile } from "@/lib/exportWithFiles";
import indexCss from "@/index.css?raw";
import tailwindConfig from "../../../tailwind.config.ts?raw";

const DataExport = () => {
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportLoading(true);
    setStatus(null);
    try {
      const { payload: exported, embedded, failed } = await fetchExportWithFiles();

      const payload = {
        ...exported,
        theme: {
          "src/index.css": indexCss,
          "tailwind.config.ts": tailwindConfig,
        },
      };

      const zip = await buildExportZip(payload);
      download(zip, `project-export-${new Date().toISOString().slice(0, 10)}.zip`);

      const summary = (exported?.summary || {}) as Record<string, number>;
      const records = Object.entries(summary)
        .filter(([key]) => key !== "storage_files")
        .reduce((sum, [, value]) => sum + (value || 0), 0);

      setStatus({
        type: "success",
        message: `Export erfolgreich: ${records} Datensätze, ${embedded} Bilder/Dateien direkt in der Datei${
          failed.length > 0 ? ` (${failed.length} nicht ladbar)` : ""
        } und das komplette Theme.`,
      });
    } catch (err: any) {
      setStatus({ type: "error", message: `Export fehlgeschlagen: ${err.message}` });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setStatus(null);
    try {
      const json = await readExportFile(file);

      const { data, error } = await supabase.functions.invoke("import-project-data", {
        body: json,
      });
      if (error) throw error;

      const results = data?.results || {};
      const totalInserted = Object.values(results as Record<string, any>).reduce(
        (sum: number, r: any) => sum + (r.inserted || 0), 0
      );
      const themeNote = json.theme
        ? " Das enthaltene Theme muss einmalig im Chat übernommen werden."
        : "";
      setStatus({ type: "success", message: `Import erfolgreich! ${totalInserted} Datensätze importiert.${themeNote}` });
    } catch (err: any) {
      setStatus({ type: "error", message: `Import fehlgeschlagen: ${err.message}` });
    } finally {
      setImportLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Daten Export / Import</h1>
      <p className="text-muted-foreground">
        Exportiere alle Inhalte, Bilder, Links und das Theme als ZIP-Datei, um sie in ein anderes Projekt zu übernehmen.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Export
          </CardTitle>
          <CardDescription>
            Enthält Aufgabenvorlagen, E-Mail- und Abschluss-Vorlagen, Verträge, virtuelle Mitarbeiter, FAQ und
            Einstellungen — plus alle Bilder und Dateien sowie Farben und Schriften des Designs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleExport} disabled={exportLoading} size="lg">
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Alles exportieren (Inhalte, Bilder, Theme)
          </Button>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Palette className="h-4 w-4 mt-0.5 shrink-0" />
            Die ZIP enthält alle Bilder und Dateien im Ordner „files" sowie die Daten in „data.json" — unbegrenzt gültig.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import
          </CardTitle>
          <CardDescription>
            Lade eine zuvor exportierte ZIP-Datei (oder ältere JSON-Datei) hoch, um die Daten in dieses Projekt zu importieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label>
            <Button asChild size="lg" variant="outline" disabled={importLoading}>
              <span>
                {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                ZIP importieren
                <input type="file" accept=".zip,.json" className="hidden" onChange={handleImport} />
              </span>
            </Button>
          </label>
        </CardContent>
      </Card>

      {status && (
        <div className={`flex items-start gap-2 p-4 rounded-lg ${status.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {status.type === "success" ? <CheckCircle className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
};

export default DataExport;
