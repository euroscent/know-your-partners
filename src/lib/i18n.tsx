import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "de" | "en";

// German text is the key; English translation is the value.
const en: Record<string, string> = {
  "Mitarbeiteraufnahme": "Employee onboarding",
  "Neue Bewerber": "New applicants",
  "Verifizierungen": "Verifications",
  "Tasks": "Tasks",
  "Dashboard": "Dashboard",
  "Mein Postfach": "My inbox",
  "Bibliothek": "Library",
  "Honorarabrechnungen": "Fee invoices",
  "Lohnabrechnungen": "Payslips",
  "Einstellungen": "Settings",
  "Postfach": "Inbox",
  "Mitarbeiter": "Employees",
  "Konto anlegen": "Create account",
  "Task-Flow": "Task flow",
  "E-Mail-Zentrale": "Email center",
  "Telefonnummern": "Phone numbers",
  "Taskvorlagen + erstellen": "Task templates",
  "Taskmails": "Task emails",
  "Coupon-Verwaltung": "Coupons",
  "Auszahlungs-Freigaben": "Payout approvals",
  "Security Monitor": "Security monitor",
  "Daten Export / Import": "Data export / import",
  "NAVIGATION": "NAVIGATION",
  "Anfragen": "Requests",
  "Verwaltung": "Management",
  "Meine Aufträge": "My tasks",
  "Keine offenen Aufträge": "No open tasks",
  "Administrator": "Administrator",
  "App installieren": "Install app",
  "Abmelden": "Sign out",
  "Sprache": "Language",
  // Login
  "E-Mail oder Benutzername": "Email or username",
  "Passwort": "Password",
  "Anmelden": "Sign in",
  "Passwort vergessen?": "Forgot password?",
  "Mitarbeiter-Login": "Employee login",
  "Admin-Login": "Admin login",
  // Create account page
  "Mitarbeiterkonto anlegen": "Create employee account",
  "Lege für neue Angestellte einen Zugang mit Benutzername und Passwort an.": "Create a login with username and password for new employees.",
  "Benutzername": "Username",
  "Vorname": "First name",
  "Nachname": "Last name",
  "E-Mail (optional)": "Email (optional)",
  "Mindestens 8 Zeichen": "At least 8 characters",
  "Rolle": "Role",
  "Konto erstellen": "Create account",
  "Wird erstellt…": "Creating…",
  "Konto erstellt": "Account created",
  "Fehler": "Error",
  "Zufälliges Passwort": "Random password",
  "Der neue Mitarbeiter kann sich jetzt mit Benutzername und Passwort anmelden.": "The new employee can now sign in with username and password.",
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (de: string) => string }
const LanguageContext = createContext<Ctx>({ lang: "de", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    (typeof localStorage !== "undefined" && localStorage.getItem("lang") === "en") ? "en" : "de"
  );
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { localStorage.setItem("lang", l); setLangState(l); };
  const t = (de: string) => (lang === "en" ? en[de] ?? de : de);
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`inline-flex rounded-md border border-border bg-card/60 p-0.5 text-xs ${className}`} role="group" aria-label="Sprache / Language">
      {(["de", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded font-medium uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
