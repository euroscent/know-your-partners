import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/toast-stub";

const PGP_PIN = "88133788";
const STORAGE_KEY = "pgp_unlocked";

export function isPgpUnlocked() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function lockPgp() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function AdminPgpGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unlocked, setUnlocked] = useState(isPgpUnlocked());
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const isAdminRoute = location.pathname.startsWith("/dashboard/admin");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setChecked(true);
        }
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!active) return;
      setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);
      setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const onAuth = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        lockPgp();
        setUnlocked(false);
      }
    });
    return () => {
      onAuth.data.subscription.unsubscribe();
    };
  }, []);

  const needsPin = checked && isAdmin && isAdminRoute && !unlocked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PGP_PIN) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      setUnlocked(true);
      setPin("");
      toast({
        title: "PGP entsperrt",
        description: "Sensible Daten sind jetzt für diese Sitzung sichtbar.",
      });
    } else {
      setAttempts((a) => a + 1);
      setPin("");
      toast({
        title: "Falscher PIN",
        description: "Der eingegebene PGP-PIN ist ungültig.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {children}
      <Dialog open={needsPin}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">PGP entsperren</DialogTitle>
            <DialogDescription className="text-center">
              Sensible Daten im Admin-Bereich sind PGP-verschlüsselt. Bitte geben Sie den PGP-PIN
              ein, um sie für diese Sitzung zu entsperren.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pgp-pin">PGP-PIN</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pgp-pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showPin ? "PIN verbergen" : "PIN anzeigen"}
              </button>
              {attempts > 0 && (
                <p className="text-xs text-destructive">Fehlgeschlagene Versuche: {attempts}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={pin.length === 0}>
                Entsperren
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
