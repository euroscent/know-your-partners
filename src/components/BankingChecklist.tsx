import { useState, useEffect, memo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck, Mail, FileText, Search, ShieldCheck, FileCheck2, Stamp } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  unknown: boolean;
  remark: string;
}

interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  sectionIndex: number;
  itemIndex: number;
  updateItem: (sectionIndex: number, itemIndex: number, field: keyof ChecklistItem, value: any) => void;
}

const ChecklistItemRow = memo(({ item, sectionIndex, itemIndex, updateItem }: ChecklistItemRowProps) => (
  <div className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors">
    <div className="font-medium text-sm">{item.label}</div>
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${item.id}-ja`}
          checked={item.checked && !item.unknown}
          onCheckedChange={(checked) => {
            updateItem(sectionIndex, itemIndex, "checked", checked);
            if (checked) updateItem(sectionIndex, itemIndex, "unknown", false);
          }}
        />
        <Label htmlFor={`${item.id}-ja`} className="text-sm cursor-pointer">Ja</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${item.id}-nein`}
          checked={!item.checked && !item.unknown}
          onCheckedChange={() => {
            updateItem(sectionIndex, itemIndex, "checked", false);
            updateItem(sectionIndex, itemIndex, "unknown", false);
          }}
        />
        <Label htmlFor={`${item.id}-nein`} className="text-sm cursor-pointer">Nein</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${item.id}-unbekannt`}
          checked={item.unknown}
          onCheckedChange={(checked) => {
            updateItem(sectionIndex, itemIndex, "unknown", !!checked);
            if (checked) updateItem(sectionIndex, itemIndex, "checked", false);
          }}
        />
        <Label htmlFor={`${item.id}-unbekannt`} className="text-sm cursor-pointer">Unbekannt</Label>
      </div>
      <Input
        placeholder="Bemerkung"
        value={item.remark}
        onChange={(e) => updateItem(sectionIndex, itemIndex, "remark", e.target.value)}
        className="flex-1 min-w-[200px]"
      />
    </div>
  </div>
));
ChecklistItemRow.displayName = "ChecklistItemRow";

interface BankingChecklistProps {
  onComplete?: (data: any) => void;
}

export const BankingChecklist = ({ onComplete }: BankingChecklistProps) => {
  const [datum, setDatum] = useState(() => new Date().toISOString().split('T')[0]);
  const [mitarbeiter, setMitarbeiter] = useState("");
  const [vorgangsnummer, setVorgangsnummer] = useState("");
  const [auftraggeber, setAuftraggeber] = useState("");
  const [bemerkungen, setBemerkungen] = useState("");

  useEffect(() => {
    const loadEmployeeName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setMitarbeiter(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
      }
    };

    loadEmployeeName();
  }, []);

  const [sections, setSections] = useState<ChecklistSection[]>([
    {
      title: "2. Eingang der Unterlagen",
      items: [
        { id: "2.1", label: "Unterlagen stammen eindeutig vom Auftraggeber (Bank)?", checked: false, unknown: false, remark: "" },
        { id: "2.2", label: "Empfangszeitpunkt dokumentiert (Datum / Uhrzeit)?", checked: false, unknown: false, remark: "" },
        { id: "2.3", label: "Unterlagen vollständig gemäß Auftrag?", checked: false, unknown: false, remark: "" },
        { id: "2.4", label: "Richtige Zuordnung zum Ident-Vorgang (ID, Kundennummer)?", checked: false, unknown: false, remark: "" },
        { id: "2.5", label: "Unterlagen unbeschädigt / unverändert eingegangen?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "3. Versanddauer / Prozesszeiten",
      items: [
        { id: "3.1", label: "Versanddauer zwischen Ident-Abschluss und Dokumenteneingang dokumentiert?", checked: false, unknown: false, remark: "" },
        { id: "3.2", label: "Versanddauer plausibel (innerhalb erwarteter Frist)?", checked: false, unknown: false, remark: "" },
        { id: "3.3", label: "Abweichung (z. B. verspätet, fehlend) im System notiert?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "4. Sicherheits- und Vertrauensfelder",
      items: [
        { id: "4.1", label: "Dokumente enthalten Sicherheitsmerkmale (Wasserzeichen, digitale Signatur etc.)?", checked: false, unknown: false, remark: "" },
        { id: "4.2", label: "Sicherheitsfelder / Signaturen überprüft?", checked: false, unknown: false, remark: "" },
        { id: "4.3", label: "Keine Hinweise auf Manipulation oder Fälschung?", checked: false, unknown: false, remark: "" },
        { id: "4.4", label: "Bei fehlenden Sicherheitsmerkmalen Hinweis im Protokoll vermerkt?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "5. Inhaltliche Prüfung",
      items: [
        { id: "5.1", label: "Kundendaten stimmen mit Ident-Ergebnis überein?", checked: false, unknown: false, remark: "" },
        { id: "5.2", label: "Vertragsdaten vollständig und plausibel?", checked: false, unknown: false, remark: "" },
        { id: "5.3", label: "Unterschriften vorhanden und lesbar (falls nötig)?", checked: false, unknown: false, remark: "" },
        { id: "5.4", label: "Keine widersprüchlichen Angaben im Vergleich zum Ident-Protokoll?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "6. Weiterverarbeitung",
      items: [
        { id: "6.1", label: "Unterlagen an richtigen Empfänger / System übermittelt?", checked: false, unknown: false, remark: "" },
        { id: "6.2", label: "Übertragung über sicheren Kanal (z. B. verschlüsselter Upload)?", checked: false, unknown: false, remark: "" },
        { id: "6.3", label: "Übergabezeitpunkt dokumentiert?", checked: false, unknown: false, remark: "" },
        { id: "6.4", label: "Empfang durch Auftraggeber bestätigt?", checked: false, unknown: false, remark: "" },
        { id: "6.5", label: "Keine lokale Speicherung oder Ausdrucke erstellt?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "7. Datenschutz & Archivierung",
      items: [
        { id: "7.1", label: "Unterlagen nur im autorisierten System gespeichert?", checked: false, unknown: false, remark: "" },
        { id: "7.2", label: "Keine Datenweitergabe an Unbefugte?", checked: false, unknown: false, remark: "" },
        { id: "7.3", label: "Aufbewahrungs- und Löschfristen eingehalten?", checked: false, unknown: false, remark: "" },
        { id: "7.4", label: "Datenschutzprüfung im System dokumentiert?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "8. Abweichungen & Eskalation",
      items: [
        { id: "8.1", label: "Fehlende oder fehlerhafte Unterlagen gemeldet?", checked: false, unknown: false, remark: "" },
        { id: "8.2", label: "Verdacht auf Fälschung / Manipulation weitergeleitet?", checked: false, unknown: false, remark: "" },
        { id: "8.3", label: "Abweichungen schriftlich dokumentiert (Datum, Art, Reaktion)?", checked: false, unknown: false, remark: "" },
      ],
    },
    {
      title: "9. Abschlusskontrolle",
      items: [
        { id: "9.1", label: "Vorgang vollständig dokumentiert?", checked: false, unknown: false, remark: "" },
        { id: "9.2", label: "Status im System aktualisiert (\"Unterlagen geprüft\")?", checked: false, unknown: false, remark: "" },
        { id: "9.3", label: "Prüfer-Signatur / Datum eingetragen?", checked: false, unknown: false, remark: "" },
      ],
    },
  ]);

  const updateItem = useCallback((sectionIndex: number, itemIndex: number, field: keyof ChecklistItem, value: any) => {
    setSections(prev => {
      const newSections = prev.map((section, si) => {
        if (si !== sectionIndex) return section;
        return {
          ...section,
          items: section.items.map((item, ii) => {
            if (ii !== itemIndex) return item;
            return { ...item, [field]: value };
          }),
        };
      });
      return newSections;
    });
  }, []);

  const floatingIcons = [
    { Icon: Mail, x: "5%", y: "15%", delay: 0, size: 28, rotate: -12 },
    { Icon: FileText, x: "85%", y: "10%", delay: 0.3, size: 32, rotate: 8 },
    { Icon: Search, x: "75%", y: "65%", delay: 0.6, size: 26, rotate: -5 },
    { Icon: ShieldCheck, x: "15%", y: "70%", delay: 0.9, size: 24, rotate: 10 },
    { Icon: FileCheck2, x: "50%", y: "5%", delay: 1.2, size: 22, rotate: -8 },
    { Icon: Stamp, x: "92%", y: "40%", delay: 0.4, size: 20, rotate: 15 },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-accent/10 py-10 overflow-hidden">
          {/* Floating animated icons */}
          {floatingIcons.map(({ Icon, x, y, delay, size, rotate }, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none text-primary/15"
              style={{ left: x, top: y }}
              initial={{ opacity: 0, scale: 0.5, rotate: rotate - 20 }}
              animate={{
                opacity: [0, 0.3, 0.15, 0.3],
                scale: [0.5, 1, 0.9, 1],
                rotate: [rotate - 20, rotate, rotate + 5, rotate],
                y: [0, -8, 0, -8],
              }}
              transition={{
                delay,
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              <Icon size={size} strokeWidth={1.5} />
            </motion.div>
          ))}

          <motion.div
            className="flex items-center gap-4 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="bg-primary/10 p-4 rounded-2xl border border-primary/20 shadow-lg"
              animate={{ rotate: [0, -3, 3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <ClipboardCheck className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <CardTitle className="text-2xl">Checkliste – Prüfung von Bankunterlagen nach Identifikation</CardTitle>
              <CardDescription className="text-base mt-1">
                Bitte füllen Sie alle Punkte gewissenhaft aus, bevor Sie mit den Uploads fortfahren
              </CardDescription>
            </div>
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          {/* 1. Allgemeine Angaben */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">1. Allgemeine Angaben</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="datum">Datum</Label>
                <Input
                  id="datum"
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mitarbeiter">Mitarbeiter</Label>
                <Input
                  id="mitarbeiter"
                  value={mitarbeiter}
                  onChange={(e) => setMitarbeiter(e.target.value)}
                  placeholder="Name des Mitarbeiters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vorgangsnummer">Vorgangsnummer / Session-ID</Label>
                <Input
                  id="vorgangsnummer"
                  value={vorgangsnummer}
                  onChange={(e) => setVorgangsnummer(e.target.value)}
                  placeholder="z.B. 12345-ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auftraggeber">Auftraggeber (Bank)</Label>
                <Input
                  id="auftraggeber"
                  value={auftraggeber}
                  onChange={(e) => setAuftraggeber(e.target.value)}
                  placeholder="Name der Bank"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Alle Checklisten-Sektionen */}
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
              <div className="space-y-4">
                {section.items.map((item, itemIndex) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    sectionIndex={sectionIndex}
                    itemIndex={itemIndex}
                    updateItem={updateItem}
                  />
                ))}
              </div>
              <Separator />
            </div>
          ))}

          {/* 10. Bemerkungen / Hinweise */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">10. Bemerkungen / Hinweise</h3>
            <Textarea
              value={bemerkungen}
              onChange={(e) => setBemerkungen(e.target.value)}
              placeholder="Zusätzliche Anmerkungen oder Hinweise zum Vorgang..."
              rows={5}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
