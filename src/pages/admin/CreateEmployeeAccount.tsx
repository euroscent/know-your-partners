import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-stub";
import { useI18n } from "@/lib/i18n";
import { UserPlus, Wand2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const randomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!$%";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
};

export default function CreateEmployeeAccount() {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("Mindestens 8 Zeichen"));
      return;
    }
    setLoading(true);
    const { error } = await (supabase as any).rpc("admin_create_employee", {
      _username: username.trim(),
      _password: password,
      _first_name: firstName.trim() || null,
      _last_name: lastName.trim() || null,
      _email: email.trim() || null,
      _role: role,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCreated({ username: username.trim().toLowerCase(), password });
    toast.success(t("Konto erstellt"));
    setUsername(""); setPassword(""); setFirstName(""); setLastName(""); setEmail(""); setRole("employee");
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">{t("Mitarbeiterkonto anlegen")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("Lege für neue Angestellte einen Zugang mit Benutzername und Passwort an.")}
        </p>
      </div>

      {created && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-6 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">{t("Der neue Mitarbeiter kann sich jetzt mit Benutzername und Passwort anmelden.")}</p>
              <p>{t("Benutzername")}: <span className="font-mono">{created.username}</span></p>
              <p>{t("Passwort")}: <span className="font-mono">{created.password}</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card/80 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-primary" /> {t("Konto anlegen")}
          </CardTitle>
          <CardDescription>EuroScent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fn">{t("Vorname")}</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">{t("Nachname")}</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="un">{t("Benutzername")} *</Label>
              <Input id="un" required value={username} autoComplete="off"
                pattern="[A-Za-z0-9._\-]{3,32}"
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">{t("Passwort")} *</Label>
                <button type="button" onClick={() => { setPassword(randomPassword()); setShow(true); }}
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  <Wand2 className="h-3 w-3" /> {t("Zufälliges Passwort")}
                </button>
              </div>
              <div className="relative">
                <Input id="pw" required minLength={8} type={show ? "text" : "password"} value={password}
                  autoComplete="new-password" placeholder={t("Mindestens 8 Zeichen")}
                  onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="em">{t("E-Mail (optional)")}</Label>
                <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("Rolle")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t("Mitarbeiter")}</SelectItem>
                    <SelectItem value="admin">{t("Administrator")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t("Wird erstellt…") : t("Konto erstellen")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
