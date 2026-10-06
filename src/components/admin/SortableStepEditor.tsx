import { memo, useRef, useEffect, useState, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, X, Plus, Trash2 } from "lucide-react";

const BonusInput = ({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (v: number) => void }) => {
  const [local, setLocal] = useState<string>(String(value ?? 0));
  useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={local}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        if (/^\d*\.?\d*$/.test(v)) setLocal(v);
      }}
      onBlur={() => {
        const n = parseFloat(local);
        onCommit(isNaN(n) ? 0 : n);
      }}
      className="h-7 w-20 text-xs"
    />
  );
};

export interface ProductTestTask {
  id: string;
  title: string;
  description?: string;
}

export type ProductTestQuestionType = "scale5" | "scale10" | "yesno" | "single" | "text";

export interface ProductTestQuestion {
  id: string;
  label: string;
  type: ProductTestQuestionType;
  required?: boolean;
  options?: string[];
  follow_up_on_yes?: { id: string; label: string; required?: boolean } | null;
}

export interface ProductTestConfig {
  title: string;
  description: string;
  duration: number;
  duration_unit: "minutes" | "hours" | "days";
  require_confirmation?: boolean;
  confirmation_text?: string;
  tasks: ProductTestTask[];
  questions: ProductTestQuestion[];
}

export const emptyProductTestConfig = (): ProductTestConfig => ({
  title: "",
  description: "",
  duration: 24,
  duration_unit: "hours",
  require_confirmation: false,
  confirmation_text: "",
  tasks: [],
  questions: [],
});

export const eazyProductTestConfig = (): ProductTestConfig => ({
  title: "eazy SIM-Produkttest",
  description:
    "Nutze deine eazy SIM einen vollständigen Tag in deinem Alltag und achte dabei besonders auf Netzempfang, Internetverbindung und Telefonie.",
  duration: 24,
  duration_unit: "hours",
  require_confirmation: true,
  confirmation_text: "Ich habe meine SIM-Karte erhalten und bin bereit, den Test zu starten.",
  tasks: [
    { id: crypto.randomUUID(), title: "Mobile Daten nutzen", description: "Nutze verschiedene Apps und Webseiten über die mobile Datenverbindung." },
    { id: crypto.randomUUID(), title: "Webseiten und Apps verwenden", description: "Teste unterschiedliche Anwendungen im Alltag." },
    { id: crypto.randomUUID(), title: "Telefonie testen", description: "Führe mindestens ein Telefonat durch." },
    { id: crypto.randomUUID(), title: "Empfang im Gebäude beobachten", description: "Achte auf den Empfang innerhalb von Gebäuden." },
    { id: crypto.randomUUID(), title: "Empfang unterwegs beobachten", description: "Nutze die SIM auch außerhalb deines Zuhauses." },
  ],
  questions: [
    { id: crypto.randomUUID(), label: "Wie bewertest du den Netzempfang insgesamt?", type: "scale5", required: true },
    { id: crypto.randomUUID(), label: "Wie stabil war deine mobile Internetverbindung?", type: "scale5", required: true },
    { id: crypto.randomUUID(), label: "Wie zufrieden warst du mit der Geschwindigkeit?", type: "scale5", required: true },
    { id: crypto.randomUUID(), label: "Wie bewertest du die Sprachqualität bei Telefonaten?", type: "scale5", required: true },
    {
      id: crypto.randomUUID(),
      label: "Sind während des Tests Probleme aufgetreten?",
      type: "yesno",
      required: true,
      follow_up_on_yes: { id: crypto.randomUUID(), label: "Was ist passiert?", required: true },
    },
    {
      id: crypto.randomUUID(),
      label: "Wie war die eazy SIM im Vergleich zu deiner bisherigen SIM?",
      type: "single",
      required: true,
      options: ["deutlich schlechter", "eher schlechter", "ungefähr gleich", "eher besser", "deutlich besser"],
    },
    { id: crypto.randomUUID(), label: "Wie zufrieden bist du insgesamt mit der eazy SIM?", type: "scale10", required: true },
    { id: crypto.randomUUID(), label: "Würdest du die eazy SIM selbst nutzen?", type: "single", required: true, options: ["Ja", "Vielleicht", "Nein"] },
    { id: crypto.randomUUID(), label: "Was hat dir besonders gut gefallen?", type: "text", required: false },
    { id: crypto.randomUUID(), label: "Was könnte verbessert werden?", type: "text", required: false },
  ],
});

