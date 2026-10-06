import { useState, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast-stub";
import { ArrowLeft, Info, X, Plus } from "lucide-react";

interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  version: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Variable {
  name: string;
  value: string;
}

const ContractEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState<ContractTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("1");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [content, setContent] = useState("");
  const [saveAsNewVersion, setSaveAsNewVersion] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([
    { name: "{{salary}}", value: "556 €" },
    { name: "{{startdatum}}", value: "Standardwert für Startdatum" }
  ]);

  // Sync monthlySalary with {{salary}} variable
  useEffect(() => {
    if (monthlySalary) {
      const newVars = variables.map(v => 
        v.name === "{{salary}}" ? { ...v, value: `${monthlySalary} €` } : v
      );
      setVariables(newVars);
    }
  }, [monthlySalary]);

  useEffect(() => {
    if (id) {
      fetchContract();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchContract = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Fehler beim Laden der Vorlage");
      navigate("/dashboard/settings");
      return;
    }

    if (data) {
      setContract(data);
      setTitle(data.name);
      setCategory(data.category);
      setVersion(data.version);
      setContent(data.content);
      
      // Prefer stored default_salary, else extract from content or fallback by category
      const templateDefaultSalary = (data as any)?.default_salary as number | null;
      if (templateDefaultSalary !== null && templateDefaultSalary !== undefined) {
        setMonthlySalary(String(templateDefaultSalary));
      } else {
        // Extract salary from content or set based on category
        const salaryMatch = data.content.match(/(\d+)\s*€/);
        if (salaryMatch) {
          setMonthlySalary(salaryMatch[1]);
        } else {
          // Auto-set based on category
          const salaries = {
            'Minijob': '603',
            'Teilzeit': '2580',
            'Vollzeit': '3890',
            'Freelancer': ''
          } as const;
          setMonthlySalary(salaries[data.category as keyof typeof salaries] || '');
        }
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title || !category || !version || !content) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    setSaving(true);

    try {
      const templateData = {
        name: title,
        category,
        version: saveAsNewVersion ? `v${parseInt(version.replace('v', '')) + 1}` : version,
        content,
        is_active: true,
        default_salary: monthlySalary ? Number(monthlySalary) : null,
      };

      if (id && !saveAsNewVersion) {
        // Update existing
        const { error } = await supabase
          .from("contract_templates")
          .update(templateData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Vorlage aktualisiert");
      } else {
        // Create new or new version
        const { error } = await supabase
          .from("contract_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success(saveAsNewVersion ? "Neue Version erstellt" : "Vorlage erstellt");
      }

      navigate("/dashboard/settings");
    } catch (error: any) {
      toast.error("Fehler beim Speichern: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    setVariables([...variables, { name: "", value: "" }]);
  };

  const updateVariable = (index: number, field: 'name' | 'value', value: string) => {
    const newVariables = [...variables];
    newVariables[index][field] = value;
    setVariables(newVariables);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const applyFormatting = (tag: string) => {
    const textarea = document.getElementById('content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (!selectedText) {
      toast.error("Bitte markieren Sie zuerst Text");
      return;
    }

    let formattedText = '';
    switch (tag) {
      case 'bold':
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        formattedText = `<em>${selectedText}</em>`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      case 'strikethrough':
        formattedText = `<s>${selectedText}</s>`;
        break;
      default:
        return;
    }

    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);

    // Set cursor position after the inserted tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <PageLoader />
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6 max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard/settings")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
              <h1 className="text-2xl font-semibold">
                {id ? "Vertragsvorlage bearbeiten" : "Neue Vertragsvorlage erstellen"}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-destructive hover:bg-destructive/90">
                {saving ? "Speichert..." : "Änderungen speichern"}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vorlagendetails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {id && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <div className="flex items-start justify-between flex-1">
                    <AlertDescription className="text-blue-900">
                      <strong className="block mb-1">Als neue Version speichern (Version 2)</strong>
                      Wenn aktiviert, wird eine neue Version der Vorlage erstellt, anstatt die bestehende zu überschreiben.
                    </AlertDescription>
                    <Checkbox
                      id="save-new-version"
                      checked={saveAsNewVersion}
                      onCheckedChange={(checked) => setSaveAsNewVersion(checked as boolean)}
                    />
                  </div>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z.B. Arbeitsvertrag - Vollzeit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select value={category} onValueChange={(val) => {
                    setCategory(val);
                    // Auto-set salary based on category
                    const salaries = {
                      'Minijob': '603',
                      'Teilzeit': '2580',
                      'Vollzeit': '3890',
                      'Freelancer': ''
                    } as const;
                    setMonthlySalary(salaries[val as keyof typeof salaries] || '');
                  }}>
                    <SelectTrigger id="category" className="bg-background">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Vollzeit">Vollzeit</SelectItem>
                      <SelectItem value="Teilzeit">Teilzeit</SelectItem>
                      <SelectItem value="Minijob">Minijob</SelectItem>
                      <SelectItem value="Freelancer">Freelancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">Monatliches Gehalt (€)</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="3890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Vertragstext</Label>
                <div className="border rounded-md">
                  <div className="flex gap-2 p-2 border-b bg-muted/50">
                    <Button variant="ghost" size="sm" type="button">Normal</Button>
                    <div className="h-6 w-px bg-border" />
                    <Button variant="ghost" size="sm" type="button" onClick={() => applyFormatting('bold')}>
                      <strong>B</strong>
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => applyFormatting('italic')}>
                      <em>I</em>
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => applyFormatting('underline')}>
                      <u>U</u>
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => applyFormatting('strikethrough')}>
                      <s>S</s>
                    </Button>
                  </div>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Vertragstext hier eingeben..."
                    rows={15}
                    className="border-0 rounded-none focus-visible:ring-0"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Verwenden Sie Platzhalter im Format {'{{variableName}}'} - Diese werden automatisch erkannt und unten angezeigt.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Erkannte Variablen</CardTitle>
                <Button variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="h-4 w-4 mr-2" />
                  Variable hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {variables.map((variable, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <Label>Variable ({'{{'}{'}}'} Format)</Label>
                    <Input
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value)}
                      placeholder="{{variableName}}"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Standardwert</Label>
                    <Input
                      value={variable.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      placeholder="Standardwert für Variable"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(index)}
                    className="mt-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Diese Werte werden als Standardwerte für die Variablen verwendet. Sie können beim Auswerten des Vertrags überschrieben werden.
              </p>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ContractEditor;
