import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, ChevronRight, Users, CheckSquare, Shield, Mail, 
  FileText, Euro, MessageCircle, Phone, QrCode, Send, Database,
  Building2, Video, Settings, Home, Lock, Rocket, BarChart3,
  Globe, Zap, UserCheck, ClipboardList, ArrowRight, Maximize2, Minimize2,
  Play, Inbox, Award, Eye, Upload, User, KeyRound, Link2, Copy, Check,
  Star, Clock, ArrowLeft, CheckCircle2, AlertTriangle, Info, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import payexpertLogo from "@/assets/payexpert-logo.png";

// ================================================================
// REAL UI MOCKUP COMPONENTS
// ================================================================

function MockTaskCard() {
  return (
    <div className="rounded-xl border bg-card shadow-lg overflow-hidden max-w-sm mx-auto">
      <div className="relative h-32 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Building2 className="h-12 w-12 text-white/30" />
        </div>
        <Badge className="absolute top-3 right-3 bg-primary/90 text-primary-foreground border-0 shadow-lg text-[10px]">
          <Star className="h-3 w-3 mr-1" /> Starter-Job
        </Badge>
        <Badge variant="secondary" className="absolute bottom-3 left-3 bg-black/70 text-white border-0 text-[10px]">
          Banking
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-base mb-1">Volksbank Kontoeröffnung</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          Eröffnung eines Girokontos bei der Volksbank inkl. KYC-Verifizierung und Dokumenten-Upload.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="destructive" className="text-[10px]">Hoch</Badge>
          <Badge variant="secondary" className="text-[10px]">Ausstehend</Badge>
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> 2h
          </div>
          <Button size="sm" className="text-xs h-7 gap-1">
            Details <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MockCredentialsBadge() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl border border-slate-700/50 text-left max-w-lg mx-auto">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500" />
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-200 uppercase">Autorisierte Zugangsdaten</p>
            <p className="text-[8px] text-slate-500">Vertraulich • Nur für Sie bestimmt</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-medium text-emerald-400 uppercase">Aktiv</span>
        </div>
      </div>
      <div className="p-4 flex gap-4">
        <div className="w-16 h-20 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 flex items-center justify-center shrink-0">
          <User className="h-6 w-6 text-slate-500" />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          {[
            { icon: <Mail className="h-3 w-3" />, label: "Email", value: "demo@volksbank.de" },
            { icon: <User className="h-3 w-3" />, label: "Benutzername", value: "vb_user_2025" },
            { icon: <Lock className="h-3 w-3" />, label: "Passwort", value: "••••••••" },
            { icon: <KeyRound className="h-3 w-3" />, label: "Passcode", value: "4829" },
          ].map((f) => (
            <div key={f.label}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-slate-500">{f.icon}</span>
                <span className="text-[8px] font-medium text-slate-500 uppercase">{f.label}</span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 font-mono text-[10px] text-slate-200 truncate">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/50 flex items-center gap-[1px]">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="h-4 rounded-[0.5px] bg-slate-500" 
            style={{ width: `${(i % 3 === 0) ? 2 : 1}px`, opacity: 0.25 + (i % 5) * 0.1 }} />
        ))}
        <div className="ml-auto text-right">
          <p className="text-[7px] text-slate-500 uppercase">Referenz-ID</p>
          <p className="text-[9px] font-mono text-slate-400">TSK-A3F29B10</p>
        </div>
      </div>
    </div>
  );
}