export const PRODUCT_TEST_QUESTION_TYPES: { value: ProductTestQuestionType; label: string }[] = [
  { value: "scale5", label: "Bewertung 1–5" },
  { value: "scale10", label: "Bewertung 1–10" },
  { value: "yesno", label: "Ja / Nein" },
  { value: "single", label: "Einfachauswahl" },
  { value: "text", label: "Freitext" },
];

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  type: "text" | "checkbox" | "file" | "product_test";
  required: boolean;
  ask_id_document?: boolean;
  id_document_options?: ("personalausweis" | "reisepass")[];
  id_document_bonus?: { personalausweis?: number; reisepass?: number };
  ask_postal_consent?: boolean;
  postal_consent_bonus?: number;
  product_test?: ProductTestConfig;
}

interface SortableStepEditorProps {
  step: TaskStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: keyof TaskStep, value: any) => void;
}

const getStepTypeLabel = (type: TaskStep["type"]) => {
  switch (type) {
    case "text": return "Einleitung";
    case "checkbox": return "Zustimmung";
    case "file": return "Datei";
    case "product_test": return "Produkttest";
    default: return type;
  }
};


const ProductTestEditor = ({ config, onChange }: { config: ProductTestConfig; onChange: (config: ProductTestConfig) => void }) => {
  const update = (patch: Partial<ProductTestConfig>) => onChange({ ...config, ...patch });
  const updateTask = (id: string, patch: Partial<ProductTestTask>) =>
    update({ tasks: config.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) });
  const updateQuestion = (id: string, patch: Partial<ProductTestQuestion>) =>
    update({ questions: config.questions.map((question) => question.id === id ? { ...question, ...patch } : question) });
  const addTask = () => update({ tasks: [...config.tasks, { id: crypto.randomUUID(), title: "", description: "" }] });
  const addQuestion = () => update({ questions: [...config.questions, { id: crypto.randomUUID(), label: "", type: "scale5", required: true }] });

  return (
    <div className="space-y-4 p-3 border rounded-md bg-background" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Produkttest konfigurieren</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(eazyProductTestConfig())}>Beispiel eazy SIM einfügen</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3">
        <div className="space-y-1"><Label className="text-xs">Produkttest-Titel</Label><Input value={config.title} onChange={(e) => update({ title: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Dauer</Label><Input type="number" min="1" value={config.duration} onChange={(e) => update({ duration: Math.max(1, Number(e.target.value) || 1) })} /></div>
        <div className="space-y-1"><Label className="text-xs">Einheit</Label><Select value={config.duration_unit} onValueChange={(value: ProductTestConfig["duration_unit"]) => update({ duration_unit: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minuten</SelectItem><SelectItem value="hours">Stunden</SelectItem><SelectItem value="days">Tage</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Testanweisung</Label><Textarea rows={4} value={config.description} onChange={(e) => update({ description: e.target.value })} /></div>
      <label className="flex items-start gap-2 text-xs cursor-pointer"><input type="checkbox" checked={config.require_confirmation ?? false} onChange={(e) => update({ require_confirmation: e.target.checked })} className="rounded mt-0.5" /><span>Bestätigung vor dem Start verlangen</span></label>
      {config.require_confirmation && <Input placeholder="Bestätigungstext für Mitarbeiter" value={config.confirmation_text ?? ""} onChange={(e) => update({ confirmation_text: e.target.value })} />}
      <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-xs font-semibold">Testaufgaben</Label><Button type="button" variant="outline" size="sm" onClick={addTask}><Plus className="h-3 w-3 mr-1" />Aufgabe hinzufügen</Button></div>
        {config.tasks.map((task) => <div key={task.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"><Input placeholder="Aufgabentitel" value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} /><Input placeholder="Optionale Beschreibung" value={task.description ?? ""} onChange={(e) => updateTask(task.id, { description: e.target.value })} /><Button type="button" variant="ghost" size="icon" onClick={() => update({ tasks: config.tasks.filter((item) => item.id !== task.id) })}><Trash2 className="h-4 w-4" /></Button></div>)}
      </div>
      <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-xs font-semibold">Bewertungsfragen</Label><Button type="button" variant="outline" size="sm" onClick={addQuestion}><Plus className="h-3 w-3 mr-1" />Frage hinzufügen</Button></div>
        {config.questions.map((question) => <div key={question.id} className="space-y-2 p-2 border rounded-md"><div className="grid grid-cols-[1fr_170px_auto] gap-2 items-center"><Input placeholder="Frage" value={question.label} onChange={(e) => updateQuestion(question.id, { label: e.target.value })} /><Select value={question.type} onValueChange={(value: ProductTestQuestionType) => updateQuestion(question.id, { type: value, options: value === "single" ? (question.options?.length ? question.options : ["Option 1", "Option 2"]) : question.options })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRODUCT_TEST_QUESTION_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="icon" onClick={() => update({ questions: config.questions.filter((item) => item.id !== question.id) })}><Trash2 className="h-4 w-4" /></Button></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={question.required !== false} onChange={(e) => updateQuestion(question.id, { required: e.target.checked })} className="rounded" />Pflichtfrage</label>
          {question.type === "single" && <Input placeholder="Optionen mit Komma trennen" value={(question.options ?? []).join(", ")} onChange={(e) => updateQuestion(question.id, { options: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />}
          {question.type === "yesno" && <Input placeholder="Folgefrage bei Ja (optional)" value={question.follow_up_on_yes?.label ?? ""} onChange={(e) => updateQuestion(question.id, { follow_up_on_yes: e.target.value ? { id: question.follow_up_on_yes?.id ?? crypto.randomUUID(), label: e.target.value, required: true } : null })} />}
        </div>)}
      </div>
    </div>
  );
};

const SortableStepEditorComponent = ({ step, index, expanded, onToggle, onRemove, onChange }: SortableStepEditorProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: step.id, 
    disabled: expanded 
  });
  
  // Local state for inputs to prevent cursor jumping
  const [localTitle, setLocalTitle] = useState(step.title);
  const [localDescription, setLocalDescription] = useState(step.description);
  
  // Sync local state when step changes from outside (e.g., initial load or reset)
  useEffect(() => {
    setLocalTitle(step.title);
  }, [step.id]); // Only sync when step.id changes, not on every step.title change
  
  useEffect(() => {
    setLocalDescription(step.description);
  }, [step.id]); // Only sync when step.id changes
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : undefined,
  };

  // Debounce updates to parent
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const descTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  const handleTitleChange = useCallback((value: string) => {
    setLocalTitle(value);
    clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      onChange(step.id, "title", value);
    }, 300);
  }, [step.id, onChange]);
  
  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    clearTimeout(descTimeoutRef.current);
    descTimeoutRef.current = setTimeout(() => {
      onChange(step.id, "description", value);
    }, 300);
  }, [step.id, onChange]);
  
  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(titleTimeoutRef.current);
      clearTimeout(descTimeoutRef.current);
    };
  }, []);

  return (
    <div ref={setNodeRef} style={style} className="p-3 bg-muted rounded-lg">
      <div className="flex items-center gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{index + 1}. {step.title || "Ohne Titel"}</span>
            <Badge variant="outline" className="text-xs">
              {getStepTypeLabel(step.type)}
            </Badge>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
          {expanded ? "Schließen" : "Bearbeiten"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(step.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Titel</Label>
              <Input 
                value={localTitle} 
                onChange={(e) => handleTitleChange(e.target.value)} 
                onPointerDown={(e) => e.stopPropagation()} 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Typ</Label>
              <Select
                value={step.type}
                onValueChange={(value: TaskStep["type"]) => {
                  onChange(step.id, "type", value);
                  if (value === "product_test" && !step.product_test) {
                    onChange(step.id, "product_test", emptyProductTestConfig());
                  }
                }}
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
            <Label className="text-xs">Beschreibung</Label>
            <Textarea
              value={localDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              rows={8}
              className="font-mono text-sm whitespace-pre-wrap"
              spellCheck
            />
          </div>
          {step.type === "text" && (
            <div className="space-y-2" onPointerDown={(e) => e.stopPropagation()}>
              <label
                htmlFor={`ask-postal-${step.id}`}
                className="flex items-start gap-2 p-3 rounded-md border bg-background cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  id={`ask-postal-${step.id}`}
                  checked={step.ask_postal_consent ?? false}
                  onChange={(e) => onChange(step.id, "ask_postal_consent" as any, e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span className="text-xs flex-1">
                  Postalische Zusendung – Bereitschaft abfragen
                  <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                    Mitarbeiter wird gefragt, ob er postalische Zusendungen vom Auftraggeber zusätzlich bearbeitet.
                  </span>
                </span>
              </label>

              {step.ask_postal_consent && (
                <div className="p-3 rounded-md border bg-background space-y-2">
                  <Label className="text-xs font-medium">Bonus bei „Ja"</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Zusätzliche Vergütung, wenn der Mitarbeiter zustimmt postalische Zusendungen zu bearbeiten.
                  </p>
                  <div className="flex items-center gap-1">
                    <BonusInput
                      value={step.postal_consent_bonus ?? 0}
                      disabled={false}
                      onCommit={(v) => onChange(step.id, "postal_consent_bonus" as any, v)}
                    />
                    <span className="text-[11px] text-muted-foreground">€</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {step.type === "checkbox" && (
            <div className="space-y-2" onPointerDown={(e) => e.stopPropagation()}>
              <label
                htmlFor={`ask-id-${step.id}`}
                className="flex items-start gap-2 p-3 rounded-md border bg-background cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  id={`ask-id-${step.id}`}
                  checked={step.ask_id_document ?? false}
                  onChange={(e) => onChange(step.id, "ask_id_document" as any, e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span className="text-xs flex-1">
                  Ausweisdokument-Auswahl anzeigen
                  <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                    Mitarbeiter wählt ein Ausweisdokument während dieses Schritts.
                  </span>
                </span>
              </label>
              {step.ask_id_document && (
                <div className="p-3 rounded-md border bg-background space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Erlaubte Ausweisdokumente</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Wähle aus, mit welchen Dokumenten die Identifizierung für diesen Auftrag möglich ist.
                    </p>
                    {([
                      { value: "personalausweis", label: "Deutscher Personalausweis" },
                      { value: "reisepass", label: "Reisepass" },
                    ] as const).map((opt) => {
                      const options = step.id_document_options ?? ["personalausweis", "reisepass"];
                      const enabled = options.includes(opt.value);
                      const bonus = step.id_document_bonus?.[opt.value] ?? 0;
                      return (
                        <div key={opt.value} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...options, opt.value]))
                                  : options.filter((o) => o !== opt.value);
                                onChange(step.id, "id_document_options" as any, next);
                              }}
                              className="rounded"
                            />
                            <span className="text-xs">{opt.label}</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Bonus</span>
                            <BonusInput
                              value={bonus}
                              disabled={!enabled}
                              onCommit={(v) => onChange(step.id, "id_document_bonus" as any, {
                                ...(step.id_document_bonus ?? {}),
                                [opt.value]: v,
                              })}
                            />
                            <span className="text-[11px] text-muted-foreground">€</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {step.type === "product_test" && (
            <ProductTestEditor
              config={step.product_test ?? emptyProductTestConfig()}
              onChange={(config) => onChange(step.id, "product_test", config)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const SortableStepEditor = memo(
  SortableStepEditorComponent,
  (prev, next) =>
    prev.step.id === next.step.id &&
    prev.step.type === next.step.type &&
    prev.step.required === next.step.required &&
    prev.step.ask_id_document === next.step.ask_id_document &&
    JSON.stringify(prev.step.id_document_options ?? null) === JSON.stringify(next.step.id_document_options ?? null) &&
    JSON.stringify(prev.step.id_document_bonus ?? null) === JSON.stringify(next.step.id_document_bonus ?? null) &&
    prev.step.ask_postal_consent === next.step.ask_postal_consent &&
    prev.step.postal_consent_bonus === next.step.postal_consent_bonus &&
    prev.expanded === next.expanded &&
    prev.index === next.index
);