function MockTaskStepView() {
  return (
    <div className="space-y-3 max-w-lg mx-auto text-left">
      <div className="rounded-xl border-none shadow-lg bg-gradient-to-r from-primary/5 to-primary/10 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-base">Volksbank Kontoeröffnung</span>
          <Badge variant="destructive" className="text-[9px]">high</Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 text-[9px]">KYC</Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-300 text-[9px]">Upload</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Kontoeröffnung bei der Volksbank durchführen</p>
      </div>
      <div className="rounded-xl border p-4 bg-card">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium">Fortschritt</span>
          <span className="text-muted-foreground">3 von 5 Schritten</span>
        </div>
        <Progress value={60} className="h-1.5" />
        <div className="flex gap-1 mt-2">
          {[true, true, true, false, false].map((done, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${done ? "bg-primary" : i === 2 ? "bg-primary/50" : "bg-muted"}`} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border shadow-lg overflow-hidden bg-card">
        <div className="p-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm mb-1">Kontovertrag unterschreiben</p>
              <p className="text-xs text-muted-foreground">
                Bitte lesen Sie den Kontovertrag sorgfältig durch und bestätigen Sie die Kenntnisnahme.
              </p>
            </div>
            <Badge variant="destructive" className="text-[9px]">Pflicht</Badge>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <div className="mt-0.5 h-4 w-4 rounded border-2 border-primary bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-xs">Ich habe die Informationen gelesen und verstanden</span>
          </div>
        </div>
        <div className="p-4 border-t flex justify-between">
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <ArrowLeft className="h-3 w-3" /> Zurück
          </Button>
          <Button size="sm" className="gap-1 text-xs">
            Weiter <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MockTaskEmail() {
  return (
    <div className="max-w-md mx-auto rounded-xl overflow-hidden shadow-xl border bg-white text-left">
      <div className="bg-slate-100 px-4 py-2 border-b flex items-center gap-2 text-xs text-slate-500">
        <Mail className="h-3 w-3" />
        <span className="font-medium text-slate-700">noreply@payexpert.de</span>
        <span className="ml-auto">Heute, 14:23</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <img src={payexpertLogo} alt="Logo" className="h-8 w-8" />
          <div>
            <p className="font-bold text-sm text-slate-900">PAYEXPERT</p>
            <p className="text-[10px] text-slate-500">Neuer Auftrag zugewiesen</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-blue-900 mb-1">📋 Neuer Auftrag: Volksbank Kontoeröffnung</p>
          <p className="text-[11px] text-blue-700">
            Ihnen wurde ein neuer Auftrag zugewiesen. Bitte starten Sie die Bearbeitung zeitnah.
          </p>
        </div>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Kunde:</span>
            <span className="font-medium">Volksbank eG</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Priorität:</span>
            <Badge variant="destructive" className="text-[9px] h-4">Hoch</Badge>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Vergütung:</span>
            <span className="font-medium text-emerald-600">55,00 €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Geschätzte Dauer:</span>
            <span className="font-medium">2 Stunden</span>
          </div>
        </div>
        <Button size="sm" className="w-full mt-4 gap-1 text-xs">
          Auftrag im Dashboard öffnen <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
      <div className="bg-slate-50 px-5 py-3 border-t text-[10px] text-slate-400 text-center">
        © 2025 PAYEXPERT · Diese E-Mail wurde automatisch generiert.
      </div>
    </div>
  );
}

function MockCompletionEmail() {
  return (
    <div className="max-w-md mx-auto rounded-xl overflow-hidden shadow-xl border bg-white text-left">
      <div className="bg-slate-100 px-4 py-2 border-b flex items-center gap-2 text-xs text-slate-500">
        <Mail className="h-3 w-3" />
        <span className="font-medium text-slate-700">noreply@payexpert.de</span>
        <span className="ml-auto">Heute, 18:45</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <img src={payexpertLogo} alt="Logo" className="h-8 w-8" />
          <div>
            <p className="font-bold text-sm text-slate-900">PAYEXPERT</p>
            <p className="text-[10px] text-slate-500">Auftragsbestätigung</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-900">Auftrag erfolgreich abgeschlossen!</p>
          <p className="text-[11px] text-emerald-700 mt-1">
            Volksbank Kontoeröffnung wurde genehmigt.
          </p>
        </div>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Auftrag:</span>
            <span className="font-medium">Volksbank Kontoeröffnung</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Status:</span>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[9px] h-4">Genehmigt</Badge>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">Vergütung:</span>
            <span className="font-bold text-emerald-600">55,00 €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Abgeschlossene Schritte:</span>
            <span className="font-medium">5 / 5</span>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <Info className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-700">
              Ihre Vergütung wird mit der nächsten Abrechnung ausgezahlt. Freelancer erhalten automatisch eine Honorarrechnung.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 px-5 py-3 border-t text-[10px] text-slate-400 text-center">
        © 2025 PAYEXPERT · Diese E-Mail wurde automatisch generiert.
      </div>
    </div>
  );
}

function MockTaskCompletion() {
  return (
    <div className="max-w-sm mx-auto text-center space-y-4">
      <div className="rounded-xl border shadow-lg bg-card p-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h3 className="font-bold text-lg text-foreground mb-1">Auftrag eingereicht!</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ihr Auftrag „Volksbank Kontoeröffnung" wurde erfolgreich eingereicht und wird nun geprüft.
        </p>
        <Progress value={100} className="h-2 mb-3" />
        <div className="flex items-center justify-center gap-2">
          <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> In Prüfung
          </Badge>
        </div>
        <div className="mt-4 space-y-1.5 text-left">
          {["Kontovertrag gelesen", "KYC-Verifizierung", "Identitätsprüfung", "Dokumente hochgeladen", "Qualitätsprüfung"].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Slide type ----
interface Slide {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  description?: string;
  icon: any;
  gradient: string;
  features?: string[];
  layout?: "features" | "video" | "flow-diagram" | "mockup-split";
  videoSrc?: string;
  flowSteps?: { icon: any; label: string; detail: string; color: string }[];
  mockupIds?: string[];
}

const slides: Slide[] = [
  {
    id: "title",
    category: "Einführung",
    title: "PAYEXPERT",
    subtitle: "KYC & Compliance Management Platform",
    description: "Die All-in-One Lösung für digitales Onboarding, Task-Management und Mitarbeiterverwaltung.",
    icon: Rocket,
    gradient: "from-primary via-primary/80 to-primary/60",
    layout: "features",
    features: [
      "Vollständig digitaler Onboarding-Prozess",
      "KYC-Verifizierung & Compliance",
      "Task- und Auftragsmanagement",
      "Integrierte Kommunikation"
    ]
  },
  {
    id: "onboarding",
    category: "Onboarding",
    title: "Digitales Onboarding",
    subtitle: "Vom Bewerber zum Mitarbeiter – komplett digital",
    icon: UserCheck,
    gradient: "from-emerald-600 via-emerald-500 to-teal-500",
    layout: "features",
    features: [
      "Online-Bewerbungsformular mit Lebenslauf-Upload",
      "Automatische Bewerbungsbestätigung per E-Mail",
      "4 Beschäftigungsarten: Vollzeit, Teilzeit, Minijob, Freelancer",
      "Coupon-System für Willkommensgeschenke",
      "Terminvereinbarung für Vorstellungsgespräche"
    ]
  },
  {
    id: "kyc",
    category: "Compliance",
    title: "KYC-Verifizierung",
    subtitle: "Identitätsprüfung nach höchsten Standards",
    icon: Shield,
    gradient: "from-blue-600 via-blue-500 to-indigo-500",
    layout: "features",
    features: [
      "Video-Identifikation in Echtzeit",
      "Dokumenten-Upload & automatische Prüfung",
      "PostIdent-Verfahren als Alternative",
      "Ausweisdokument-Erkennung (KI-gestützt)",
      "Compliance-konforme Dokumentation"
    ]
  },
  {
    id: "employee-dashboard",
    category: "Mitarbeiter",
    title: "Mitarbeiter-Dashboard",
    subtitle: "Alles auf einen Blick für jeden Mitarbeiter",
    icon: Home,
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
    layout: "features",
    features: [
      "Persönliches Dashboard mit Übersicht",
      "Digitales Postfach für Dokumente & Verträge",
      "Lohn- und Honorarabrechnungen einsehen",
      "Aufträge annehmen und bearbeiten",
      "Chat mit persönlichem Ansprechpartner"
    ]
  },
  {
    id: "task-flow",
    category: "Mitarbeiter",
    title: "Auftrags-Workflow",
    subtitle: "So läuft ein Auftrag ab – Beispiel: Volksbank Kontoeröffnung",
    icon: Zap,
    gradient: "from-orange-600 via-amber-500 to-yellow-500",
    layout: "flow-diagram",
    flowSteps: [
      { icon: Mail, label: "Auftrags-E-Mail", detail: "Automatische Benachrichtigung mit allen Details", color: "from-blue-500 to-blue-600" },
      { icon: Eye, label: "Auftrag öffnen", detail: "Auftrags-Karte im Dashboard mit Branding", color: "from-violet-500 to-purple-600" },
      { icon: ClipboardList, label: "Schritte bearbeiten", detail: "Formulare ausfüllen, Dokumente hochladen", color: "from-orange-500 to-amber-600" },
      { icon: CheckSquare, label: "Qualitätsprüfung", detail: "Automatische Checkliste vor Einreichung", color: "from-emerald-500 to-green-600" },
      { icon: Award, label: "Abschluss-E-Mail", detail: "Bestätigung & Vergütungsinfo per E-Mail", color: "from-primary to-primary/80" },
    ]
  },
  {
    id: "task-email",
    category: "Mitarbeiter",
    title: "Auftrags-E-Mail",
    subtitle: "So wird der Mitarbeiter über einen neuen Auftrag informiert",
    icon: Inbox,
    gradient: "from-blue-600 via-blue-500 to-indigo-500",
    layout: "mockup-split",
    mockupIds: ["task-card", "task-email"],
    features: [
      "Sofortige E-Mail-Benachrichtigung bei neuem Auftrag",
      "Auftragsdetails: Kunde, Vergütung, Deadline",
      "Direkter Link zum Auftrag im Dashboard",
      "Kundenspezifisches Branding (z.B. Volksbank-Farben)"
    ]
  },
  {
    id: "task-steps-detail",
    category: "Mitarbeiter",
    title: "Auftragsbearbeitung",
    subtitle: "Strukturierte Aufgaben mit klaren Anweisungen",
    icon: ClipboardList,
    gradient: "from-orange-600 via-amber-500 to-yellow-500",
    layout: "mockup-split",
    mockupIds: ["task-step", "credentials"],
    features: [
      "Mehrstufige Aufträge mit Fortschrittsbalken",
      "Text-, Datei- und Checkbox-Schritte",
      "Credentials-Badge für Login-Daten des Kunden",
      "Echtzeit-Speicherung – kein Datenverlust"
    ]
  },
  {
    id: "completion-email",
    category: "Mitarbeiter",
    title: "Abschluss & Bestätigung",
    subtitle: "Bestätigung nach erfolgreicher Auftragsbearbeitung",
    icon: Award,
    gradient: "from-emerald-600 via-green-500 to-teal-500",
    layout: "mockup-split",
    mockupIds: ["task-completion", "completion-email"],
    features: [
      "Automatische Bestätigungs-E-Mail nach Admin-Genehmigung",
      "Vergütungsdetails & Honorar-Übersicht",
      "Zusammenfassung aller erledigten Schritte",
      "Freelancer erhalten automatisch eine Honorarabrechnung"
    ]
  },
  {
    id: "admin-overview",
    category: "Admin",
    title: "Admin-Zentrale",
    subtitle: "Volle Kontrolle über alle Prozesse",
    icon: Building2,
    gradient: "from-red-600 via-rose-500 to-pink-500",
    layout: "features",
    features: [
      "Bewerbungen prüfen, annehmen oder ablehnen",
      "Mitarbeiterverwaltung mit Detailansicht",
      "Task-Force: Aufträge zuweisen und überwachen",
      "Task-Zentrale: Aufgabenvorlagen erstellen",
      "Ampel-System für Aufgabenstatus"
    ]
  },
  {
    id: "communication",
    category: "Admin",
    title: "Kommunikation",
    subtitle: "Alle Kanäle zentral gebündelt",
    icon: MessageCircle,
    gradient: "from-cyan-600 via-sky-500 to-blue-500",
    layout: "features",
    features: [
      "Chat-Postfach mit Echtzeit-Nachrichten",
      "E-Mail-Zentrale mit temporären E-Mail-Adressen",
      "Email Sender Pro für Massen-E-Mails",
      "Telegram-Benachrichtigungen",
      "SMS-Weiterleitung für Verifizierungscodes"
    ]
  },
  {
    id: "management",
    category: "Admin",
    title: "Verwaltungstools",
    subtitle: "Effiziente Administration auf allen Ebenen",
    icon: Settings,
    gradient: "from-slate-700 via-slate-600 to-slate-500",
    layout: "features",
    features: [
      "Telefonnummern-Verwaltung mit Kostenkontrolle",
      "Coupon-Verwaltung & QR-Code-Generierung",
      "Lohnabrechnungen erstellen (PDF-Export)",
      "Vertragsvorlagen mit dynamischen Platzhaltern",
      "Daten Export & Import (JSON/CSV)"
    ]
  },
  {
    id: "security",
    category: "Sicherheit",
    title: "Sicherheit & Compliance",
    subtitle: "Enterprise-Grade Sicherheit für sensible Daten",
    icon: Lock,
    gradient: "from-emerald-700 via-green-600 to-teal-600",
    layout: "features",
    features: [
      "Security-Monitor mit Echtzeit-Überwachung",
      "Row Level Security auf Datenbankebene",
      "Rate-Limiting gegen Missbrauch",
      "Aktivitäts-Logging aller Aktionen",
      "DSGVO-konforme Datenverarbeitung"
    ]
  },
  {
    id: "closing",
    category: "Zusammenfassung",
    title: "Ihre Vorteile",
    subtitle: "Warum PAYEXPERT?",
    icon: BarChart3,
    gradient: "from-primary via-primary/80 to-primary/60",
    layout: "features",
    features: [
      "100% digitaler Prozess – kein Papier nötig",
      "Skalierbar von 1 bis 1.000+ Mitarbeiter",
      "Echtzeit-Kommunikation über alle Kanäle",
      "Höchste Sicherheitsstandards (KYC/AML)",
      "Individuelle Branding-Anpassung pro Aufgabe"
    ]
  }
];

// ---- Mockup registry ----
function renderMockup(id: string) {
  switch (id) {
    case "task-card": return <MockTaskCard />;
    case "task-email": return <MockTaskEmail />;
    case "task-step": return <MockTaskStepView />;
    case "credentials": return <MockCredentialsBadge />;
    case "task-completion": return <MockTaskCompletion />;
    case "completion-email": return <MockCompletionEmail />;
    default: return null;
  }
}

// ---- Render helpers per layout ----

function FeaturesLayout({ slide }: { slide: Slide }) {
  return (
    <div className="space-y-3">
      {slide.description && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-xl text-muted-foreground mb-8 leading-relaxed">
          {slide.description}
        </motion.p>
      )}
      {slide.features?.map((feature, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.08 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${slide.gradient} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {i + 1}
          </div>
          <span className="text-base text-foreground">{feature}</span>
        </motion.div>
      ))}
    </div>
  );
}

function MockupSplitLayout({ slide }: { slide: Slide }) {
  const ids = slide.mockupIds || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ids.map((id, i) => (
          <motion.div key={id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.15, type: "spring" }}>
            {renderMockup(id)}
          </motion.div>
        ))}
      </div>
      {slide.features && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slide.features.map((feature, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border shadow-sm">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${slide.gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {i + 1}
              </div>
              <span className="text-sm text-foreground">{feature}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowDiagramLayout({ slide }: { slide: Slide }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {slide.flowSteps?.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 200 }}>
              <div className="flex items-center gap-4">
                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg shrink-0`}>
                  <StepIcon className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-primary text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 p-4 rounded-xl bg-card border shadow-sm">
                  <p className="font-semibold text-foreground">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </div>
              {i < (slide.flowSteps?.length || 0) - 1 && (
                <div className="ml-7 h-4 border-l-2 border-dashed border-muted-foreground/30" />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main component ----
export default function Presentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goTo = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  const next = useCallback(() => {
    if (currentSlide < slides.length - 1) goTo(currentSlide + 1);
  }, [currentSlide, goTo]);

  const prev = useCallback(() => {
    if (currentSlide > 0) goTo(currentSlide - 1);
  }, [currentSlide, goTo]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) { setIsFullscreen(false); }
      if (e.key === "f" || e.key === "F5") { e.preventDefault(); toggleFullscreen(); }
    };
    const handleFS = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("fullscreenchange", handleFS);
    return () => { window.removeEventListener("keydown", handleKey); document.removeEventListener("fullscreenchange", handleFS); };
  }, [next, prev, isFullscreen, toggleFullscreen]);

  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 600 : -600, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -600 : 600, opacity: 0 }),
  };

  const renderSlideContent = () => {
    switch (slide.layout) {
      case "mockup-split": return <MockupSplitLayout slide={slide} />;
      case "flow-diagram": return <FlowDiagramLayout slide={slide} />;
      default: return <FeaturesLayout slide={slide} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <img src={payexpertLogo} alt="Logo" className="h-8 w-8" />
          <span className="font-bold text-lg">Projekt-Vorstellung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentSlide + 1} / {slides.length}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r bg-card/50 p-4 space-y-1 hidden lg:block overflow-y-auto">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2.5 ${
                i === currentSlide
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8 relative overflow-y-auto">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-4xl mb-20"
            >
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }} className="mb-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r ${slide.gradient} text-white`}>
                  {slide.category}
                </span>
              </motion.div>

              <div className="flex items-start gap-6 mb-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring" }}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${slide.gradient} text-white shadow-lg shrink-0`}>
                  <Icon className="h-10 w-10" />
                </motion.div>
                <div>
                  <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                    {slide.title}
                  </motion.h1>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="text-lg text-muted-foreground mt-1">
                    {slide.subtitle}
                  </motion.p>
                </div>
              </div>

              {renderSlideContent()}

              {slide.id === "closing" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }} className="mt-10 text-center">
                  <p className="text-lg text-muted-foreground mb-4">Bereit loszulegen?</p>
                  <Button size="lg" className="gap-2" onClick={() => window.open("/application", "_blank")}>
                    Jetzt bewerben <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
            <Button variant="outline" size="icon" onClick={prev} disabled={currentSlide === 0}
              className="rounded-full h-12 w-12 shadow-lg bg-card">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex gap-1.5 bg-card/80 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border">
              {slides.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`} />
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={next}
              disabled={currentSlide === slides.length - 1}
              className="rounded-full h-12 w-12 shadow-lg bg-card">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="fixed bottom-2 right-4 text-xs text-muted-foreground/50">
            ← → Pfeiltasten · F Vollbild
          </div>
        </div>
      </div>
    </div>
  );
}
